import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/server/db'
import { getQuizRecommendations } from '@/lib/server/quiz-service'

export const dynamic = 'force-dynamic'

const RecommendationLegacySchema = z.object({
  mood: z.string().optional(),
  flavor: z.string().optional(),
  format: z.string().optional(),
  selectedOptionIds: z.array(z.string()).optional(),
  tableNumber: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Format payload JSON tidak valid.',
          },
        },
        { status: 400 }
      )
    }

    const parsed = RecommendationLegacySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Data preferensi tidak valid.',
          },
        },
        { status: 400 }
      )
    }

    let optionIds = parsed.data.selectedOptionIds || []

    // Jika dipanggil dengan format mood, flavor, format (legacy/spec compatibility)
    if (
      optionIds.length === 0 &&
      (parsed.data.mood || parsed.data.flavor || parsed.data.format)
    ) {
      const slugs = [
        parsed.data.mood,
        parsed.data.flavor,
        parsed.data.format,
      ].filter(Boolean) as string[]

      // Temukan optionId yang berasosiasi dengan tag slugs ini
      const optionTags = await prisma.quizOptionTag.findMany({
        where: {
          tag: {
            slug: {
              in: slugs.map((s) => s.toLowerCase()),
            },
          },
        },
        select: {
          optionId: true,
        },
      })

      optionIds = Array.from(new Set(optionTags.map((ot) => ot.optionId)))
    }

    const recommendations = await getQuizRecommendations(optionIds)

    return NextResponse.json({
      success: true,
      data: recommendations,
    })
  } catch (error) {
    console.error('Recommendations API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengalkulasi rekomendasi menu.',
        },
      },
      { status: 500 }
    )
  }
}

