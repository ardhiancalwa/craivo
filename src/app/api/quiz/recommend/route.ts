import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getQuizRecommendations } from '@/lib/server/quiz-service'

export const dynamic = 'force-dynamic'

const QuizRecommendSchema = z.object({
  selectedOptionIds: z.array(z.string().min(1)).default([]),
  quizVersion: z.number().int().positive().optional(),
  tableNumber: z.string().trim().max(10).optional(),
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
            message: 'Format request JSON tidak valid.',
          },
        },
        { status: 400 }
      )
    }

    const parsed = QuizRecommendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Data pilihan kuis tidak valid.',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      )
    }

    const recommendations = await getQuizRecommendations(
      parsed.data.selectedOptionIds,
      parsed.data.quizVersion
    )

    return NextResponse.json({
      success: true,
      data: recommendations,
    })
  } catch (error) {
    console.error('Quiz recommendation calculation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Terjadi kesalahan saat mengalkulasi rekomendasi menu.',
        },
      },
      { status: 500 }
    )
  }
}

