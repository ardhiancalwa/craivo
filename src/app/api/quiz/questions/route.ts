import { NextResponse } from 'next/server'
import { getQuizQuestions } from '@/lib/server/quiz-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { quizVersion, questions } = await getQuizQuestions()

    return NextResponse.json({
      success: true,
      data: {
        quizVersion,
        questions,
      },
    })
  } catch (error) {
    console.error('Failed to fetch quiz questions:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal memuat pertanyaan kuis. Silakan coba sesaat lagi.',
        },
      },
      { status: 500 }
    )
  }
}

