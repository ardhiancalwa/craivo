import { NextRequest, NextResponse } from 'next/server'
import { validateTableServer } from '@/lib/server/table-service'

interface RouteProps {
  params: Promise<{ tableNumber: string }>
}

export async function GET(request: NextRequest, { params }: RouteProps) {
  try {
    const { tableNumber } = await params
    const result = await validateTableServer(tableNumber)

    if (result.status === 'VALID' && result.table) {
      return NextResponse.json(
        {
          success: true,
          data: {
            table: result.table,
          },
        },
        { status: 200 }
      )
    }

    if (result.status === 'NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TABLE_NOT_FOUND',
            message: result.message,
          },
        },
        { status: 404 }
      )
    }

    if (result.status === 'INACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TABLE_INACTIVE',
            message: result.message,
          },
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: result.message,
        },
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('[API /api/tables/[tableNumber]] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Terjadi kesalahan sistem saat memvalidasi nomor meja.',
        },
      },
      { status: 500 }
    )
  }
}

