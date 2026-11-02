import { NextRequest, NextResponse } from 'next/server'
import { getCatalogData } from '@/lib/server/menu-service'
import { z } from 'zod'

const MenuQuerySchema = z.object({
  category: z.string().max(50).optional(),
  search: z.string().max(50).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryRaw = searchParams.get('category') ?? undefined
    const searchRaw = searchParams.get('search') ?? undefined

    const parsed = MenuQuerySchema.safeParse({
      category: categoryRaw,
      search: searchRaw,
    })

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Parameter pencarian atau kategori tidak valid.',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      )
    }

    const { category, search } = parsed.data
    const catalogData = await getCatalogData(category, search)

    return NextResponse.json(
      {
        success: true,
        data: catalogData,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    )
  } catch (error) {
    console.error('[API /api/menu] Error fetching menu catalog:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Terjadi kesalahan sistem saat mengambil data katalog menu.',
        },
      },
      { status: 500 }
    )
  }
}

