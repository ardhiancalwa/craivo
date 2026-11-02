import { describe, it, expect, vi } from 'vitest'
import { sanitizeContext, formatLog, logger } from '../../src/lib/server/logger'

describe('Structured JSON Logger (src/lib/server/logger.ts)', () => {
  it('correctly formats basic info log in valid JSON', () => {
    const raw = formatLog('info', 'TEST_EVENT', { sampleKey: 'sampleValue' }, 'corr-123')
    const parsed = JSON.parse(raw)

    expect(parsed.level).toBe('info')
    expect(parsed.event).toBe('TEST_EVENT')
    expect(parsed.correlationId).toBe('corr-123')
    expect(parsed.context.sampleKey).toBe('sampleValue')
    expect(parsed.timestamp).toBeDefined()
  })

  it('redacts sensitive fields recursively', () => {
    const sensitivePayload = {
      orderId: 'ORD-123',
      customerName: 'Budi',
      password: 'super-secret-password',
      nested: {
        serverKey: 'SB-Mid-server-secret',
        jwtToken: 'eyJhbGciOi...',
        userPin: '123456',
        publicNote: 'Extra caramel please',
      },
      tokensArray: [
        { authHeader: 'Bearer 12345' },
        { safeId: 'abc' },
      ],
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitized = sanitizeContext(sensitivePayload) as any

    expect(sanitized.orderId).toBe('ORD-123')
    expect(sanitized.customerName).toBe('Budi')
    expect(sanitized.password).toBe('[REDACTED]')
    expect(sanitized.nested.serverKey).toBe('[REDACTED]')
    expect(sanitized.nested.jwtToken).toBe('[REDACTED]')
    expect(sanitized.nested.userPin).toBe('[REDACTED]')
    expect(sanitized.nested.publicNote).toBe('Extra caramel please')
    expect(sanitized.tokensArray[0].authHeader).toBe('[REDACTED]')
    expect(sanitized.tokensArray[1].safeId).toBe('abc')
  })

  it('formats Error instances correctly', () => {
    const err = new Error('Database connection timed out')
    const raw = formatLog('error', 'DB_ERROR', err, 'corr-err-456')
    const parsed = JSON.parse(raw)

    expect(parsed.level).toBe('error')
    expect(parsed.event).toBe('DB_ERROR')
    expect(parsed.correlationId).toBe('corr-err-456')
    expect(parsed.error.message).toBe('Database connection timed out')
  })

  it('logs to console methods with valid JSON strings', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    logger.info('SERVER_BOOT', { port: 3000 }, 'corr-boot')

    expect(spy).toHaveBeenCalled()
    const firstCall = spy.mock.calls[0]
    expect(firstCall).toBeDefined()
    const callArg = firstCall![0]
    const parsed = JSON.parse(callArg)
    expect(parsed.event).toBe('SERVER_BOOT')
    expect(parsed.correlationId).toBe('corr-boot')
    spy.mockRestore()
  })

  it('provides withCorrelation helper', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const scopedLogger = logger.withCorrelation('scoped-id-789')
    scopedLogger.warn('STOCK_LOW', { itemId: 'item-1' })

    expect(spy).toHaveBeenCalled()
    const firstCall = spy.mock.calls[0]
    expect(firstCall).toBeDefined()
    const parsed = JSON.parse(firstCall![0])
    expect(parsed.correlationId).toBe('scoped-id-789')
    expect(parsed.event).toBe('STOCK_LOW')
    spy.mockRestore()
  })
})

