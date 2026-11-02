import { createSseStream } from '@/lib/server/realtime-bus'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Public catalog stream for real-time stock and price change notifications
  return createSseStream({
    request,
    channel: 'CATALOG',
  })
}

