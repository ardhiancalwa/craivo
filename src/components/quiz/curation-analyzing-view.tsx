'use client'

import * as React from 'react'
import Link from 'next/link'
import { Sparkles, Check, ArrowRight, Lightbulb } from 'lucide-react'

export interface SelectedPreferenceItem {
  dimension: string
  questionTitle: string
  optionLabel: string
}

interface CurationAnalyzingViewProps {
  tableNumber: string
  selectedPreferences: SelectedPreferenceItem[]
  onReadyToView: () => void
  isDataReady: boolean
}

export function CurationAnalyzingView({
  tableNumber,
  selectedPreferences,
  onReadyToView,
  isDataReady,
}: CurationAnalyzingViewProps) {
  const [progress, setProgress] = React.useState(35)
  const [stageIndex, setStageIndex] = React.useState(0)

  // Extract selected mood and flavor for personalized chips
  const moodPref = selectedPreferences.find(
    (p) => p.dimension === 'MOOD' || p.questionTitle.toLowerCase().includes('suasana') || p.questionTitle.toLowerCase().includes('mood')
  )
  const flavorPref = selectedPreferences.find(
    (p) => p.dimension === 'FLAVOR' || p.questionTitle.toLowerCase().includes('rasa') || p.questionTitle.toLowerCase().includes('selera')
  )

  const steps = [
    'Mengecek ketersediaan bahan & racikan barista...',
    'Menyusun rasio ekstraksi & profil suhu penyajian...',
    tableNumber ? `Rekomendasi siap disajikan di Meja ${tableNumber}!` : 'Rekomendasi racikan siap disajikan!',
  ]

  React.useEffect(() => {
    // Smooth progress animation over ~1.6 - 2.0 seconds
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 90) {
          const next = prev + Math.floor(Math.random() * 8) + 4
          if (next > 65 && stageIndex === 0) {
            setStageIndex(1)
          }
          return Math.min(next, 90)
        }
        // If data is ready from server, push to 100%
        if (isDataReady) {
          setStageIndex(2)
          return 100
        }
        return prev
      })
    }, 160)

    return () => clearInterval(interval)
  }, [isDataReady, stageIndex])

  // When both progress hits 100% and data is ready, trigger completion or enable button
  React.useEffect(() => {
    if (progress >= 100 && isDataReady) {
      setStageIndex(2)
      const timer = setTimeout(() => {
        onReadyToView()
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [progress, isDataReady, onReadyToView])

  return (
    <div className="w-full flex flex-col relative select-none pb-12 animate-fade-in">
      {/* Interactive Orbit Canvas Area */}
      <div className="relative w-full h-[380px] sm:h-[440px] flex items-center justify-center overflow-hidden rounded-2xl bg-surface-low border border-outline-variant/40">
        {/* Warm Ambient Radial Halos */}
        <div className="absolute w-72 h-72 rounded-full bg-primary-fixed/40 blur-3xl pointer-events-none transform -translate-y-4" />
        <div className="absolute w-60 h-60 rounded-full bg-surface-container/60 blur-2xl pointer-events-none transform translate-y-12" />

        {/* Orbiting / Floating Flavor Sprites (from ai-analysis.html) */}
        {/* 1. Green Cloud / Citrus Herb Sprite (Top Left) */}
        <div className="absolute top-6 left-6 sm:left-10 animate-[bounce_4.5s_infinite_ease-in-out] cursor-pointer transform hover:scale-110 transition-transform">
          <svg className="drop-shadow-sm" fill="none" height="48" viewBox="0 0 68 56" width="58">
            <path
              d="M22 10C24 4 32 3 37 6C42 1 50 3 53 9C60 11 65 18 63 26C66 34 60 44 51 46C48 51 40 53 34 50C29 54 20 52 16 47C9 46 4 39 6 31C1 23 8 13 17 12C18 7 20 5 22 10Z"
              fill="#10B981"
            />
            <circle cx="30" cy="28" fill="#FBF9F5" r="2.8" />
            <circle cx="38" cy="27" fill="#FBF9F5" r="2.8" />
          </svg>
        </div>

        {/* 2. Vibrant Magenta / Berry Blossom Bubble (Top Right) */}
        <div className="absolute top-5 right-6 sm:right-10 animate-[pulse_3.8s_infinite_ease-in-out] cursor-pointer transform hover:scale-110 transition-transform">
          <svg className="drop-shadow-sm" fill="none" height="48" viewBox="0 0 58 58" width="48">
            <circle cx="29" cy="29" fill="#F43F5E" r="27" />
            <ellipse cx="37" cy="24" fill="#FBF9F5" rx="2.5" ry="3.5" />
            <ellipse cx="43" cy="26" fill="#FBF9F5" rx="1.8" ry="2.6" />
          </svg>
        </div>

        {/* 3. Violet / Plum Aroma Pebble (Mid Left) */}
        <div className="absolute top-36 left-2 sm:left-4 animate-[pulse_4.2s_infinite_ease-in-out] cursor-pointer transform hover:scale-110 transition-transform">
          <svg className="drop-shadow-sm" fill="none" height="50" viewBox="0 0 54 62" width="44">
            <path
              d="M12 10C26 -2 46 6 50 22C54 38 42 56 26 59C10 62 -2 46 1 30C3 18 6 15 12 10Z"
              fill="#8B5CF6"
            />
            <ellipse cx="22" cy="28" fill="#FBF9F5" rx="2.4" ry="4.2" transform="rotate(-15 22 28)" />
            <ellipse cx="29" cy="30" fill="#FBF9F5" rx="2.2" ry="4" transform="rotate(-15 29 30)" />
          </svg>
        </div>

        {/* 4. Deep Espresso Terracotta Droplet (Mid Right) */}
        <div className="absolute top-32 right-3 sm:right-6 animate-[bounce_5s_infinite_ease-in-out] cursor-pointer transform hover:scale-110 transition-transform">
          <svg className="drop-shadow-sm" fill="none" height="48" viewBox="0 0 56 56" width="48">
            <path
              d="M8 20C12 7 32 3 44 11C54 18 56 36 47 47C37 57 18 55 9 44C0 34 3 27 8 20Z"
              fill="#924805"
            />
            <ellipse cx="28" cy="33" fill="#FBF9F5" rx="2.6" ry="5.2" transform="rotate(25 28 33)" />
            <ellipse cx="36" cy="37" fill="#FBF9F5" rx="2.4" ry="4.8" transform="rotate(25 36 37)" />
          </svg>
        </div>

        {/* 5. Sunlit Mandarin Citrus Wedge (Lower Left) */}
        <div className="absolute bottom-16 left-3 sm:left-6 animate-[bounce_4.8s_infinite_ease-in-out] cursor-pointer transform hover:scale-110 transition-transform">
          <svg className="drop-shadow-sm" fill="none" height="52" viewBox="0 0 50 64" width="40">
            <path
              d="M2 18C12 3 36 6 44 20C50 31 48 48 38 58C27 68 8 62 3 48C-2 35 0 25 2 18Z"
              fill="#F97316"
            />
            <ellipse cx="14" cy="36" fill="#FBF9F5" rx="2.4" ry="4.5" transform="rotate(-20 14 36)" />
            <ellipse cx="20" cy="40" fill="#FBF9F5" rx="1.8" ry="3.8" transform="rotate(-20 20 40)" />
          </svg>
        </div>

        {/* 6. Teal Wave / Spritz (Lower Right) */}
        <div className="absolute bottom-14 right-4 sm:right-8 animate-[bounce_4.1s_infinite_ease-in-out] cursor-pointer transform hover:scale-110 transition-transform">
          <svg className="drop-shadow-sm" fill="none" height="44" viewBox="0 0 52 52" width="44">
            <path
              d="M10 14C17 4 37 4 44 14C51 24 49 41 38 48C26 55 11 48 5 37C-1 25 3 19 10 14Z"
              fill="#0D9488"
            />
            <ellipse cx="28" cy="27" fill="#FBF9F5" rx="2.6" ry="4.6" transform="rotate(22 28 27)" />
            <ellipse cx="36" cy="30" fill="#FBF9F5" rx="2.2" ry="4" transform="rotate(22 36 30)" />
          </svg>
        </div>

        {/* Central Focal Typography Block */}
        <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-xs pointer-events-none">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-on-surface mb-3 shadow-xs border border-outline-variant/60">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span className="text-[11px] font-sans font-semibold tracking-wide uppercase text-primary">
              AI Barista Cravio
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-sans font-bold text-on-surface tracking-tight mb-1.5">
            Meracik Pilihan
          </h1>
          <p className="text-xs sm:text-sm font-sans text-on-surface-variant max-w-[240px] leading-relaxed">
            {moodPref?.optionLabel
              ? `Menyelaraskan suasana ${moodPref.optionLabel} dengan racikan segar untuk Anda.`
              : 'Menyelaraskan profil rasa dan racikan terbaik sesuai pilihan Anda.'}
          </p>
        </div>
      </div>

      {/* Realtime Dynamic Ticker & Status Card */}
      <div className="flex flex-col gap-3 -mt-6 relative z-20 px-2 sm:px-3">
        {/* Active Stage Ticker Card */}
        <div className="bg-surface-lowest rounded-2xl p-4 sm:p-5 shadow-sm border border-outline-variant/60 flex flex-col gap-3">
          {/* Progress Bar & Counter */}
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-sans font-semibold text-on-surface flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <span>{tableNumber ? `Kurasi Biji & Suhu Meja ${tableNumber}` : 'Kurasi Biji & Racikan'}</span>
            </span>
            <span className="font-price-tabular text-sm font-bold text-primary tabular-nums">
              {progress}%
            </span>
          </div>

          {/* Animated Progress Bar Track */}
          <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Analysis Step Chips */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center gap-2 text-on-surface">
              <span className="w-4 h-4 rounded-full bg-primary-fixed flex items-center justify-center text-primary text-[10px] font-bold">
                <Check className="w-2.5 h-2.5" />
              </span>
              <span className="text-xs text-on-surface">
                Mood terdeteksi:{' '}
                <strong className="text-on-surface font-semibold">
                  {moodPref?.optionLabel || 'Santai & Nyaman'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2 text-on-surface">
              <span className="w-4 h-4 rounded-full bg-primary-fixed flex items-center justify-center text-primary text-[10px] font-bold">
                <Check className="w-2.5 h-2.5" />
              </span>
              <span className="text-xs text-on-surface">
                Profil rasa:{' '}
                <strong className="text-on-surface font-semibold">
                  {flavorPref?.optionLabel || 'Segar & Kaya Rasa'}
                </strong>
              </span>
            </div>

            <div className={`flex items-center gap-2 ${stageIndex < 2 ? 'text-primary animate-pulse' : 'text-status-paid'}`}>
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  stageIndex < 2 ? 'bg-primary-fixed text-primary' : 'bg-status-paid/15 text-status-paid'
                }`}
              >
                {stageIndex < 2 ? '●' : <Check className="w-2.5 h-2.5" />}
              </span>
              <span className="text-xs font-medium">
                {steps[stageIndex]}
              </span>
            </div>
          </div>
        </div>

        {/* Editorial Barista Note */}
        <div className="bg-surface-low rounded-xl p-3 flex items-start gap-2.5 border border-outline-variant/40">
          <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Setiap racikan menu diselaraskan dengan biji kopi pilihan dan takaran presisi untuk menghadirkan cita rasa yang seimbang bagi kunjungan Anda.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={onReadyToView}
            className={`w-full h-12 rounded-full flex items-center justify-center gap-2 font-sans text-sm font-semibold shadow-xs transition-all active:scale-[0.98] ${
              progress >= 100 && isDataReady
                ? 'bg-primary text-on-primary hover:bg-primary-container'
                : 'bg-on-surface text-surface hover:bg-on-surface/90'
            }`}
          >
            <span>Buka Rekomendasi Terpilih</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <Link
            href={`/menu${tableNumber ? `?table=${encodeURIComponent(tableNumber)}` : ''}`}
            className="w-full py-2 text-center text-xs text-on-surface-variant hover:text-on-surface font-medium transition-colors"
          >
            Lewati kurasi &amp; langsung lihat semua menu
          </Link>
        </div>
      </div>
    </div>
  )
}

