'use client'

import * as React from 'react'

export type StreamConnectionStatus =
  | 'CONNECTED'
  | 'CONNECTING'
  | 'STALE'
  | 'DEGRADED_POLLING'
  | 'OFFLINE'

export interface RealtimeStreamOptions {
  url: string
  enabled?: boolean
  onEvent?: (eventType: string, data: Record<string, unknown>, eventId: string) => void
  onReconnectSync?: () => Promise<void> | void
  fallbackPollIntervalMs?: number
}

export function useRealtimeStream(options: RealtimeStreamOptions) {
  const {
    url,
    enabled = true,
    onEvent,
    onReconnectSync,
    fallbackPollIntervalMs = 10000,
  } = options

  const [connectionStatus, setConnectionStatus] = React.useState<StreamConnectionStatus>('CONNECTING')
  const [lastEventId, setLastEventId] = React.useState<string | null>(null)

  const eventSourceRef = React.useRef<EventSource | null>(null)
  const retryCountRef = React.useRef<number>(0)
  const lastActivityRef = React.useRef<number>(Date.now())
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const watchdogIntervalRef = React.useRef<NodeJS.Timeout | null>(null)
  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null)

  // Stable references for callbacks
  const onEventRef = React.useRef(onEvent)
  onEventRef.current = onEvent

  const onReconnectSyncRef = React.useRef(onReconnectSync)
  onReconnectSyncRef.current = onReconnectSync

  // Establish SSE connection
  const connect = React.useCallback(() => {
    if (!enabled || typeof window === 'undefined') return

    // If browser is offline according to navigator
    if (!navigator.onLine) {
      setConnectionStatus('OFFLINE')
      return
    }

    // Cleanup existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setConnectionStatus('CONNECTING')

    // Append lastEventId to URL if present for query param fallback
    let streamUrl = url
    if (lastEventId) {
      const sep = streamUrl.includes('?') ? '&' : '?'
      streamUrl = `${streamUrl}${sep}lastEventId=${encodeURIComponent(lastEventId)}`
    }

    try {
      const es = new EventSource(streamUrl, { withCredentials: true })
      eventSourceRef.current = es

      es.onopen = () => {
        retryCountRef.current = 0
        lastActivityRef.current = Date.now()
        setConnectionStatus('CONNECTED')

        // Clear fallback polling if active
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }

      // Handle custom events dispatch
      const handleGenericMessage = (type: string, ev: MessageEvent) => {
        lastActivityRef.current = Date.now()
        if (ev.lastEventId) {
          setLastEventId(ev.lastEventId)
        }

        try {
          const parsed = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
          if (onEventRef.current) {
            onEventRef.current(type, parsed, ev.lastEventId || '')
          }
        } catch {
          // Non-JSON message
        }
      }

      // General messages
      es.onmessage = (e) => {
        handleGenericMessage('message', e)
      }

      // Connected handshake event
      es.addEventListener('connected', () => {
        lastActivityRef.current = Date.now()
        setConnectionStatus('CONNECTED')
      })

      // Graceful server reconnect request
      es.addEventListener('reconnect', () => {
        lastActivityRef.current = Date.now()
        if (es.readyState !== EventSource.CLOSED) {
          es.close()
        }
        // Immediate reconnect for next 25s window
        connect()
      })

      // Domain event listeners
      const domainEvents = [
        'ORDER_PAID',
        'ORDER_STATUS_CHANGED',
        'ORDER_CANCELLED',
        'NEW_CASH_ORDER',
        'PAYMENT_CONFIRMED',
        'STOCK_TOGGLED',
        'PRICE_CHANGED',
      ]

      domainEvents.forEach((eventName) => {
        es.addEventListener(eventName, (e) => {
          handleGenericMessage(eventName, e as MessageEvent)
        })
      })

      es.onerror = () => {
        es.close()
        eventSourceRef.current = null
        retryCountRef.current += 1

        if (retryCountRef.current >= 3) {
          // Switch to degraded fallback polling
          setConnectionStatus('DEGRADED_POLLING')
          if (!pollingIntervalRef.current && onReconnectSyncRef.current) {
            // Immediately run sync once, then interval
            onReconnectSyncRef.current()
            pollingIntervalRef.current = setInterval(() => {
              if (onReconnectSyncRef.current) {
                onReconnectSyncRef.current()
              }
            }, fallbackPollIntervalMs)
          }

          // Still attempt to reconnect SSE with slow backoff (15s)
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, 15000)
        } else {
          setConnectionStatus('CONNECTING')
          // Exponential backoff: 500ms, 1000ms, 2000ms
          const backoff = Math.min(5000, 500 * Math.pow(2, retryCountRef.current))
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, backoff)
        }
      }
    } catch (err) {
      console.error('Failed to instantiate EventSource:', err)
      setConnectionStatus('DEGRADED_POLLING')
    }
  }, [enabled, url, lastEventId, fallbackPollIntervalMs])

  // Watchdog timer: checks every 5 seconds if connection is STALE (> 20s without ping)
  React.useEffect(() => {
    watchdogIntervalRef.current = setInterval(() => {
      if (connectionStatus === 'CONNECTED') {
        const timeSinceActivity = Date.now() - lastActivityRef.current
        if (timeSinceActivity > 22000) {
          setConnectionStatus('STALE')
          if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
          }
          connect()
        }
      }
    }, 5000)

    return () => {
      if (watchdogIntervalRef.current) {
        clearInterval(watchdogIntervalRef.current)
      }
    }
  }, [connectionStatus, connect])

  // Visibility Change / Tab Focus Handling: Anti-Gap Snapshot Reconciliation
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab brought to foreground: immediately sync snapshot via REST API
        if (onReconnectSyncRef.current) {
          onReconnectSyncRef.current()
        }

        // If stream is disconnected or stale, reconnect immediately
        if (connectionStatus !== 'CONNECTED') {
          connect()
        }
      }
    }

    const handleOnline = () => {
      setConnectionStatus('CONNECTING')
      connect()
    }

    const handleOffline = () => {
      setConnectionStatus('OFFLINE')
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [connectionStatus, connect])

  // Initial connect on mount
  React.useEffect(() => {
    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [connect])

  return {
    connectionStatus,
    lastEventId,
    isDegraded: connectionStatus === 'DEGRADED_POLLING',
    reconnect: connect,
  }
}
