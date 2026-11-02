import { NextRequest, NextResponse } from 'next/server'
import {
  extractOrderSecretToken,
  verifyOrderAccess,
  OrderAccessError,
} from '@/lib/server/order-access'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params

  try {
    const token = await extractOrderSecretToken(id, req)
    const order = await verifyOrderAccess(id, token)

    return NextResponse.json(
      {
        success: true,
        data: order,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  } catch (err: unknown) {
    if (err instanceof OrderAccessError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        },
        { status: err.statusCode }
      )
    }

    console.error('Unhandled order fetch error:', err)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Akses pesanan tidak diizinkan.',
        },
      },
      { status: 403 }
    )
  }
}

