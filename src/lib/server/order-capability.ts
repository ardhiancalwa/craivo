import 'server-only'
import crypto from 'node:crypto'
import { getServerEnv } from './env'

/**
 * Menurunkan orderSecretToken secara kriptografis deterministik dari HMAC(JWT_SECRET).
 * Token ini memiliki panjang 256-bit dan bertindak sebagai capability token unik bagi tamu pemesan.
 * Database TIDAK PERNAH menyimpan token plaintext ini, melainkan hanya SHA-256 hash dan nonce acak.
 */
export function deriveOrderSecretToken(orderId: string, capabilityNonce: string): string {
  const env = getServerEnv()
  const domainKey = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update('cravio/order-capability/v1')
    .digest()

  const rawCapability = crypto
    .createHmac('sha256', domainKey)
    .update(`order-cap:v1:${orderId}:${capabilityNonce}`)
    .digest('base64url')

  return `sec_${rawCapability}`
}

/**
 * Menghitung SHA-256 hash dari orderSecretToken mentah untuk disimpan di PostgreSQL.
 */
export function hashOrderSecretToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex')
}

/**
 * Memverifikasi kecocokan orderSecretToken terhadap hash tersimpan di database menggunakan timingSafeEqual.
 * Mencegah serangan timing attack.
 */
export function verifyOrderCapabilityToken(
  providedToken: string | undefined | null,
  expectedHash: string
): boolean {
  if (!providedToken || typeof providedToken !== 'string' || !expectedHash) {
    return false
  }

  const computedHash = hashOrderSecretToken(providedToken)
  const bufA = Buffer.from(computedHash, 'utf-8')
  const bufB = Buffer.from(expectedHash, 'utf-8')

  if (bufA.length !== bufB.length) {
    return false
  }

  return crypto.timingSafeEqual(bufA, bufB)
}

