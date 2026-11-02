import 'server-only'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /pin/i,
  /(^|_)?token$/i,
  /token_/i,
  /secret/i,
  /(api|server|client|private|secret|auth)_?key/i,
  /^key$/i,
  /authorization/i,
  /auth_?header/i,
  /cookie/i,
  /signature/i,
  /jwt/i,
  /credit_?card/i,
  /\bcvv\b/i,
  /\bcvc\b/i,
]

/**
 * Rekursif menyamarkan nilai field sensitif agar tidak bocor ke log produksi atau third-party drain.
 */
export function sanitizeContext(data: unknown, depth = 0, seen = new WeakSet()): unknown {
  if (depth > 6) return '[MAX_DEPTH]'
  if (data === null || data === undefined) return data
  if (typeof data !== 'object') return data

  if (seen.has(data as object)) return '[CIRCULAR]'
  seen.add(data as object)

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeContext(item, depth + 1, seen))
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
    if (isSensitive) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeContext(value, depth + 1, seen)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

export interface StructuredLogPayload {
  timestamp: string
  level: LogLevel
  event: string
  correlationId?: string
  context?: Record<string, unknown>
  error?: {
    name?: string
    message: string
    stack?: string
  }
}

export function formatLog(
  level: LogLevel,
  event: string,
  contextOrError?: unknown,
  correlationId?: string
): string {
  const timestamp = new Date().toISOString()
  const payload: StructuredLogPayload = {
    timestamp,
    level,
    event,
  }

  if (correlationId) {
    payload.correlationId = correlationId
  }

  if (contextOrError instanceof Error) {
    payload.error = {
      name: contextOrError.name,
      message: contextOrError.message,
      stack: process.env.NODE_ENV !== 'production' ? contextOrError.stack : undefined,
    }
  } else if (typeof contextOrError === 'object' && contextOrError !== null) {
    payload.context = sanitizeContext(contextOrError) as Record<string, unknown>
  } else if (contextOrError !== undefined) {
    payload.context = { message: String(contextOrError) }
  }

  return JSON.stringify(payload)
}

export const logger = {
  debug(event: string, context?: unknown, correlationId?: string) {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
      console.debug(formatLog('debug', event, context, correlationId))
    }
  },

  info(event: string, context?: unknown, correlationId?: string) {
    console.info(formatLog('info', event, context, correlationId))
  },

  warn(event: string, context?: unknown, correlationId?: string) {
    console.warn(formatLog('warn', event, context, correlationId))
  },

  error(event: string, contextOrError?: unknown, correlationId?: string) {
    console.error(formatLog('error', event, contextOrError, correlationId))
  },

  withCorrelation(correlationId: string) {
    return {
      debug: (event: string, context?: unknown) => logger.debug(event, context, correlationId),
      info: (event: string, context?: unknown) => logger.info(event, context, correlationId),
      warn: (event: string, context?: unknown) => logger.warn(event, context, correlationId),
      error: (event: string, contextOrError?: unknown) => logger.error(event, contextOrError, correlationId),
    }
  },
}
