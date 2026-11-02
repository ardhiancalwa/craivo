import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

export const STAFF_COOKIE_NAME = 'cravio_staff_token'

export interface StaffJWTPayload {
  sub: string // Staff User ID
  username: string
  displayName: string
  role: 'ADMIN' | 'CASHIER' | 'BARISTA'
}

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be set and contain at least 32 characters.'
    )
  }
  return new TextEncoder().encode(secret)
}

/**
 * Signs a JWT token for an authenticated staff user.
 * Default expiration is 8 hours (standard cafe work shift).
 */
export async function signStaffToken(
  payload: StaffJWTPayload,
  expiresIn: string = '8h'
): Promise<string> {
  const secret = getJwtSecretKey()
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret)
}

/**
 * Verifies a JWT token and returns the staff payload, or null if invalid/expired.
 */
export async function verifyStaffToken(
  token: string
): Promise<StaffJWTPayload | null> {
  try {
    const secret = getJwtSecretKey()
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    })
    return {
      sub: payload.sub as string,
      username: payload['username'] as string,
      displayName: payload['displayName'] as string,
      role: payload['role'] as 'ADMIN' | 'CASHIER' | 'BARISTA',
    }
  } catch {
    return null
  }
}

/**
 * Hashes a plaintext PIN or password using bcrypt with salt rounds 10.
 */
export async function hashCredential(raw: string): Promise<string> {
  return bcrypt.hash(raw, 10)
}

/**
 * Verifies a plaintext PIN or password against a stored bcrypt hash in a timing-safe manner.
 */
export async function verifyCredential(
  raw: string,
  storedHash: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(raw, storedHash)
  } catch {
    return false
  }
}
