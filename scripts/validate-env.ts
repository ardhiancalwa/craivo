import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'

// Load .env or .env.local if present
const envFiles = ['.env.local', '.env']
for (const file of envFiles) {
  const filePath = path.resolve(process.cwd(), file)
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const equalIdx = trimmed.indexOf('=')
        if (equalIdx > 0) {
          const key = trimmed.slice(0, equalIdx).trim()
          let val = trimmed.slice(equalIdx + 1).trim()
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1)
          }
          if (process.env[key] === undefined) {
            process.env[key] = val
          }
        }
      }
    }
  }
}

export const environmentSchema = z.object({
  APP_ENV: z
    .enum(['development', 'test', 'staging', 'production'])
    .default('development'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL'),
  DIRECT_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  MIDTRANS_SERVER_KEY: z.string().min(1, 'MIDTRANS_SERVER_KEY is required'),
  MIDTRANS_CLIENT_KEY: z.string().min(1, 'MIDTRANS_CLIENT_KEY is required'),
  MIDTRANS_IS_PRODUCTION: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true'),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),
  BACKUP_ENCRYPTION_KEY: z
    .string()
    .min(32, 'BACKUP_ENCRYPTION_KEY must be at least 32 characters for AES-256')
    .optional(),
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),
  NEXT_PUBLIC_BRAND_NAME: z.string().min(1),
  NEXT_PUBLIC_CAFE_NAME: z.string().min(1),
  NEXT_PUBLIC_CAFE_SLUG: z.string().min(1),
})

export function validateEnvironment(customEnv?: Record<string, string | undefined>) {
  const target = customEnv || process.env
  const result = environmentSchema.safeParse(target)

  const errors: string[] = []

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      errors.push(`[${issue.path.join('.')}] ${issue.message}`)
    })
  } else {
    const data = result.data
    const isProd = data.APP_ENV === 'production'
    const isStagingOrDev = data.APP_ENV === 'staging' || data.APP_ENV === 'development' || data.APP_ENV === 'test'

    // Midtrans mode check
    if (isProd) {
      if (!data.MIDTRANS_IS_PRODUCTION) {
        errors.push(`[SECURITY ALERT] APP_ENV is production but MIDTRANS_IS_PRODUCTION is not true!`)
      }
      if (data.MIDTRANS_SERVER_KEY.startsWith('SB-')) {
        errors.push(`[SECURITY ALERT] APP_ENV is production but MIDTRANS_SERVER_KEY is a Sandbox key (starts with 'SB-')!`)
      }
    }

    if (isStagingOrDev) {
      if (data.MIDTRANS_IS_PRODUCTION) {
        errors.push(`[FINANCIAL SAFETY] APP_ENV is ${data.APP_ENV} but MIDTRANS_IS_PRODUCTION is set to true! Live money charge risk!`)
      }
      if (!data.MIDTRANS_SERVER_KEY.startsWith('SB-') && !data.MIDTRANS_SERVER_KEY.includes('test')) {
        errors.push(`[FINANCIAL SAFETY] APP_ENV is ${data.APP_ENV} but MIDTRANS_SERVER_KEY appears to be a live key (missing 'SB-' prefix)!`)
      }
    }

    // Database URL isolation check
    try {
      const dbUrl = new URL(data.DATABASE_URL)
      const schemaParam = dbUrl.searchParams.get('schema')

      if (data.APP_ENV === 'test' && schemaParam !== 'cravio_test') {
        errors.push(`[ISOLATION NOTICE] APP_ENV is 'test' but DATABASE_URL schema param is '${schemaParam || 'public'}'. Expected '?schema=cravio_test'.`)
      }
      if (data.APP_ENV === 'staging' && schemaParam !== 'cravio_staging') {
        console.warn(`[WARN] APP_ENV is 'staging' and schema is '${schemaParam || 'public'}'. Recommended: '?schema=cravio_staging'.`)
      }
    } catch {
      // Ignored if invalid URL, already caught by zod
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result.success ? result.data : null,
  }
}

// Execute standalone CLI if run directly
if (require.main === module) {
  console.log('🔍 [CRAVIO-OPS] Memvalidasi Environment Variables...')
  const validation = validateEnvironment()

  if (!validation.valid) {
    console.error('❌ [CRAVIO-OPS] Validasi Environment GAGAL:')
    validation.errors.forEach((err) => console.error(`  - ${err}`))
    process.exit(1)
  }

  console.log('✅ [CRAVIO-OPS] Validasi Environment SUKSES!')
  console.log(`   - APP_ENV: ${validation.data?.APP_ENV}`)
  console.log(`   - Midtrans Mode: ${validation.data?.MIDTRANS_IS_PRODUCTION ? 'PRODUCTION (Live)' : 'SANDBOX'}`)
  console.log(`   - Database Host: ${new URL(validation.data!.DATABASE_URL).host}`)
  console.log(`   - Public App URL: ${validation.data?.NEXT_PUBLIC_APP_URL}`)
}
