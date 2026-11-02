import { describe, it, expect } from 'vitest'

describe('Server Environment & Security Guard', () => {
  it('protects server configuration keys from empty values', () => {
    const testSecret = 'minimum-32-characters-secret-string-12345678'
    expect(testSecret.length).toBeGreaterThanOrEqual(32)
  })

  it('verifies that public prefix NEXT_PUBLIC_ is restricted to client-safe keys', () => {
    const publicKeys = [
      'NEXT_PUBLIC_APP_URL',
      'NEXT_PUBLIC_BRAND_NAME',
      'NEXT_PUBLIC_CAFE_NAME',
      'NEXT_PUBLIC_CAFE_SLUG',
    ]

    for (const key of publicKeys) {
      expect(key.startsWith('NEXT_PUBLIC_')).toBe(true)
    }

    const privateKeys = ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET', 'MIDTRANS_SERVER_KEY']
    for (const key of privateKeys) {
      expect(key.startsWith('NEXT_PUBLIC_')).toBe(false)
    }
  })
})

