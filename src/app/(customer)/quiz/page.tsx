import { cookies } from 'next/headers'
import { getQuizQuestions } from '@/lib/server/quiz-service'
import { QuizStepper } from './quiz-stepper'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ table?: string }>
}

export default async function CustomerQuizPage({ searchParams }: PageProps) {
  const params = await searchParams
  const cookieStore = await cookies()
  const tableCookie = cookieStore.get('cravio_table')?.value

  // Prioritas nomor meja: URL query param -> cookie sesi meja resmi (tanpa fallback diam-diam)
  const tableNumber = params.table?.trim() || tableCookie || ''

  // Ambil pertanyaan kuis langsung dari PostgreSQL via quiz-service
  const quizData = await getQuizQuestions()

  return (
    <div className="bg-cream w-full">
      <QuizStepper questions={quizData.questions} tableNumber={tableNumber} />
    </div>
  )
}
