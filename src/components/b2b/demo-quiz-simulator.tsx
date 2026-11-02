'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  RotateCcw,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import {
  DEMO_QUIZ_STEPS,
  DEMO_TAGS,
  calculateDemoRecommendation,
  type DemoRecommendationResult,
} from './demo-menu-dataset'
import { cn, formatIDR } from '@/lib/utils'

export function DemoQuizSimulator() {
  const [currentStepIndex, setCurrentStepIndex] = React.useState<number>(0)
  const [selectedMood, setSelectedMood] = React.useState<string | undefined>(undefined)
  const [selectedFlavor, setSelectedFlavor] = React.useState<string | undefined>(undefined)
  const [selectedFormat, setSelectedFormat] = React.useState<string | undefined>(undefined)
  const [recommendationResult, setRecommendationResult] =
    React.useState<DemoRecommendationResult | null>(null)

  const currentStep = DEMO_QUIZ_STEPS[currentStepIndex]
  const isFinished = currentStepIndex >= DEMO_QUIZ_STEPS.length

  const handleSelectOption = (tagSlug: string) => {
    if (currentStepIndex === 0) {
      setSelectedMood(tagSlug)
      setTimeout(() => setCurrentStepIndex(1), 180)
    } else if (currentStepIndex === 1) {
      setSelectedFlavor(tagSlug)
      setTimeout(() => setCurrentStepIndex(2), 180)
    } else if (currentStepIndex === 2) {
      setSelectedFormat(tagSlug)

      setTimeout(() => {
        const result = calculateDemoRecommendation(selectedMood, selectedFlavor, tagSlug)
        setRecommendationResult(result)
        setCurrentStepIndex(3)
      }, 200)
    }
  }

  const handleStepBack = () => {
    if (currentStepIndex === 3) {
      setCurrentStepIndex(2)
      setRecommendationResult(null)
    } else if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1)
    }
  }

  const handleReset = () => {
    setCurrentStepIndex(0)
    setSelectedMood(undefined)
    setSelectedFlavor(undefined)
    setSelectedFormat(undefined)
    setRecommendationResult(null)
  }

  const getCurrentSelection = () => {
    if (currentStepIndex === 0) return selectedMood
    if (currentStepIndex === 1) return selectedFlavor
    if (currentStepIndex === 2) return selectedFormat
    return undefined
  }

  const progressRatio = isFinished
    ? 100
    : Math.round(((currentStepIndex + 1) / DEMO_QUIZ_STEPS.length) * 100)

  const chosenSummary = [selectedMood, selectedFlavor, selectedFormat]
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => DEMO_TAGS[slug]?.name || slug)

  return (
    <div
      role="region"
      aria-label="Simulasi kuis preferensi menu tiga langkah"
      data-testid="demo-quiz-simulator"
      className="w-full rounded-3xl border border-sand-200/90 bg-[#FAF8F5] shadow-xs p-6 sm:p-8 space-y-6"
    >
      {/* Top Header Widget Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200/80 pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-terracotta-600 font-mono">
            Widget Demonstrasi
          </span>
          <h3 className="font-display text-base font-semibold text-charcoal-950">
            Simulasi Kuis &amp; Rekomendasi Meja 07
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-medium bg-white text-stone-700 border border-sand-200 shadow-2xs flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Simulasi / Interactive Preview · Cravio
          </span>
        </div>
      </div>

      {/* Step Breadcrumb Progress: Suasana -> Rasa -> Format/Suhu */}
      <div className="rounded-2xl border border-sand-200/80 bg-white p-4 space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2 text-xs">
          <ol className="flex flex-wrap items-center gap-2" aria-label="Tahapan kuis">
            {DEMO_QUIZ_STEPS.map((step, idx) => {
              const isCurrent = !isFinished && idx === currentStepIndex
              const isCompleted = isFinished || idx < currentStepIndex
              return (
                <li key={step.stepNumber} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs transition-colors',
                      isCurrent
                        ? 'font-bold text-terracotta-600'
                        : isCompleted
                          ? 'font-medium text-charcoal-950'
                          : 'text-stone-400'
                    )}
                  >
                    <span className="font-mono text-[11px] tabular-nums">
                      0{step.stepNumber}
                    </span>
                    <span>{step.shortName}</span>
                  </span>
                  {idx < DEMO_QUIZ_STEPS.length - 1 && (
                    <span aria-hidden="true" className="text-stone-300">
                      →
                    </span>
                  )}
                </li>
              )
            })}
          </ol>

          <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-terracotta-600">
            {isFinished ? 'Selesai' : `Langkah ${currentStepIndex + 1}/${DEMO_QUIZ_STEPS.length}`}
          </span>
        </div>

        <div
          aria-hidden="true"
          className="h-1.5 w-full overflow-hidden bg-sand-100 rounded-full"
        >
          <motion.div
            className="h-full bg-terracotta-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressRatio}%` }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* Interactive Stage Body with Framer Motion Entrance */}
      <div className="min-h-[340px] flex flex-col justify-between">
        {!isFinished && currentStep && (
          <motion.div
            key={currentStep.stepNumber}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
                {currentStep.subtitle}
              </p>
              <h3 className="font-display text-lg sm:text-xl font-bold tracking-tight text-charcoal-950">
                {currentStep.title}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentStep.options.map((opt, idx) => {
                const isSelected = getCurrentSelection() === opt.tagSlug
                return (
                  <motion.button
                    key={opt.id}
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectOption(opt.tagSlug)}
                    aria-pressed={isSelected}
                    className={cn(
                      'touch-target group flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 cursor-pointer',
                      isSelected
                        ? 'border-charcoal-950 bg-charcoal-950 text-white shadow-md'
                        : 'border-sand-200/80 bg-white text-stone-700 hover:border-sand-300 hover:bg-[#FDFBF7] shadow-2xs'
                    )}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'font-mono text-xs tabular-nums',
                            isSelected ? 'text-amber-300' : 'text-stone-400'
                          )}
                        >
                          0{idx + 1}
                        </span>
                        <span
                          className={cn(
                            'text-sm font-semibold tracking-tight',
                            isSelected ? 'text-white' : 'text-charcoal-950'
                          )}
                        >
                          {opt.label.trim()}
                        </span>
                      </div>
                      <p
                        className={cn(
                          'pl-5 text-xs leading-snug',
                          isSelected ? 'text-stone-300' : 'text-stone-500'
                        )}
                      >
                        {opt.hint}
                      </p>
                    </div>

                    <ChevronRight
                      aria-hidden="true"
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5',
                        isSelected ? 'text-amber-300' : 'text-stone-400'
                      )}
                    />
                  </motion.button>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-sand-200/80 text-xs text-stone-500">
              {currentStepIndex > 0 ? (
                <button
                  type="button"
                  onClick={handleStepBack}
                  className="touch-target inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-charcoal-950 hover:bg-sand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Langkah sebelumnya</span>
                </button>
              ) : (
                <span>Pilih satu preferensi untuk lanjut ke langkah berikutnya.</span>
              )}

              {chosenSummary.length > 0 && (
                <span className="hidden sm:inline font-mono text-[11px] text-stone-500">
                  Pilihan: {chosenSummary.join(' · ')}
                </span>
              )}
            </div>
          </motion.div>
        )}

        {isFinished && recommendationResult && (
          <motion.div
            key="result-stage"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            {/* Card Hasil Rekomendasi Terpilih */}
            <div className="p-5 sm:p-7 rounded-3xl bg-white border border-sand-200/80 shadow-[0_10px_30px_rgba(0,0,0,0.03)] space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-100 pb-3.5">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-terracotta-600 block font-mono">
                    Hasil Rekomendasi Contoh
                  </span>
                  <h4 className="font-display text-base sm:text-lg font-semibold text-charcoal-950">
                    Kecocokan berdasarkan jawaban simulasi
                  </h4>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 font-mono flex items-center gap-1.5 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {recommendationResult.matchScore >= 5 ? '98% Cocok' : '94% Cocok'}
                </span>
              </div>

              {/* Primary Recommended Item */}
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#FAF8F5] to-white border border-sand-200/80 space-y-3.5 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="font-display text-lg sm:text-xl font-bold text-charcoal-950 tracking-tight">
                        {recommendationResult.hero.name}
                      </h5>
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-charcoal-950 text-white tracking-wide">
                        Rekomendasi Utama
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
                      {recommendationResult.hero.description}
                    </p>
                  </div>
                  <span className="text-base sm:text-lg font-bold tabular-nums text-terracotta-600 shrink-0 font-mono">
                    {formatIDR(recommendationResult.hero.price)}
                  </span>
                </div>

                {/* Tactile Tag Pills - No bullet dots */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-sand-200/60">
                  {recommendationResult.hero.tags.map((t) => (
                    <span
                      key={t.id}
                      className="text-xs font-medium rounded-full px-3 py-1 bg-white text-stone-700 border border-sand-200 shadow-2xs"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Secondary Alternatives */}
              {recommendationResult.alternatives.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-stone-500 font-semibold block">
                    Alternatif Lain yang Sesuai:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {recommendationResult.alternatives.map((alt) => (
                      <div
                        key={alt.id}
                        className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-sand-200/80 flex items-center justify-between gap-3 shadow-2xs hover:bg-white hover:border-sand-300 transition-all"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <span className="block truncate text-xs sm:text-sm font-semibold text-charcoal-950 font-display">
                            {alt.name}
                          </span>
                          <span className="text-[11px] text-stone-500 font-mono">
                            {alt.category}
                          </span>
                        </div>
                        <span className="text-xs sm:text-sm font-mono font-semibold text-stone-800 tabular-nums shrink-0">
                          {formatIDR(alt.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleStepBack}
                className="touch-target inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-stone-600 hover:text-charcoal-950 hover:bg-sand-100 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Ubah preferensi terakhir</span>
              </button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleReset}
                className="touch-target inline-flex items-center justify-center gap-2 rounded-full border border-charcoal-950 bg-charcoal-950 hover:bg-charcoal-800 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 text-stone-300" aria-hidden="true" />
                <span>Ulangi Simulasi Kuis</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
