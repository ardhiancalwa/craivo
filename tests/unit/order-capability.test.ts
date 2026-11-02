import { describe, it, expect } from 'vitest'
import {
  deriveOrderSecretToken,
  hashOrderSecretToken,
  verifyOrderCapabilityToken,
} from '@/lib/server/order-capability'

describe('Unit: Order Capability Token (DEC-014)', () => {
  const orderId = 'ord_test_1234567890'
  const nonce = 'a1b2c3d4e5f67890a1b2c3d4e5f67890'

  it('menurunkan token secara deterministik dari orderId dan capabilityNonce', () => {
    const token1 = deriveOrderSecretToken(orderId, nonce)
    const token2 = deriveOrderSecretToken(orderId, nonce)

    expect(token1).toBeDefined()
    expect(token1.startsWith('sec_')).toBe(true)
    expect(token1).toBe(token2)
  })

  it('menghasilkan token berbeda untuk nonce berbeda pada orderId yang sama', () => {
    const nonceA = '11111111111111111111111111111111'
    const nonceB = '22222222222222222222222222222222'

    const tokenA = deriveOrderSecretToken(orderId, nonceA)
    const tokenB = deriveOrderSecretToken(orderId, nonceB)

    expect(tokenA).not.toBe(tokenB)
  })

  it('menghasilkan token berbeda untuk orderId berbeda pada nonce yang sama', () => {
    const tokenOrder1 = deriveOrderSecretToken('ord_1', nonce)
    const tokenOrder2 = deriveOrderSecretToken('ord_2', nonce)

    expect(tokenOrder1).not.toBe(tokenOrder2)
  })

  it('berhasil memverifikasi token yang valid terhadap SHA-256 hash', () => {
    const token = deriveOrderSecretToken(orderId, nonce)
    const hash = hashOrderSecretToken(token)

    expect(hash).toHaveLength(64) // SHA-256 hex string
    const isValid = verifyOrderCapabilityToken(token, hash)
    expect(isValid).toBe(true)
  })

  it('menolak verifikasi jika token salah', () => {
    const validToken = deriveOrderSecretToken(orderId, nonce)
    const hash = hashOrderSecretToken(validToken)

    const wrongToken = 'sec_tampered_capability_token'
    const isValid = verifyOrderCapabilityToken(wrongToken, hash)
    expect(isValid).toBe(false)
  })

  it('menolak verifikasi jika token kosong, undefined, atau null tanpa throw error', () => {
    const validToken = deriveOrderSecretToken(orderId, nonce)
    const hash = hashOrderSecretToken(validToken)

    expect(verifyOrderCapabilityToken('', hash)).toBe(false)
    expect(verifyOrderCapabilityToken(undefined, hash)).toBe(false)
    expect(verifyOrderCapabilityToken(null, hash)).toBe(false)
    expect(verifyOrderCapabilityToken('short', hash)).toBe(false)
  })
})

