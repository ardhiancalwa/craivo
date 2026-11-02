import { NextResponse } from 'next/server'
import {
  extractOrderSecretToken,
  verifyOrderAccess,
  OrderAccessError,
} from '@/lib/server/order-access'
import { createSseStream } from '@/lib/server/realtime-bus'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id: orderId } = await params

  // 1. Extract capability token: header, cookie, or fallback query param
  let token = await extractOrderSecretToken(orderId, request)
  if (!token) {
    const url = new URL(request.url)
    const queryToken = url.searchParams.get('token')
    if (queryToken && queryToken.trim()) {
      token = queryToken.trim()
    }
  }

  // 2. Strict authorization: verify order ownership via capability token
  try {
    await verifyOrderAccess(orderId, token)
  } catch (err: unknown) {
    if (err instanceof OrderAccessError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.statusCode }
      )
    }
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Akses pesanan tidak diizinkan.' },
      { status: 403 }
    )
  }

  // 3. Channel is strictly isolated to this single customer order
  return createSseStream({
    request,
    channel: `ORDER:${orderId}`,
    aggregateId: orderId,
  })
}

