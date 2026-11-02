import 'server-only'
import prisma from '@/lib/server/db'
import type { Prisma, OutboxEvent } from '@prisma/client'

export interface PublishEventParams {
  channel: string
  aggregateType?: string
  aggregateId: string
  eventType: string
  payload?: Record<string, unknown>
  tx?: Prisma.TransactionClient
}

/**
 * Publishes a durable event to the outbox_events table in PostgreSQL.
 * Can be executed inside an ongoing Prisma transaction ($transaction) or standalone.
 * Serves as the distributed multi-instance event bus.
 */
export async function publishEvent(params: PublishEventParams): Promise<OutboxEvent> {
  const db = params.tx || prisma
  const aggregateType =
    params.aggregateType ||
    (params.channel.startsWith('ORDER') ? 'ORDER' : params.channel === 'CATALOG' ? 'MENU' : 'ORDER')

  return await db.outboxEvent.create({
    data: {
      channel: params.channel,
      aggregateType,
      aggregateId: params.aggregateId,
      eventType: params.eventType,
      payload: JSON.stringify(params.payload || {}),
    },
  })
}

export interface FetchNewEventsParams {
  channel?: string | string[]
  channels?: string | string[]
  aggregateId?: string
  sinceTime?: Date | null
  sinceId?: string | null
  afterId?: string | null
  limit?: number
}

/**
 * Fetches newly created outbox events for a specific channel/aggregate since a given cursor.
 */
export async function fetchNewEvents(params: FetchNewEventsParams): Promise<OutboxEvent[]> {
  const channelInput = params.channels ?? params.channel
  const channels = channelInput
    ? Array.isArray(channelInput)
      ? channelInput.filter(Boolean)
      : [channelInput]
    : undefined

  let cursorOptions: { cursor?: { id: string }; skip?: number } = {}
  const refId = params.afterId ?? params.sinceId

  if (refId) {
    const exists = await prisma.outboxEvent.findUnique({
      where: { id: refId },
      select: { id: true },
    })
    if (exists) {
      cursorOptions = {
        cursor: { id: refId },
        skip: 1,
      }
    }
  }

  const whereClause: Prisma.OutboxEventWhereInput = {
    ...(channels && channels.length > 0 ? { channel: { in: channels } } : {}),
    ...(params.aggregateId ? { aggregateId: params.aggregateId } : {}),
    ...(!cursorOptions.cursor && params.sinceTime ? { createdAt: { gt: params.sinceTime } } : {}),
  }

  return await prisma.outboxEvent.findMany({
    where: whereClause,
    ...cursorOptions,
    orderBy: { createdAt: 'asc' },
    take: params.limit || 50,
  })
}

export interface SseStreamOptions {
  request: Request
  channel: string | string[]
  aggregateId?: string
  maxDurationMs?: number
  pollIntervalMs?: number
  onFilterEvent?: (event: OutboxEvent) => boolean
}

/**
 * Creates a resilient Server-Sent Events (SSE) Response using standard Web ReadableStream.
 * Handles:
 * 1. Last-Event-ID header and query param recovery
 * 2. Multi-instance event distribution via database polling (1000ms loop -> <= 2s SLA)
 * 3. 10s heartbeat keep-alive (: ping\n\n)
 * 4. Graceful 25s stream lifecycle close (Vercel serverless friendly)
 * 5. Immediate connection cleanup on client abort / tab close
 */
export function createSseStream(options: SseStreamOptions): Response {
  const {
    request,
    channel,
    aggregateId,
    maxDurationMs = 25000, // 25 seconds for graceful Vercel serverless lifecycle
    pollIntervalMs = 1000, // 1 second loop ensures <= 2s latency SLA
    onFilterEvent,
  } = options

  const url = new URL(request.url)
  const headerLastId = request.headers.get('last-event-id')
  const queryLastId = url.searchParams.get('lastEventId')
  const initialLastId = headerLastId || queryLastId || null

  const encoder = new TextEncoder()
  const abortSignal = request.signal

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false
      const startTime = Date.now()
      let lastPingTime = startTime

      // Initialize cursor: start slightly in past if no cursor provided (grace window 5s)
      let lastCheckTime = new Date(Date.now() - 5000)
      let lastSeenId = initialLastId

      if (initialLastId) {
        try {
          const ref = await prisma.outboxEvent.findUnique({
            where: { id: initialLastId },
            select: { createdAt: true },
          })
          if (ref) {
            lastCheckTime = ref.createdAt
          }
        } catch {
          // Keep default fallback
        }
      }

      const safeClose = () => {
        if (!isClosed) {
          isClosed = true
          try {
            controller.close()
          } catch {
            // Already closed
          }
        }
      }

      // Cleanup when client disconnects or aborts
      abortSignal.addEventListener('abort', safeClose)

      // 1. Initial handshake event
      try {
        controller.enqueue(
          encoder.encode(
            `event: connected\ndata: ${JSON.stringify({
              status: 'connected',
              timestamp: new Date().toISOString(),
              channels: Array.isArray(channel) ? channel : [channel],
            })}\n\n`
          )
        )
      } catch {
        safeClose()
        return
      }

      // 2. Stream loop
      const runLoop = async () => {
        while (!isClosed && !abortSignal.aborted) {
          const now = Date.now()

          // Check graceful lifecycle limit (25s)
          if (now - startTime >= maxDurationMs) {
            try {
              controller.enqueue(
                encoder.encode(
                  `event: reconnect\ndata: ${JSON.stringify({
                    reason: 'graceful_lifecycle',
                    lastEventId: lastSeenId,
                    timestamp: new Date().toISOString(),
                  })}\n\n`
                )
              )
            } catch {
              // Ignore
            }
            safeClose()
            break
          }

          // Heartbeat ping every 10 seconds to prevent proxy / NAT timeout
          if (now - lastPingTime >= 10000) {
            try {
              controller.enqueue(encoder.encode(`: ping\n\n`))
              lastPingTime = now
            } catch {
              safeClose()
              break
            }
          }

          // Fetch new events from durable database outbox
          try {
            const events = await fetchNewEvents({
              channel,
              aggregateId,
              sinceTime: lastCheckTime,
              limit: 25,
            })

            if (events.length > 0) {
              for (const event of events) {
                if (isClosed || abortSignal.aborted) break
                if (onFilterEvent && !onFilterEvent(event)) continue

                // Construct canonical SSE message
                const sseMessage = `id: ${event.id}\nevent: ${event.eventType}\ndata: ${event.payload}\n\n`
                controller.enqueue(encoder.encode(sseMessage))

                lastSeenId = event.id
                if (event.createdAt > lastCheckTime) {
                  lastCheckTime = event.createdAt
                }
              }
            }
          } catch (err) {
            console.error('[realtime-bus] Error fetching outbox events:', err)
          }

          // Sleep for pollIntervalMs (1000ms default)
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
        }
      }

      runLoop().catch(() => safeClose())
    },
    cancel() {
      // Called when consumer cancels the stream
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
