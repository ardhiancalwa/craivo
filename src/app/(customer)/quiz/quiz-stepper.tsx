'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { CurationAnalyzingView, type SelectedPreferenceItem } from '@/components/quiz/curation-analyzing-view'
import { RecommendationResults } from './recommendation-results'
import type { QuizQuestionDTO } from '@/lib/server/quiz-service'
import type { RecommendationResponse } from '@/lib/recommendation-engine'

interface QuizStepperProps {
  questions: QuizQuestionDTO[]
  tableNumber: string
}

export function QuizStepper({ questions, tableNumber }: QuizStepperProps) {
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0)
  // Selected option ID per question ID
  const [selectedOptions, setSelectedOptions] = React.useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [pendingResult, setPendingResult] = React.useState<RecommendationResponse | null>(null)
  const [recommendationResult, setRecommendationResult] =
    React.useState<RecommendationResponse | null>(null)

  const currentQuestion = questions[currentStepIndex]
  const totalSteps = questions.length

  // Calculate selected preferences summary
  const selectedPreferences: SelectedPreferenceItem[] = React.useMemo(() => {
    return questions
      .map((q) => {
        const optionId = selectedOptions[q.id]
        const opt = q.options.find((o) => o.id === optionId)
        return {
          dimension: q.dimension,
          questionTitle: q.title,
          optionLabel: opt?.label || '',
        }
      })
      .filter((p) => Boolean(p.optionLabel))
  }, [questions, selectedOptions])

  const handleSelectOption = (questionId: string, optionId: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [questionId]: optionId,
    }))
  }

  const handleNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleResetQuiz = () => {
    setSelectedOptions({})
    setCurrentStepIndex(0)
    setPendingResult(null)
    setRecommendationResult(null)
    setIsLoading(false)
    setErrorMsg(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmitQuiz = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    setPendingResult(null)

    try {
      const selectedOptionIds = Object.values(selectedOptions)

      const res = await fetch('/api/quiz/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedOptionIds,
          tableNumber,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Gagal memproses rekomendasi kuis.')
      }

      setPendingResult(data.data as RecommendationResponse)
    } catch (err: unknown) {
      console.error('Quiz submit failed:', err)
      setErrorMsg(
        err instanceof Error ? err.message : 'Terjadi kendala saat memproses kuis.'
      )
      setIsLoading(false)
    }
  }

  const handleReadyToView = () => {
    if (pendingResult) {
      setRecommendationResult(pendingResult)
      setIsLoading(false)
      setPendingResult(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Tampilan Hasil Rekomendasi (Anti AI Slop)
  if (recommendationResult) {
    return (
      <div className="w-full pb-24 max-w-lg mx-auto">
        <RecommendationResults
          data={recommendationResult}
          tableNumber={tableNumber}
          onResetQuiz={handleResetQuiz}
          selectedPreferences={selectedPreferences}
        />
      </div>
    )
  }

  // Tampilan Loading Komputasi Interaktif (berdasarkan ai-analysis.html)
  if (isLoading) {
    return (
      <div className="w-full max-w-lg mx-auto py-2">
        <CurationAnalyzingView
          tableNumber={tableNumber}
          selectedPreferences={selectedPreferences}
          onReadyToView={handleReadyToView}
          isDataReady={Boolean(pendingResult)}
        />
      </div>
    )
  }

  // Tampilan Error State
  if (errorMsg) {
    return (
      <div className="w-full pb-28 max-w-lg mx-auto py-12">
        <ErrorState
          title="Gagal Memuat Rekomendasi"
          message={errorMsg}
          onRetry={handleSubmitQuiz}
        />
        <div className="mt-4 text-center">
          <Link
            href={`/menu${tableNumber ? `?table=${encodeURIComponent(tableNumber)}` : ''}`}
            className="text-xs text-primary font-semibold hover:underline"
          >
            Buka Katalog Lengkap →
          </Link>
        </div>
      </div>
    )
  }

  // Jika data pertanyaan kuis belum siap
  if (!currentQuestion) {
    return (
      <div className="w-full pb-28 max-w-lg mx-auto py-12">
        <ErrorState
          title="Pertanyaan Kuis Belum Tersedia"
          message="Konfigurasi kuis sedang diselaraskan oleh admin."
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  const isCurrentStepAnswered = Boolean(selectedOptions[currentQuestion.id])
  const isLastStep = currentStepIndex === totalSteps - 1

  return (
    <div className="w-full flex-1 flex flex-col justify-between pb-28 max-w-lg mx-auto min-h-[calc(100dvh-180px)] select-none">
      {/* Header Bar */}
      <div>
        <header className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed border border-primary/20">
              {tableNumber ? `Meja ${tableNumber}` : 'Pilih Meja'}
            </span>
            <span className="text-xs font-bold text-on-surface-variant">
              Langkah {currentStepIndex + 1} dari {totalSteps}
            </span>
          </div>

          {/* Tombol Lewati Kuis: Tersedia pada setiap langkah */}
          <Link
            href={`/menu${tableNumber ? `?table=${encodeURIComponent(tableNumber)}` : ''}`}
            className="text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors touch-target px-2 py-1"
          >
            Lewati Kuis ✕
          </Link>
        </header>

        {/* 3-Segment Progress Bar */}
        <div className="flex gap-2 my-4">
          {questions.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                index <= currentStepIndex
                  ? 'bg-primary'
                  : 'bg-surface-container'
              }`}
            />
          ))}
        </div>

        {/* Question Section */}
        <section className="my-6">
          <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-primary block mb-1">
            {currentQuestion.dimension === 'MOOD' && '1. Suasana Hati (Mood)'}
            {currentQuestion.dimension === 'FLAVOR' && '2. Karakter Rasa (Flavor)'}
            {currentQuestion.dimension === 'FORMAT' && '3. Format & Suhu Sajian (Format)'}
          </span>
          <h1 className="text-xl sm:text-2xl font-sans font-bold text-on-surface leading-snug">
            {currentQuestion.title}
          </h1>
          <p className="text-xs text-on-surface-variant mt-1 mb-6 leading-relaxed">
            {currentQuestion.description}
          </p>

          {/* Options Grid */}
          <div className="space-y-3">
            {currentQuestion.options.map((opt) => {
              const isSelected = selectedOptions[currentQuestion.id] === opt.id

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectOption(currentQuestion.id, opt.id)}
                  className={`touch-target w-full p-4 rounded-2xl text-left flex items-center justify-between gap-3 transition-all ${
                    isSelected
                      ? 'bg-surface-lowest border-2 border-primary shadow-xs'
                      : 'bg-surface-lowest/70 border border-outline-variant/60 hover:border-primary/40 hover:bg-surface-lowest'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="text-2xl select-none shrink-0 w-8 text-center">
                      {opt.icon || '☕'}
                    </span>
                    <div className="min-w-0">
                      <span className="block text-sm font-sans font-bold text-on-surface">
                        {opt.label}
                      </span>
                      <span className="text-xs text-on-surface-variant block mt-0.5 leading-snug">
                        {opt.description}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-outline-variant bg-surface'
                    }`}
                  >
                    {isSelected && (
                      <span className="text-[10px] font-bold leading-none">✓</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      {/* Navigation Footer */}
      <footer className="pt-4 border-t border-outline-variant/60 flex items-center justify-between gap-3">
        {currentStepIndex > 0 ? (
          <Button
            variant="outline"
            size="md"
            onClick={handlePrevStep}
            className="touch-target text-xs font-semibold px-4 rounded-full flex items-center gap-1.5 border-outline-variant"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali</span>
          </Button>
        ) : (
          <Link
            href={`/menu${tableNumber ? `?table=${encodeURIComponent(tableNumber)}` : ''}`}
            className="touch-target px-3 py-2 text-xs text-on-surface-variant hover:text-on-surface font-medium"
          >
            Lihat Menu Lengkap
          </Link>
        )}

        {isLastStep ? (
          <Button
            variant="primary"
            size="md"
            disabled={!isCurrentStepAnswered}
            onClick={handleSubmitQuiz}
            className="touch-target text-xs font-semibold px-6 shadow-xs rounded-full flex items-center gap-1.5"
          >
            <span>Lihat Rekomendasi</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            disabled={!isCurrentStepAnswered}
            onClick={handleNextStep}
            className="touch-target text-xs font-semibold px-6 rounded-full flex items-center gap-1.5"
          >
            <span>Lanjut Langkah {currentStepIndex + 2}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </footer>
    </div>
  )
}
