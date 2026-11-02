import { describe, it, expect } from 'vitest'
import { validateEnvironment } from '../../scripts/validate-env'

describe('Operational Environment Validation (scripts/validate-env.ts)', () => {
  const baseValidEnv = {
    APP_ENV: 'staging' as const,
    DATABASE_URL: 'postgresql://postgres:secret@db.staging.com:5432/cravio?schema=cravio_staging',
    JWT_SECRET: 'a_very_long_and_secure_jwt_secret_32_chars_min',
    MIDTRANS_SERVER_KEY: 'SB-Mid-server-staging-key-123',
    MIDTRANS_CLIENT_KEY: 'SB-Mid-client-staging-key-123',
    MIDTRANS_IS_PRODUCTION: 'false' as const,
    CRON_SECRET: 'staging_cron_secret_16chars_min',
    BACKUP_ENCRYPTION_KEY: 'aes256_staging_backup_key_32_chars_long_enough',
    NEXT_PUBLIC_APP_URL: 'https://staging.cravio.id',
    NEXT_PUBLIC_BRAND_NAME: 'Cravio Staging',
    NEXT_PUBLIC_CAFE_NAME: 'SELA Artisanal Coffee (Staging)',
    NEXT_PUBLIC_CAFE_SLUG: 'sela-staging',
  }

  it('validates a correct staging environment successfully', () => {
    const res = validateEnvironment(baseValidEnv)
    expect(res.valid).toBe(true)
    expect(res.errors).toHaveLength(0)
    expect(res.data?.APP_ENV).toBe('staging')
    expect(res.data?.MIDTRANS_IS_PRODUCTION).toBe(false)
  })

  it('detects missing required variables', () => {
    const invalidEnv = { ...baseValidEnv, JWT_SECRET: undefined } as any
    const res = validateEnvironment(invalidEnv)
    expect(res.valid).toBe(false)
    expect(res.errors.some((e) => e.includes('JWT_SECRET'))).toBe(true)
  })

  it('rejects JWT_SECRET shorter than 32 characters', () => {
    const invalidEnv = { ...baseValidEnv, JWT_SECRET: 'short_secret' }
    const res = validateEnvironment(invalidEnv)
    expect(res.valid).toBe(false)
    expect(res.errors.some((e) => e.includes('32 characters'))).toBe(true)
  })

  it('flags financial safety risk if staging uses MIDTRANS_IS_PRODUCTION=true', () => {
    const unsafeEnv = { ...baseValidEnv, MIDTRANS_IS_PRODUCTION: 'true' as any }
    const res = validateEnvironment(unsafeEnv)
    expect(res.valid).toBe(false)
    expect(res.errors.some((e) => e.includes('Live money charge risk'))).toBe(true)
  })

  it('flags security alert if production uses sandbox key or MIDTRANS_IS_PRODUCTION=false', () => {
    const unsafeProdEnv = {
      ...baseValidEnv,
      APP_ENV: 'production' as const,
      MIDTRANS_IS_PRODUCTION: 'false' as any,
      MIDTRANS_SERVER_KEY: 'SB-Mid-server-sandbox-key',
    }
    const res = validateEnvironment(unsafeProdEnv)
    expect(res.valid).toBe(false)
    expect(res.errors.some((e) => e.includes('SECURITY ALERT'))).toBe(true)
  })

  it('passes a strictly configured production environment', () => {
    const validProdEnv = {
      ...baseValidEnv,
      APP_ENV: 'production' as const,
      MIDTRANS_IS_PRODUCTION: 'true' as any,
      MIDTRANS_SERVER_KEY: 'Mid-server-LIVE-REAL-SECRET-KEY',
      MIDTRANS_CLIENT_KEY: 'Mid-client-LIVE-REAL-CLIENT-KEY',
      NEXT_PUBLIC_APP_URL: 'https://cravio.id',
    }
    const res = validateEnvironment(validProdEnv)
    expect(res.valid).toBe(true)
    expect(res.errors).toHaveLength(0)
    expect(res.data?.MIDTRANS_IS_PRODUCTION).toBe(true)
  })
})

