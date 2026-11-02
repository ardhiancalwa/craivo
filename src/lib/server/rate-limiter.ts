import 'server-only'
import prisma from './db'

export interface RateLimitOptions {
  key: string
  limit: number
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetSeconds: number
  points: number
}

/**
 * Mengonsumsi kuota rate limit berbasis tabel database PostgreSQL (rate_limit_records).
 * Bekerja konsisten lintas instance serverless/multi-proses.
 * Menggunakan pendekatan sliding/fixed window dengan reset waktu otomatis.
 */
export async function consumeRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { key, limit, windowSeconds } = options
  const now = new Date()
  const windowMs = windowSeconds * 1000

  // Coba ambil record yang ada
  const existing = await prisma.rateLimitRecord.findUnique({
    where: { key },
  })

  if (!existing) {
    try {
      const created = await prisma.rateLimitRecord.create({
        data: {
          key,
          points: 1,
          expireAt: new Date(now.getTime() + windowMs),
        },
      })
      return {
        allowed: 1 <= limit,
        limit,
        remaining: Math.max(0, limit - 1),
        resetSeconds: windowSeconds,
        points: created.points,
      }
    } catch {
      // Jika terjadi race condition saat create pertama kali, fallback ke pembacaan ulang
      return consumeRateLimit(options)
    }
  }

  // Jika record sudah kedaluwarsa, reset kuota
  if (existing.expireAt <= now) {
    const updated = await prisma.rateLimitRecord.update({
      where: { key },
      data: {
        points: 1,
        expireAt: new Date(now.getTime() + windowMs),
      },
    })
    return {
      allowed: 1 <= limit,
      limit,
      remaining: Math.max(0, limit - 1),
      resetSeconds: windowSeconds,
      points: updated.points,
    }
  }

  // Record masih dalam jendela aktif
  const resetSeconds = Math.max(1, Math.ceil((existing.expireAt.getTime() - now.getTime()) / 1000))

  if (existing.points >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetSeconds,
      points: existing.points,
    }
  }

  // Increment points
  const updated = await prisma.rateLimitRecord.update({
    where: { key },
    data: {
      points: { increment: 1 },
    },
  })

  return {
    allowed: updated.points <= limit,
    limit,
    remaining: Math.max(0, limit - updated.points),
    resetSeconds,
    points: updated.points,
  }
}

export interface RateLimitCheckResult {
  allowed: boolean
  message?: string
  resetSeconds?: number
}

/**
 * Perlindungan checkout tamu meja (multi-tier):
 * 1. Kuota per sesi tamu meja (guestSessionId): maksimal 6 order / 2 menit per sesi meja.
 * 2. Kuota pelindung burst IP bersama kafe: batas longgar 150 request / menit per IP publik Wi-Fi kafe,
 *    sehingga puluhan meja yang berbagi satu IP tidak mengalami false positive blocking.
 */
export async function checkGuestCheckoutRateLimit(
  guestSessionId: string,
  ipAddress?: string
): Promise<RateLimitCheckResult> {
  // Tier 1: Per-Session Gate (Mencegah abuse spamming dari satu peramban meja)
  if (guestSessionId) {
    const sessionRes = await consumeRateLimit({
      key: `guest:checkout:sess:${guestSessionId}`,
      limit: 12,
      windowSeconds: 60, // 1 menit
    })

    if (!sessionRes.allowed) {
      return {
        allowed: false,
        message: 'Terlalu banyak permintaan pemesanan pada sesi meja ini. Silakan tunggu sebentar sebelum mencoba lagi.',
        resetSeconds: sessionRes.resetSeconds,
      }
    }
  }

  // Tier 2: Shared-IP Burst Protection (Mencegah DDoS/flooding skrip luar)
  if (ipAddress && ipAddress !== '127.0.0.1' && ipAddress !== '::1') {
    const ipRes = await consumeRateLimit({
      key: `guest:checkout:ip:${ipAddress}`,
      limit: 150, // Kuota burst sangat longgar untuk menampung seluruh pengunjung kafe
      windowSeconds: 60, // 1 menit
    })

    if (!ipRes.allowed) {
      return {
        allowed: false,
        message: 'Batas lalu lintas jaringan kafe tercapai sementara. Silakan coba kembali dalam beberapa saat.',
        resetSeconds: ipRes.resetSeconds,
      }
    }
  }

  return { allowed: true }
}

/**
 * Perlindungan brute force login staf:
 * Maksimal 15 percobaan login salah dari satu IP dalam jendela 5 menit.
 * Bekerja bersama account-level lockout yang sudah ada di database.
 */
export async function checkStaffLoginRateLimit(ipAddress: string): Promise<RateLimitCheckResult> {
  const cleanIp = ipAddress ? ipAddress.trim() : '127.0.0.1'
  const isLoopback = cleanIp === '127.0.0.1' || cleanIp === '::1'
  const limit = isLoopback ? 100 : 15
  const res = await consumeRateLimit({
    key: `staff:login:ip:${cleanIp}`,
    limit,
    windowSeconds: 300, // 5 menit
  })

  if (!res.allowed) {
    return {
      allowed: false,
      message: `Terlalu banyak percobaan login dari jaringan ini. Silakan coba lagi dalam ${Math.ceil(res.resetSeconds / 60)} menit.`,
      resetSeconds: res.resetSeconds,
    }
  }

  return { allowed: true }
}
