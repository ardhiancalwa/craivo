import 'server-only'
import prisma from './db'
import { formatJakartaDateTime } from './timezone-utils'

export interface AuditLogFilterParams {
  action?: string
  staffUserId?: string
  page?: number
  limit?: number
}

export interface SanitizedAuditLogItem {
  id: string
  action: string
  details: string | null
  ipAddress: string | null
  createdAtJakarta: string
  staffUser: {
    id: string
    username: string
    displayName: string
    role: string
  } | null
}

export interface SanitizedAuditLogsResponse {
  logs: SanitizedAuditLogItem[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
}

/**
 * Menyensor token, kata sandi, dan kredensial sensitif dari string rincian audit log.
 */
export function sanitizeAuditDetails(detailsStr: string | null): string | null {
  if (!detailsStr) return null

  try {
    const parsed = JSON.parse(detailsStr)

    // Masking rekursif untuk field sensitif
    const maskSensitiveKeys = (obj: unknown): unknown => {
      if (!obj || typeof obj !== 'object') return obj
      if (Array.isArray(obj)) return obj.map(maskSensitiveKeys)

      const result: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        const lowerKey = key.toLowerCase()
        if (
          lowerKey.includes('token') ||
          lowerKey.includes('password') ||
          lowerKey.includes('pin') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('key') ||
          lowerKey.includes('auth')
        ) {
          result[key] = '[REDACTED]'
        } else if (typeof value === 'object' && value !== null) {
          result[key] = maskSensitiveKeys(value)
        } else {
          result[key] = value
        }
      }
      return result
    }

    const sanitized = maskSensitiveKeys(parsed)
    return JSON.stringify(sanitized)
  } catch {
    // Jika bukan JSON valid, gunakan regex masking untuk kata kunci sensitif
    return detailsStr
      .replace(/(["']?(?:secret|token|password|pin|key)["']?\s*[:=]\s*["']?)([^"',\s}]+)(["']?)/gi, '$1[REDACTED]$3')
  }
}

/**
 * Mengambil log audit tersanitasi append-only dari database.
 */
export async function getSanitizedAuditLogs(
  params: AuditLogFilterParams
): Promise<SanitizedAuditLogsResponse> {
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(100, Math.max(1, params.limit || 20))
  const skip = (page - 1) * limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (params.action && params.action !== 'ALL') {
    where.action = params.action
  }

  if (params.staffUserId && params.staffUserId !== 'ALL') {
    where.staffUserId = params.staffUserId
  }

  const [totalCount, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        staffUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
  ])

  const sanitizedLogs: SanitizedAuditLogItem[] = logs.map((log) => ({
    id: log.id,
    action: log.action,
    details: sanitizeAuditDetails(log.details),
    ipAddress: log.ipAddress,
    createdAtJakarta: formatJakartaDateTime(log.createdAt),
    staffUser: log.staffUser
      ? {
          id: log.staffUser.id,
          username: log.staffUser.username,
          displayName: log.staffUser.displayName,
          role: log.staffUser.role,
        }
      : null,
  }))

  return {
    logs: sanitizedLogs,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  }
}

