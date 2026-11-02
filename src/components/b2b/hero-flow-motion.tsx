'use client'

import * as React from 'react'
import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

const CYCLE_DURATION_MS = 12000
const REDUCED_MOTION_SNAPSHOT_MS = 9500

export type StoryboardScene = 1 | 2 | 3 | 4 | 5

interface Point {
  x: number
  y: number
}

export interface TimelineFrame {
  scene: StoryboardScene
  stageOpacity: number
  // Scene 1: Meja (0–2s)
  tableEnter: number
  scanProgress: number
  scanOpacity: number
  qrLocked: number
  path1Draw: number
  dot1Opacity: number
  // Scene 2: Pilihan menu (2–4s)
  menuEnter: number
  modifierSelect: number
  summaryCompose: number
  // Scene 3: Pembayaran (4–6.5s)
  path2Draw: number
  carrierOpacity: number
  paymentEnter: number
  isPaymentVerified: boolean
  pendingOpacity: number
  verifiedOpacity: number
  checkRingStroke: number
  checkMarkStroke: number
  kitchenGateOpen: boolean
  path3Draw: number
  dot3Opacity: number
  // Scene 4: Tiket dapur (6.5–9s)
  ticketEnter: number
  ticketHeader: number
  ticketRule: number
  ticketItem: number
  ticketModifier: number
  ticketOrigin: number
}

function clamp01(value: number): number {
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

function segment(t: number, start: number, end: number): number {
  if (end <= start) return t >= end ? 1 : 0
  return clamp01((t - start) / (end - start))
}

function easeOutCubic(x: number): number {
  const c = clamp01(x)
  return 1 - Math.pow(1 - c, 3)
}

function easeInOutCubic(x: number): number {
  const c = clamp01(x)
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2
}

function pointAlongPolyline(points: readonly Point[], progress: number): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1 || progress <= 0) return points[0]!
  if (progress >= 1) return points[points.length - 1]!

  const lengths: number[] = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    lengths.push(len)
    total += len
  }

  if (total === 0) return points[0]!
  const target = progress * total
  let acc = 0

  for (let i = 0; i < lengths.length; i++) {
    const segLen = lengths[i]!
    if (acc + segLen >= target) {
      const a = points[i]!
      const b = points[i + 1]!
      const localT = segLen === 0 ? 0 : (target - acc) / segLen
      return {
        x: a.x + (b.x - a.x) * localT,
        y: a.y + (b.y - a.y) * localT,
      }
    }
    acc += segLen
  }

  return points[points.length - 1]!
}

export function computeTimelineFrame(elapsedMs: number): TimelineFrame {
  const clampedMs = ((elapsedMs % CYCLE_DURATION_MS) + CYCLE_DURATION_MS) % CYCLE_DURATION_MS
  const t = clampedMs / 1000

  let scene: StoryboardScene = 1
  if (t >= 9.0) {
    scene = 5
  } else if (t >= 6.5) {
    scene = 4
  } else if (t >= 4.0) {
    scene = 3
  } else if (t >= 2.0) {
    scene = 2
  }

  // Scene 5 hold (9.0–11.3s), then smooth reset (11.3–11.96s)
  const resetFade = t > 11.3 ? easeInOutCubic(segment(t, 11.3, 11.96)) : 0
  const stageOpacity = 1 - resetFade

  // Scene 1: Meja (0–2s) — QR & label enter, single scan pass, then dot travels to Menu
  const tableEnter = easeOutCubic(segment(t, 0.06, 0.46))
  const scanProgress = easeInOutCubic(segment(t, 0.48, 1.3))
  const scanOpacity =
    t < 0.48
      ? 0
      : t < 0.58
        ? segment(t, 0.48, 0.58)
        : t <= 1.2
          ? 1
          : t <= 1.34
            ? 1 - segment(t, 1.2, 1.34)
            : 0
  const qrLocked = easeOutCubic(segment(t, 1.24, 1.5))
  const path1Draw = easeInOutCubic(segment(t, 1.36, 1.98))
  const dot1Opacity =
    t < 1.36 ? 0 : t <= 1.92 ? 1 : t <= 2.08 ? 1 - segment(t, 1.92, 2.08) : 0

  // Scene 2: Pilihan menu (2–4s) — Kopi Susu Aren, modifier selects, composes summary
  const menuEnter = easeOutCubic(segment(t, 1.98, 2.42))
  const modifierSelect = easeOutCubic(segment(t, 2.48, 3.05))
  const summaryCompose = easeOutCubic(segment(t, 3.18, 3.85))

  // Scene 3: Pembayaran (4–6.5s) — Summary moves to payment, Menunggu -> Terverifikasi + stroke check, THEN kitchen path opens
  const path2Draw = easeInOutCubic(segment(t, 4.0, 4.65))
  const carrierOpacity =
    t < 4.0 ? 0 : t < 4.1 ? segment(t, 4.0, 4.1) : t <= 4.58 ? 1 : t <= 4.72 ? 1 - segment(t, 4.58, 4.72) : 0
  const paymentEnter = easeOutCubic(segment(t, 4.32, 4.75))
  const isPaymentVerified = t >= 5.25
  const pendingOpacity =
    t < 4.35
      ? 0
      : t < 4.65
        ? easeOutCubic(segment(t, 4.35, 4.65))
        : t < 5.15
          ? 1
          : 1 - easeOutCubic(segment(t, 5.15, 5.28))
  const verifiedOpacity = easeOutCubic(segment(t, 5.25, 5.5))
  const checkRingStroke = easeOutCubic(segment(t, 5.25, 5.6))
  const checkMarkStroke = easeOutCubic(segment(t, 5.34, 5.88))

  // Kitchen Gate invariant: path to kitchen ONLY activates after payment verification + checkmark stroke finish
  const kitchenGateOpen = t >= 5.92
  const path3Draw = kitchenGateOpen ? easeInOutCubic(segment(t, 5.92, 6.5)) : 0
  const dot3Opacity =
    t < 5.92 ? 0 : t <= 6.44 ? 1 : t <= 6.6 ? 1 - segment(t, 6.44, 6.6) : 0

  // Scene 4: Tiket dapur (6.5–9s) — Ticket builds from identical order data
  const ticketEnter = easeOutCubic(segment(t, 6.48, 6.92))
  const ticketHeader = easeOutCubic(segment(t, 6.72, 7.12))
  const ticketRule = easeOutCubic(segment(t, 7.02, 7.36))
  const ticketItem = easeOutCubic(segment(t, 7.22, 7.62))
  const ticketModifier = easeOutCubic(segment(t, 7.52, 7.92))
  const ticketOrigin = easeOutCubic(segment(t, 7.85, 8.35))

  return {
    scene,
    stageOpacity,
    tableEnter,
    scanProgress,
    scanOpacity,
    qrLocked,
    path1Draw,
    dot1Opacity,
    menuEnter,
    modifierSelect,
    summaryCompose,
    path2Draw,
    carrierOpacity,
    paymentEnter,
    isPaymentVerified,
    pendingOpacity,
    verifiedOpacity,
    checkRingStroke,
    checkMarkStroke,
    kitchenGateOpen,
    path3Draw,
    dot3Opacity,
    ticketEnter,
    ticketHeader,
    ticketRule,
    ticketItem,
    ticketModifier,
    ticketOrigin,
  }
}

const DESKTOP_PATH_1: readonly Point[] = [
  { x: 316, y: 112 },
  { x: 404, y: 112 },
]

const DESKTOP_PATH_2: readonly Point[] = [
  { x: 550, y: 200 },
  { x: 550, y: 228 },
  { x: 170, y: 228 },
  { x: 170, y: 256 },
]

const DESKTOP_PATH_3: readonly Point[] = [
  { x: 316, y: 344 },
  { x: 404, y: 344 },
]

const MOBILE_PATH_1: readonly Point[] = [
  { x: 171, y: 122 },
  { x: 171, y: 148 },
]

const MOBILE_PATH_2: readonly Point[] = [
  { x: 171, y: 268 },
  { x: 171, y: 294 },
]

const MOBILE_PATH_3: readonly Point[] = [
  { x: 171, y: 402 },
  { x: 171, y: 428 },
]

const SCENE_CAPTIONS: Record<StoryboardScene, string> = {
  1: '01 / Pindai QR meja',
  2: '02 / Pilih menu & modifier',
  3: '03 / Verifikasi pembayaran',
  4: '04 / Terbit tiket dapur',
  5: '05 / Alur terhubung penuh',
}

/**
 * Ilustrasi QR geometris dekoratif (bukan QR pembayaran nyata & tidak memuat payload transaksi).
 */
function DecorativeQrSvg({
  x,
  y,
  size,
  scanProgress,
  scanOpacity,
  lockedProgress,
}: {
  x: number
  y: number
  size: number
  scanProgress: number
  scanOpacity: number
  lockedProgress: number
}) {
  const pad = 8
  const inner = size - pad * 2
  const finder = Math.round(inner * 0.28)
  const scanY = y + 6 + (size - 12) * scanProgress
  const bracketStroke = lockedProgress > 0.5 ? '#924805' : '#877367'

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={6}
        fill="#FFFFFF"
        stroke={lockedProgress > 0.5 ? '#924805' : '#E7E2DA'}
        strokeWidth={1.2}
      />
      {/* Corner scan brackets */}
      <path
        d={`M ${x - 3} ${y + 9} L ${x - 3} ${y - 3} L ${x + 9} ${y - 3}`}
        fill="none"
        stroke={bracketStroke}
        strokeWidth={1.5}
      />
      <path
        d={`M ${x + size - 9} ${y - 3} L ${x + size + 3} ${y - 3} L ${x + size + 3} ${y + 9}`}
        fill="none"
        stroke={bracketStroke}
        strokeWidth={1.5}
      />
      <path
        d={`M ${x - 3} ${y + size - 9} L ${x - 3} ${y + size + 3} L ${x + 9} ${y + size + 3}`}
        fill="none"
        stroke={bracketStroke}
        strokeWidth={1.5}
      />
      <path
        d={`M ${x + size - 9} ${y + size + 3} L ${x + size + 3} ${y + size + 3} L ${x + size + 3} ${y + size - 9}`}
        fill="none"
        stroke={bracketStroke}
        strokeWidth={1.5}
      />

      {/* Three geometric finder squares */}
      <rect
        x={x + pad}
        y={y + pad}
        width={finder}
        height={finder}
        rx={2}
        fill="none"
        stroke="#1B1C1A"
        strokeWidth={2.2}
      />
      <rect
        x={x + pad + 4}
        y={y + pad + 4}
        width={finder - 8}
        height={finder - 8}
        rx={1}
        fill="#1B1C1A"
      />

      <rect
        x={x + size - pad - finder}
        y={y + pad}
        width={finder}
        height={finder}
        rx={2}
        fill="none"
        stroke="#1B1C1A"
        strokeWidth={2.2}
      />
      <rect
        x={x + size - pad - finder + 4}
        y={y + pad + 4}
        width={finder - 8}
        height={finder - 8}
        rx={1}
        fill="#1B1C1A"
      />

      <rect
        x={x + pad}
        y={y + size - pad - finder}
        width={finder}
        height={finder}
        rx={2}
        fill="none"
        stroke="#1B1C1A"
        strokeWidth={2.2}
      />
      <rect
        x={x + pad + 4}
        y={y + size - pad - finder + 4}
        width={finder - 8}
        height={finder - 8}
        rx={1}
        fill="#1B1C1A"
      />

      {/* Non-scannable decorative interior matrix */}
      <rect x={x + size * 0.46} y={y + size * 0.2} width={5} height={5} fill="#1B1C1A" />
      <rect x={x + size * 0.46} y={y + size * 0.34} width={5} height={11} fill="#1B1C1A" />
      <rect x={x + size * 0.22} y={y + size * 0.48} width={11} height={5} fill="#1B1C1A" />
      <rect x={x + size * 0.46} y={y + size * 0.54} width={10} height={5} fill="#924805" />
      <rect x={x + size * 0.66} y={y + size * 0.52} width={5} height={12} fill="#1B1C1A" />
      <rect x={x + size * 0.5} y={y + size * 0.7} width={12} height={5} fill="#1B1C1A" />
      <rect x={x + size * 0.7} y={y + size * 0.72} width={6} height={6} fill="#1B1C1A" />

      {/* Single-pass scan line */}
      {scanOpacity > 0.01 && (
        <g opacity={scanOpacity}>
          <line
            x1={x - 4}
            y1={scanY}
            x2={x + size + 4}
            y2={scanY}
            stroke="#924805"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          <rect
            x={x + 2}
            y={Math.max(y + 2, scanY - 8)}
            width={size - 4}
            height={8}
            fill="#924805"
            opacity={0.12}
          />
        </g>
      )}
    </g>
  )
}

export function HeroFlowMotion() {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const elapsedRef = React.useRef<number>(0)
  const lastFrameTsRef = React.useRef<number | null>(null)

  const [elapsedMs, setElapsedMs] = React.useState<number>(0)
  const [isUserPaused, setIsUserPaused] = React.useState<boolean>(false)
  const [isInViewport, setIsInViewport] = React.useState<boolean>(true)
  const [isTabVisible, setIsTabVisible] = React.useState<boolean>(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState<boolean>(false)
  const [isMobileStage, setIsMobileStage] = React.useState<boolean>(false)

  // Detect prefers-reduced-motion & mobile stage breakpoint (< 768px)
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const reducedMq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const mobileMq = window.matchMedia?.('(max-width: 767px)')

    const syncReduced = () => {
      const reduced = Boolean(reducedMq?.matches)
      setPrefersReducedMotion(reduced)
      if (reduced) {
        elapsedRef.current = REDUCED_MOTION_SNAPSHOT_MS
        setElapsedMs(REDUCED_MOTION_SNAPSHOT_MS)
      }
    }

    const syncMobile = () => {
      setIsMobileStage(Boolean(mobileMq?.matches))
    }

    syncReduced()
    syncMobile()

    reducedMq?.addEventListener?.('change', syncReduced)
    mobileMq?.addEventListener?.('change', syncMobile)

    return () => {
      reducedMq?.removeEventListener?.('change', syncReduced)
      mobileMq?.removeEventListener?.('change', syncMobile)
    }
  }, [])

  // Pause when browser tab is hidden
  React.useEffect(() => {
    if (typeof document === 'undefined') return

    const handleVisibility = () => {
      setIsTabVisible(document.visibilityState === 'visible')
    }

    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // Pause when stage leaves viewport
  React.useEffect(() => {
    const node = containerRef.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry) {
          setIsInViewport(entry.isIntersecting)
        }
      },
      { threshold: 0.12 }
    )

    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [])

  const shouldAnimate =
    !prefersReducedMotion && !isUserPaused && isInViewport && isTabVisible

  // Single master requestAnimationFrame timeline (12s cycle)
  React.useEffect(() => {
    if (!shouldAnimate) {
      lastFrameTsRef.current = null
      return
    }

    let rafId = 0

    const tick = (now: number) => {
      if (lastFrameTsRef.current === null) {
        lastFrameTsRef.current = now
      }
      const delta = Math.min(100, Math.max(0, now - lastFrameTsRef.current))
      lastFrameTsRef.current = now

      const nextElapsed = (elapsedRef.current + delta) % CYCLE_DURATION_MS
      elapsedRef.current = nextElapsed
      setElapsedMs(nextElapsed)

      rafId = window.requestAnimationFrame(tick)
    }

    rafId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(rafId)
      lastFrameTsRef.current = null
    }
  }, [shouldAnimate])

  const effectiveElapsedMs = prefersReducedMotion ? REDUCED_MOTION_SNAPSHOT_MS : elapsedMs
  const frame = computeTimelineFrame(effectiveElapsedMs)
  const progressPercent = prefersReducedMotion
    ? 100
    : Math.round((effectiveElapsedMs / CYCLE_DURATION_MS) * 100)

  const dot1Desktop = pointAlongPolyline(DESKTOP_PATH_1, frame.path1Draw)
  const carrierDesktop = pointAlongPolyline(DESKTOP_PATH_2, frame.path2Draw)
  const dot3Desktop = pointAlongPolyline(DESKTOP_PATH_3, frame.path3Draw)

  const dot1Mobile = pointAlongPolyline(MOBILE_PATH_1, frame.path1Draw)
  const carrierMobile = pointAlongPolyline(MOBILE_PATH_2, frame.path2Draw)
  const dot3Mobile = pointAlongPolyline(MOBILE_PATH_3, frame.path3Draw)

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Simulasi alur pemesanan dari meja ke dapur"
      data-testid="hero-flow-stage"
      data-scene={frame.scene}
      data-running={String(shouldAnimate)}
      data-user-paused={String(isUserPaused)}
      data-reduced-motion={String(prefersReducedMotion)}
      data-elapsed-ms={Math.round(effectiveElapsedMs)}
      className="w-full rounded-2xl border border-stone-200/90 bg-white shadow-frame overflow-hidden transition-all"
    >
      {/* Window Chrome Titlebar (matching design-preview/landing-page.html) */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-sand-200/80 bg-sand-50/70 text-[11px] text-stone-500 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-stone-300 inline-block"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-stone-300 inline-block"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-stone-300 inline-block"></span>
          <span className="ml-2 font-sans font-medium text-stone-700 text-xs hidden sm:inline">
            Tampilan Pengguna Meja — Cravio
          </span>
        </div>
        <span className="bg-sand-100 text-stone-700 px-2 py-0.5 rounded text-[10px] border border-sand-200 font-semibold font-mono">
          Meja 07 · Sesi Aktif
        </span>
      </div>

      {/* Top Bar: Permanent Label & Keyboard-Accessible Pause/Play */}
      <div className="flex items-center justify-between gap-3 border-b border-sand-200/60 bg-white px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            aria-hidden="true"
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              prefersReducedMotion || isUserPaused ? 'bg-outline' : 'bg-primary'
            )}
          />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-on-surface">
            Simulasi alur pemesanan
          </span>
          <span className="hidden sm:inline-block text-outline-variant" aria-hidden="true">
            ·
          </span>
          <span className="hidden sm:inline-block truncate text-xs text-on-surface-variant tabular-nums">
            {prefersReducedMotion ? 'Diagram lengkap statis' : SCENE_CAPTIONS[frame.scene]}
          </span>
        </div>

        {!prefersReducedMotion && (
          <button
            type="button"
            onClick={() => setIsUserPaused((prev) => !prev)}
            aria-pressed={isUserPaused}
            aria-label={
              isUserPaused
                ? 'Putar simulasi alur pemesanan'
                : 'Jeda simulasi alur pemesanan'
            }
            className="touch-target inline-flex items-center gap-1.5 rounded-full border border-sand-300 bg-sand-50/80 px-3 py-1 text-xs font-medium text-on-surface transition-colors hover:border-outline hover:bg-sand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer shadow-xs"
          >
            {isUserPaused ? (
              <>
                <Play className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>Putar</span>
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5 text-on-surface" aria-hidden="true" />
                <span>Jeda</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Coherent Coordinate Stage (Zero Layout Shift) */}
      <div className="relative w-full bg-surface px-2 py-2 sm:px-3 sm:py-3">
        {!isMobileStage ? (
          /* ===================================================================== */
          /* DESKTOP COORDINATE SYSTEM (720 x 456)                                 */
          /* ===================================================================== */
          <svg
            viewBox="0 0 720 456"
            className="block h-auto w-full select-none"
            role="img"
            aria-label="Diagram alur pesanan Meja 07: Kopi Susu Aren Less sugar, pembayaran terverifikasi, hingga tiket antrean dapur"
          >
            {/* Subtle architectural reference lines */}
            <g stroke="#EFECE6" strokeWidth={1}>
              <line x1="360" y1="16" x2="360" y2="440" strokeDasharray="3 5" />
              <line x1="16" y1="228" x2="704" y2="228" strokeDasharray="3 5" />
            </g>

            <g opacity={frame.stageOpacity}>
              {/* ----------------------------------------------------------------- */}
              {/* CONNECTING PATHS (Single Coordinate Space)                        */}
              {/* ----------------------------------------------------------------- */}

              {/* Path 1: Meja (316,112) -> Menu (404,112) */}
              <path
                d="M 316 112 L 404 112"
                fill="none"
                stroke="#E7E2DA"
                strokeWidth={1.5}
              />
              {frame.path1Draw > 0 && (
                <path
                  d="M 316 112 L 404 112"
                  fill="none"
                  stroke="#924805"
                  strokeWidth={2}
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - frame.path1Draw}
                />
              )}
              <path
                d="M 397 107 L 403 112 L 397 117"
                fill="none"
                stroke={frame.path1Draw >= 0.98 ? '#924805' : '#C9C1B6'}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {frame.dot1Opacity > 0.01 && (
                <g opacity={frame.dot1Opacity}>
                  <circle cx={dot1Desktop.x} cy={dot1Desktop.y} r={7} fill="#924805" opacity={0.18} />
                  <circle cx={dot1Desktop.x} cy={dot1Desktop.y} r={4} fill="#924805" />
                </g>
              )}

              {/* Path 2: Menu Summary (550,200) -> Pembayaran (170,256) */}
              <path
                d="M 550 200 L 550 228 L 170 228 L 170 256"
                fill="none"
                stroke="#E7E2DA"
                strokeWidth={1.5}
              />
              {frame.path2Draw > 0 && (
                <path
                  d="M 550 200 L 550 228 L 170 228 L 170 256"
                  fill="none"
                  stroke="#924805"
                  strokeWidth={2}
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - frame.path2Draw}
                />
              )}
              <path
                d="M 165 249 L 170 255 L 175 249"
                fill="none"
                stroke={frame.path2Draw >= 0.98 ? '#924805' : '#C9C1B6'}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/*Path 3: Pembayaran (316,344) -> Tiket Dapur (404,344) [GATED UNTIL VERIFIED] */}
              <path
                d="M 316 344 L 404 344"
                fill="none"
                stroke="#D6CFC5"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              {/* Gate indicator at midpoint (360,344) */}
              <g transform="translate(360, 344)">
                <circle
                  r={8}
                  fill={frame.kitchenGateOpen ? '#FFDCC7' : '#F5F3EF'}
                  stroke={frame.kitchenGateOpen ? '#924805' : '#C9C1B6'}
                  strokeWidth={1.2}
                />
                {frame.kitchenGateOpen ? (
                  <path
                    d="M -3 0 L 3 0 M 1 -2.5 L 3.5 0 L 1 2.5"
                    fill="none"
                    stroke="#924805"
                    strokeWidth={1.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <line
                    x1={0}
                    y1={-3.5}
                    x2={0}
                    y2={3.5}
                    stroke="#877367"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                )}
              </g>
              {frame.path3Draw > 0 && (
                <path
                  d="M 316 344 L 404 344"
                  fill="none"
                  stroke="#924805"
                  strokeWidth={2.2}
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - frame.path3Draw}
                />
              )}
              <path
                d="M 397 339 L 403 344 L 397 349"
                fill="none"
                stroke={frame.path3Draw >= 0.98 ? '#924805' : '#C9C1B6'}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {frame.dot3Opacity > 0.01 && (
                <g opacity={frame.dot3Opacity}>
                  <circle cx={dot3Desktop.x} cy={dot3Desktop.y} r={7} fill="#924805" opacity={0.2} />
                  <circle cx={dot3Desktop.x} cy={dot3Desktop.y} r={4} fill="#924805" />
                </g>
              )}

              {/* ----------------------------------------------------------------- */}
              {/* SCENE 1 NODE: MEJA 07 (Top-Left, x=24..316, y=24..200)            */}
              {/* ----------------------------------------------------------------- */}
              <g
                opacity={frame.tableEnter}
                transform={`translate(0, ${(1 - frame.tableEnter) * 10})`}
              >
                <rect
                  x={24}
                  y={24}
                  width={292}
                  height={176}
                  rx={8}
                  fill="#FFFFFF"
                  stroke={frame.scene === 1 ? '#924805' : '#E7E2DA'}
                  strokeWidth={frame.scene === 1 ? 1.5 : 1}
                />
                <text
                  x={42}
                  y={48}
                  fill="#877367"
                  fontSize={10}
                  fontWeight={600}
                  fontFamily="var(--font-mono)"
                  letterSpacing="0.08em"
                >
                  01 · TITIK MEJA
                </text>
                <text
                  x={42}
                  y={78}
                  fill="#1B1C1A"
                  fontSize={22}
                  fontWeight={700}
                  fontFamily="var(--font-display)"
                >
                  Meja 07
                </text>
                <text
                  x={42}
                  y={99}
                  fill="#544339"
                  fontSize={12}
                  fontFamily="var(--font-sans)"
                >
                  Kode QR publik meja
                </text>

                <rect
                  x={42}
                  y={114}
                  width={136}
                  height={24}
                  rx={4}
                  fill="#F5F3EF"
                  stroke="#E7E2DA"
                />
                <text
                  x={50}
                  y={130}
                  fill="#544339"
                  fontSize={11}
                  fontFamily="var(--font-mono)"
                >
                  /order?table=07
                </text>

                <text
                  x={42}
                  y={174}
                  fill={frame.qrLocked > 0.5 ? '#924805' : '#766F66'}
                  fontSize={11.5}
                  fontWeight={600}
                  fontFamily="var(--font-sans)"
                >
                  {frame.qrLocked > 0.5 ? 'Meja 07 terdeteksi →' : 'Memindai QR meja...'}
                </text>

                <DecorativeQrSvg
                  x={208}
                  y={52}
                  size={86}
                  scanProgress={frame.scanProgress}
                  scanOpacity={frame.scanOpacity}
                  lockedProgress={frame.qrLocked}
                />

                {/* Port anchor */}
                <circle
                  cx={316}
                  cy={112}
                  r={3.5}
                  fill={frame.path1Draw > 0 ? '#924805' : '#C9C1B6'}
                />
              </g>

              {/* ----------------------------------------------------------------- */}
              {/* SCENE 2 NODE: PILIHAN MENU (Top-Right, x=404..696, y=24..200)     */}
              {/* ----------------------------------------------------------------- */}
              <g>
                {/* Ghost frame before entry so spatial layout stays grounded */}
                <rect
                  x={404}
                  y={24}
                  width={292}
                  height={176}
                  rx={8}
                  fill="#F5F3EF"
                  opacity={0.45}
                  stroke="#E7E2DA"
                  strokeWidth={1}
                />
                {frame.menuEnter > 0.01 && (
                  <g
                    opacity={frame.menuEnter}
                    transform={`translate(${(1 - frame.menuEnter) * -10}, 0)`}
                  >
                    <rect
                      x={404}
                      y={24}
                      width={292}
                      height={176}
                      rx={8}
                      fill="#FFFFFF"
                      stroke={frame.scene === 2 ? '#924805' : '#E7E2DA'}
                      strokeWidth={frame.scene === 2 ? 1.5 : 1}
                    />
                    <text
                      x={422}
                      y={48}
                      fill="#877367"
                      fontSize={10}
                      fontWeight={600}
                      fontFamily="var(--font-mono)"
                      letterSpacing="0.08em"
                    >
                      02 · PILIHAN MENU
                    </text>
                    <text
                      x={678}
                      y={48}
                      textAnchor="end"
                      fill="#544339"
                      fontSize={10.5}
                      fontWeight={600}
                      fontFamily="var(--font-mono)"
                    >
                      Meja 07
                    </text>

                    <text
                      x={422}
                      y={75}
                      fill="#1B1C1A"
                      fontSize={18}
                      fontWeight={700}
                      fontFamily="var(--font-display)"
                    >
                      Kopi Susu Aren
                    </text>

                    {/* Modifier chips: Normal vs Less sugar */}
                    <g>
                      <rect
                        x={422}
                        y={88}
                        width={84}
                        height={26}
                        rx={5}
                        fill="#F5F3EF"
                        stroke="#E7E2DA"
                      />
                      <text
                        x={464}
                        y={105}
                        textAnchor="middle"
                        fill="#766F66"
                        fontSize={11.5}
                        fontFamily="var(--font-sans)"
                      >
                        Normal
                      </text>

                      {/* Active modifier chip transitioning to selected */}
                      <rect
                        x={514}
                        y={88}
                        width={116}
                        height={26}
                        rx={5}
                        fill={frame.modifierSelect > 0.35 ? '#FFDCC7' : '#FFFFFF'}
                        stroke={frame.modifierSelect > 0.2 ? '#924805' : '#E7E2DA'}
                        strokeWidth={frame.modifierSelect > 0.2 ? 1.4 : 1}
                      />
                      <circle
                        cx={528}
                        cy={101}
                        r={3.5 * frame.modifierSelect}
                        fill="#924805"
                      />
                      <text
                        x={578}
                        y={105}
                        textAnchor="middle"
                        fill={frame.modifierSelect > 0.35 ? '#311300' : '#544339'}
                        fontSize={11.5}
                        fontWeight={frame.modifierSelect > 0.35 ? 600 : 500}
                        fontFamily="var(--font-sans)"
                      >
                        Less sugar
                      </text>
                    </g>

                    {/* Composed Order Summary */}
                    <g
                      opacity={frame.summaryCompose}
                      transform={`translate(0, ${(1 - frame.summaryCompose) * 8})`}
                    >
                      <rect
                        x={422}
                        y={128}
                        width={256}
                        height={56}
                        rx={6}
                        fill="#FBF9F5"
                        stroke="#E7E2DA"
                      />
                      <text
                        x={434}
                        y={146}
                        fill="#877367"
                        fontSize={9.5}
                        fontWeight={600}
                        fontFamily="var(--font-mono)"
                        letterSpacing="0.06em"
                      >
                        RINGKASAN PESANAN
                      </text>
                      <text
                        x={434}
                        y={168}
                        fill="#1B1C1A"
                        fontSize={13}
                        fontWeight={600}
                        fontFamily="var(--font-sans)"
                      >
                        Less sugar · 1 item
                      </text>
                      <text
                        x={666}
                        y={168}
                        textAnchor="end"
                        fill="#924805"
                        fontSize={11}
                        fontWeight={600}
                        fontFamily="var(--font-mono)"
                      >
                        Siap bayar
                      </text>
                    </g>

                    <circle
                      cx={550}
                      cy={200}
                      r={3.5}
                      fill={frame.path2Draw > 0 ? '#924805' : '#C9C1B6'}
                    />
                  </g>
                )}
              </g>

              {/* Traveling Order Summary Carrier along Path 2 */}
              {frame.carrierOpacity > 0.01 && (
                <g
                  opacity={frame.carrierOpacity}
                  transform={`translate(${carrierDesktop.x}, ${carrierDesktop.y})`}
                >
                  <rect
                    x={-64}
                    y={-12}
                    width={128}
                    height={24}
                    rx={12}
                    fill="#1B1C1A"
                  />
                  <text
                    x={0}
                    y={4}
                    textAnchor="middle"
                    fill="#FBF9F5"
                    fontSize={10.5}
                    fontWeight={600}
                    fontFamily="var(--font-sans)"
                  >
                    Meja 07 · 1 item
                  </text>
                </g>
              )}

              {/* ----------------------------------------------------------------- */}
              {/* SCENE 3 NODE: PEMBAYARAN (Bottom-Left, x=24..316, y=256..432)     */}
              {/* ----------------------------------------------------------------- */}
              <g>
                <rect
                  x={24}
                  y={256}
                  width={292}
                  height={176}
                  rx={8}
                  fill="#F5F3EF"
                  opacity={0.45}
                  stroke="#E7E2DA"
                />
                {frame.paymentEnter > 0.01 && (
                  <g
                    opacity={frame.paymentEnter}
                    transform={`translate(0, ${(1 - frame.paymentEnter) * -8})`}
                  >
                    <rect
                      x={24}
                      y={256}
                      width={292}
                      height={176}
                      rx={8}
                      fill="#FFFFFF"
                      stroke={
                        frame.isPaymentVerified
                          ? '#1E7E34'
                          : frame.scene === 3
                            ? '#924805'
                            : '#E7E2DA'
                      }
                      strokeWidth={frame.scene === 3 || frame.isPaymentVerified ? 1.5 : 1}
                    />
                    <text
                      x={42}
                      y={280}
                      fill="#877367"
                      fontSize={10}
                      fontWeight={600}
                      fontFamily="var(--font-mono)"
                      letterSpacing="0.08em"
                    >
                      03 · PEMBAYARAN
                    </text>
                    <text
                      x={42}
                      y={302}
                      fill="#544339"
                      fontSize={12}
                      fontFamily="var(--font-sans)"
                    >
                      Meja 07 · Kopi Susu Aren (Less sugar)
                    </text>

                    {/* Status Box: Menunggu pembayaran -> Pembayaran terverifikasi */}
                    <rect
                      x={42}
                      y={316}
                      width={256}
                      height={68}
                      rx={6}
                      fill={frame.isPaymentVerified ? '#F4FAF5' : '#FBF9F5'}
                      stroke={frame.isPaymentVerified ? '#B8DEC0' : '#E7E2DA'}
                    />

                    {/* Pending state */}
                    {frame.pendingOpacity > 0.01 && (
                      <g opacity={frame.pendingOpacity}>
                        <circle
                          cx={68}
                          cy={350}
                          r={11}
                          fill="none"
                          stroke="#877367"
                          strokeWidth={1.6}
                          strokeDasharray="4 3"
                        />
                        <circle cx={68} cy={350} r={3} fill="#924805" />
                        <text
                          x={90}
                          y={347}
                          fill="#1B1C1A"
                          fontSize={13.5}
                          fontWeight={600}
                          fontFamily="var(--font-sans)"
                        >
                          Menunggu pembayaran
                        </text>
                        <text
                          x={90}
                          y={365}
                          fill="#766F66"
                          fontSize={11}
                          fontFamily="var(--font-sans)"
                        >
                          Dapur belum menerima tiket
                        </text>
                      </g>
                    )}

                    {/* Verified state + Stroke-drawn Checkmark */}
                    {frame.verifiedOpacity > 0.01 && (
                      <g opacity={frame.verifiedOpacity}>
                        <circle
                          cx={68}
                          cy={350}
                          r={12}
                          fill="#FFFFFF"
                          stroke="#1E7E34"
                          strokeWidth={1.8}
                          pathLength={1}
                          strokeDasharray={1}
                          strokeDashoffset={1 - frame.checkRingStroke}
                        />
                        {frame.checkMarkStroke > 0 && (
                          <path
                            d="M 62.5 350.5 L 66.5 354.5 L 74 346"
                            fill="none"
                            stroke="#1E7E34"
                            strokeWidth={2.2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            pathLength={1}
                            strokeDasharray={1}
                            strokeDashoffset={1 - frame.checkMarkStroke}
                          />
                        )}
                        <text
                          x={90}
                          y={347}
                          fill="#1E7E34"
                          fontSize={13.5}
                          fontWeight={700}
                          fontFamily="var(--font-sans)"
                        >
                          Pembayaran terverifikasi
                        </text>
                        <text
                          x={90}
                          y={365}
                          fill="#544339"
                          fontSize={11}
                          fontFamily="var(--font-sans)"
                        >
                          Meneruskan pesanan ke dapur
                        </text>
                      </g>
                    )}

                    <text
                      x={42}
                      y={410}
                      fill={frame.kitchenGateOpen ? '#924805' : '#766F66'}
                      fontSize={11}
                      fontWeight={frame.kitchenGateOpen ? 600 : 500}
                      fontFamily="var(--font-sans)"
                    >
                      {frame.kitchenGateOpen
                        ? 'Jalur ke dapur aktif →'
                        : 'Jalur ke dapur menunggu verifikasi'}
                    </text>

                    <circle
                      cx={316}
                      cy={344}
                      r={3.5}
                      fill={frame.kitchenGateOpen ? '#924805' : '#C9C1B6'}
                    />
                  </g>
                )}
              </g>

              {/* ----------------------------------------------------------------- */}
              {/* SCENE 4 NODE: TIKET DAPUR (Bottom-Right, x=404..696, y=256..432)  */}
              {/* ----------------------------------------------------------------- */}
              <g>
                <rect
                  x={404}
                  y={256}
                  width={292}
                  height={176}
                  rx={8}
                  fill="#F5F3EF"
                  opacity={0.45}
                  stroke="#E7E2DA"
                />
                {frame.ticketEnter > 0.01 && (
                  <g
                    opacity={frame.ticketEnter}
                    transform={`translate(${(1 - frame.ticketEnter) * -10}, 0)`}
                  >
                    {/* Kitchen Ticket Body */}
                    <rect
                      x={404}
                      y={256}
                      width={292}
                      height={176}
                      rx={8}
                      fill="#FFFFFF"
                      stroke="#1B1C1A"
                      strokeWidth={1.4}
                    />
                    {/* Left lineage accent bar connecting directly from Path 3 */}
                    <rect
                      x={404}
                      y={256}
                      width={5}
                      height={176}
                      rx={2}
                      fill="#924805"
                    />
                    <circle cx={404} cy={344} r={4} fill="#924805" />

                    {/* Header: Meja 07 + Antrean dapur */}
                    <g opacity={frame.ticketHeader}>
                      <text
                        x={424}
                        y={280}
                        fill="#877367"
                        fontSize={10}
                        fontWeight={600}
                        fontFamily="var(--font-mono)"
                        letterSpacing="0.08em"
                      >
                        04 · TIKET DAPUR
                      </text>
                      <text
                        x={424}
                        y={306}
                        fill="#1B1C1A"
                        fontSize={20}
                        fontWeight={700}
                        fontFamily="var(--font-display)"
                      >
                        Meja 07
                      </text>
                      <rect
                        x={568}
                        y={287}
                        width={110}
                        height={24}
                        rx={4}
                        fill="#FFDCC7"
                        stroke="#924805"
                        strokeWidth={1}
                      />
                      <text
                        x={623}
                        y={303}
                        textAnchor="middle"
                        fill="#311300"
                        fontSize={11}
                        fontWeight={700}
                        fontFamily="var(--font-sans)"
                      >
                        Antrean dapur
                      </text>
                    </g>

                    {/* Ticket Divider Rule */}
                    {frame.ticketRule > 0 && (
                      <line
                        x1={424}
                        y1={320}
                        x2={678}
                        y2={320}
                        stroke="#E7E2DA"
                        strokeWidth={1.2}
                        pathLength={1}
                        strokeDasharray={1}
                        strokeDashoffset={1 - frame.ticketRule}
                      />
                    )}

                    {/* Item Line: 1× Kopi Susu Aren */}
                    <g
                      opacity={frame.ticketItem}
                      transform={`translate(0, ${(1 - frame.ticketItem) * 5})`}
                    >
                      <text
                        x={424}
                        y={347}
                        fill="#1B1C1A"
                        fontSize={15}
                        fontWeight={700}
                        fontFamily="var(--font-display)"
                      >
                        1× Kopi Susu Aren
                      </text>
                    </g>

                    {/* Modifier Line: Less sugar */}
                    <g
                      opacity={frame.ticketModifier}
                      transform={`translate(0, ${(1 - frame.ticketModifier) * 5})`}
                    >
                      <text
                        x={438}
                        y={370}
                        fill="#924805"
                        fontSize={13}
                        fontWeight={600}
                        fontFamily="var(--font-sans)"
                      >
                        ↳ Less sugar
                      </text>
                    </g>

                    {/* Visual Lineage Proof */}
                    <g opacity={frame.ticketOrigin}>
                      <rect
                        x={424}
                        y={388}
                        width={254}
                        height={28}
                        rx={4}
                        fill="#F5F3EF"
                      />
                      <text
                        x={434}
                        y={406}
                        fill="#544339"
                        fontSize={10.5}
                        fontFamily="var(--font-mono)"
                      >
                        Asal tiket: Meja 07 · Terverifikasi
                      </text>
                    </g>
                  </g>
                )}
              </g>
            </g>
          </svg>
        ) : (
          /* ===================================================================== */
          /* DEDICATED MOBILE VERTICAL STAGE (342 x 564) — Readable at 390px       */
          /* ===================================================================== */
          <svg
            viewBox="0 0 342 564"
            className="block h-auto w-full select-none"
            role="img"
            aria-label="Diagram vertikal alur pesanan Meja 07: Kopi Susu Aren Less sugar, pembayaran terverifikasi, hingga tiket antrean dapur"
          >
            <g opacity={frame.stageOpacity}>
              {/* Vertical Path 1: Meja -> Menu */}
              <line x1={171} y1={122} x2={171} y2={148} stroke="#E7E2DA" strokeWidth={1.6} />
              {frame.path1Draw > 0 && (
                <line
                  x1={171}
                  y1={122}
                  x2={171}
                  y2={148}
                  stroke="#924805"
                  strokeWidth={2}
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - frame.path1Draw}
                />
              )}
              {frame.dot1Opacity > 0.01 && (
                <circle
                  cx={dot1Mobile.x}
                  cy={dot1Mobile.y}
                  r={4}
                  fill="#924805"
                  opacity={frame.dot1Opacity}
                />
              )}

              {/* Vertical Path 2: Menu -> Pembayaran */}
              <line x1={171} y1={268} x2={171} y2={294} stroke="#E7E2DA" strokeWidth={1.6} />
              {frame.path2Draw > 0 && (
                <line
                  x1={171}
                  y1={268}
                  x2={171}
                  y2={294}
                  stroke="#924805"
                  strokeWidth={2}
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - frame.path2Draw}
                />
              )}
              {frame.carrierOpacity > 0.01 && (
                <circle
                  cx={carrierMobile.x}
                  cy={carrierMobile.y}
                  r={4.5}
                  fill="#1B1C1A"
                  opacity={frame.carrierOpacity}
                />
              )}

              {/* Vertical Path 3: Pembayaran -> Tiket Dapur (GATED) */}
              <line
                x1={171}
                y1={402}
                x2={171}
                y2={428}
                stroke="#D6CFC5"
                strokeWidth={1.6}
                strokeDasharray="3 3"
              />
              {frame.path3Draw > 0 && (
                <line
                  x1={171}
                  y1={402}
                  x2={171}
                  y2={428}
                  stroke="#924805"
                  strokeWidth={2.2}
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - frame.path3Draw}
                />
              )}
              {frame.dot3Opacity > 0.01 && (
                <circle
                  cx={dot3Mobile.x}
                  cy={dot3Mobile.y}
                  r={4}
                  fill="#924805"
                  opacity={frame.dot3Opacity}
                />
              )}

              {/* Row 1: Meja 07 (y=12..122) */}
              <g
                opacity={frame.tableEnter}
                transform={`translate(0, ${(1 - frame.tableEnter) * 8})`}
              >
                <rect
                  x={12}
                  y={12}
                  width={318}
                  height={110}
                  rx={8}
                  fill="#FFFFFF"
                  stroke={frame.scene === 1 ? '#924805' : '#E7E2DA'}
                  strokeWidth={frame.scene === 1 ? 1.5 : 1}
                />
                <text
                  x={26}
                  y={34}
                  fill="#877367"
                  fontSize={10}
                  fontWeight={600}
                  fontFamily="var(--font-mono)"
                >
                  01 · TITIK MEJA
                </text>
                <text
                  x={26}
                  y={60}
                  fill="#1B1C1A"
                  fontSize={20}
                  fontWeight={700}
                  fontFamily="var(--font-display)"
                >
                  Meja 07
                </text>
                <text
                  x={26}
                  y={80}
                  fill="#544339"
                  fontSize={12}
                  fontFamily="var(--font-mono)"
                >
                  /order?table=07
                </text>
                <text
                  x={26}
                  y={104}
                  fill={frame.qrLocked > 0.5 ? '#924805' : '#766F66'}
                  fontSize={11.5}
                  fontWeight={600}
                  fontFamily="var(--font-sans)"
                >
                  {frame.qrLocked > 0.5 ? 'Meja 07 aktif ↓' : 'Memindai QR meja...'}
                </text>

                <DecorativeQrSvg
                  x={238}
                  y={25}
                  size={76}
                  scanProgress={frame.scanProgress}
                  scanOpacity={frame.scanOpacity}
                  lockedProgress={frame.qrLocked}
                />
              </g>

              {/* Row 2: Pilihan Menu (y=148..268) */}
              <rect
                x={12}
                y={148}
                width={318}
                height={120}
                rx={8}
                fill="#F5F3EF"
                opacity={0.45}
                stroke="#E7E2DA"
              />
              {frame.menuEnter > 0.01 && (
                <g opacity={frame.menuEnter}>
                  <rect
                    x={12}
                    y={148}
                    width={318}
                    height={120}
                    rx={8}
                    fill="#FFFFFF"
                    stroke={frame.scene === 2 ? '#924805' : '#E7E2DA'}
                    strokeWidth={frame.scene === 2 ? 1.5 : 1}
                  />
                  <text
                    x={26}
                    y={168}
                    fill="#877367"
                    fontSize={10}
                    fontWeight={600}
                    fontFamily="var(--font-mono)"
                  >
                    02 · PILIHAN MENU
                  </text>
                  <text
                    x={26}
                    y={192}
                    fill="#1B1C1A"
                    fontSize={17}
                    fontWeight={700}
                    fontFamily="var(--font-display)"
                  >
                    Kopi Susu Aren
                  </text>

                  {/* Modifier chip */}
                  <rect
                    x={214}
                    y={173}
                    width={102}
                    height={25}
                    rx={5}
                    fill={frame.modifierSelect > 0.35 ? '#FFDCC7' : '#F5F3EF'}
                    stroke={frame.modifierSelect > 0.2 ? '#924805' : '#E7E2DA'}
                  />
                  <text
                    x={265}
                    y={189}
                    textAnchor="middle"
                    fill={frame.modifierSelect > 0.35 ? '#311300' : '#544339'}
                    fontSize={11.5}
                    fontWeight={600}
                    fontFamily="var(--font-sans)"
                  >
                    Less sugar
                  </text>

                  {/* Composed summary */}
                  <g opacity={frame.summaryCompose}>
                    <rect
                      x={26}
                      y={210}
                      width={290}
                      height={44}
                      rx={6}
                      fill="#FBF9F5"
                      stroke="#E7E2DA"
                    />
                    <text
                      x={38}
                      y={227}
                      fill="#877367"
                      fontSize={9.5}
                      fontWeight={600}
                      fontFamily="var(--font-mono)"
                    >
                      RINGKASAN · MEJA 07
                    </text>
                    <text
                      x={38}
                      y={245}
                      fill="#1B1C1A"
                      fontSize={13}
                      fontWeight={600}
                      fontFamily="var(--font-sans)"
                    >
                      Less sugar · 1 item
                    </text>
                  </g>
                </g>
              )}

              {/* Row 3: Pembayaran (y=294..402) */}
              <rect
                x={12}
                y={294}
                width={318}
                height={108}
                rx={8}
                fill="#F5F3EF"
                opacity={0.45}
                stroke="#E7E2DA"
              />
              {frame.paymentEnter > 0.01 && (
                <g opacity={frame.paymentEnter}>
                  <rect
                    x={12}
                    y={294}
                    width={318}
                    height={108}
                    rx={8}
                    fill="#FFFFFF"
                    stroke={
                      frame.isPaymentVerified
                        ? '#1E7E34'
                        : frame.scene === 3
                          ? '#924805'
                          : '#E7E2DA'
                    }
                    strokeWidth={frame.scene === 3 || frame.isPaymentVerified ? 1.5 : 1}
                  />
                  <text
                    x={26}
                    y={315}
                    fill="#877367"
                    fontSize={10}
                    fontWeight={600}
                    fontFamily="var(--font-mono)"
                  >
                    03 · PEMBAYARAN
                  </text>

                  {frame.pendingOpacity > 0.01 && (
                    <g opacity={frame.pendingOpacity}>
                      <circle
                        cx={38}
                        cy={352}
                        r={10}
                        fill="none"
                        stroke="#877367"
                        strokeWidth={1.6}
                        strokeDasharray="4 3"
                      />
                      <text
                        x={58}
                        y={349}
                        fill="#1B1C1A"
                        fontSize={14}
                        fontWeight={600}
                        fontFamily="var(--font-sans)"
                      >
                        Menunggu pembayaran
                      </text>
                      <text
                        x={58}
                        y={368}
                        fill="#766F66"
                        fontSize={11.5}
                        fontFamily="var(--font-sans)"
                      >
                        Jalur dapur terkunci
                      </text>
                    </g>
                  )}

                  {frame.verifiedOpacity > 0.01 && (
                    <g opacity={frame.verifiedOpacity}>
                      <circle
                        cx={38}
                        cy={352}
                        r={11}
                        fill="#F4FAF5"
                        stroke="#1E7E34"
                        strokeWidth={1.8}
                        pathLength={1}
                        strokeDasharray={1}
                        strokeDashoffset={1 - frame.checkRingStroke}
                      />
                      {frame.checkMarkStroke > 0 && (
                        <path
                          d="M 33 352.5 L 36.8 356 L 43.5 348"
                          fill="none"
                          stroke="#1E7E34"
                          strokeWidth={2.2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          pathLength={1}
                          strokeDasharray={1}
                          strokeDashoffset={1 - frame.checkMarkStroke}
                        />
                      )}
                      <text
                        x={58}
                        y={349}
                        fill="#1E7E34"
                        fontSize={14}
                        fontWeight={700}
                        fontFamily="var(--font-sans)"
                      >
                        Pembayaran terverifikasi
                      </text>
                      <text
                        x={58}
                        y={368}
                        fill="#544339"
                        fontSize={11.5}
                        fontFamily="var(--font-sans)"
                      >
                        {frame.kitchenGateOpen ? 'Jalur ke dapur aktif ↓' : 'Memverifikasi...'}
                      </text>
                    </g>
                  )}
                </g>
              )}

              {/* Row 4: Tiket Dapur (y=428..552) */}
              <rect
                x={12}
                y={428}
                width={318}
                height={124}
                rx={8}
                fill="#F5F3EF"
                opacity={0.45}
                stroke="#E7E2DA"
              />
              {frame.ticketEnter > 0.01 && (
                <g opacity={frame.ticketEnter}>
                  <rect
                    x={12}
                    y={428}
                    width={318}
                    height={124}
                    rx={8}
                    fill="#FFFFFF"
                    stroke="#1B1C1A"
                    strokeWidth={1.4}
                  />
                  <rect x={12} y={428} width={5} height={124} rx={2} fill="#924805" />

                  <g opacity={frame.ticketHeader}>
                    <text
                      x={28}
                      y={458}
                      fill="#1B1C1A"
                      fontSize={19}
                      fontWeight={700}
                      fontFamily="var(--font-display)"
                    >
                      Meja 07
                    </text>
                    <rect
                      x={208}
                      y={440}
                      width={108}
                      height={24}
                      rx={4}
                      fill="#FFDCC7"
                      stroke="#924805"
                    />
                    <text
                      x={262}
                      y={456}
                      textAnchor="middle"
                      fill="#311300"
                      fontSize={11}
                      fontWeight={700}
                      fontFamily="var(--font-sans)"
                    >
                      Antrean dapur
                    </text>
                  </g>

                  {frame.ticketRule > 0 && (
                    <line
                      x1={28}
                      y1={472}
                      x2={316}
                      y2={472}
                      stroke="#E7E2DA"
                      strokeWidth={1.2}
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={1 - frame.ticketRule}
                    />
                  )}

                  <g opacity={frame.ticketItem}>
                    <text
                      x={28}
                      y={496}
                      fill="#1B1C1A"
                      fontSize={15}
                      fontWeight={700}
                      fontFamily="var(--font-display)"
                    >
                      1× Kopi Susu Aren
                    </text>
                  </g>

                  <g opacity={frame.ticketModifier}>
                    <text
                      x={40}
                      y={517}
                      fill="#924805"
                      fontSize={13}
                      fontWeight={600}
                      fontFamily="var(--font-sans)"
                    >
                      ↳ Less sugar
                    </text>
                  </g>

                  <g opacity={frame.ticketOrigin}>
                    <text
                      x={28}
                      y={539}
                      fill="#544339"
                      fontSize={10.5}
                      fontFamily="var(--font-mono)"
                    >
                      Terhubung dari pembayaran terverifikasi
                    </text>
                  </g>
                </g>
              )}
            </g>
          </svg>
        )}
      </div>

      {/* Subtle Timeline Footer Bar */}
      <div className="border-t border-outline-variant px-4 py-2 sm:px-5">
        <div className="flex items-center justify-between gap-4 text-[11px] text-on-surface-variant">
          <div className="flex items-center gap-3 overflow-x-auto">
            {(
              [
                [1, 'Meja'],
                [2, 'Menu'],
                [3, 'Pembayaran'],
                [4, 'Tiket dapur'],
              ] as const
            ).map(([stepNum, label]) => {
              const reached = prefersReducedMotion || frame.scene >= stepNum
              const current = !prefersReducedMotion && frame.scene === stepNum
              return (
                <span
                  key={stepNum}
                  className={cn(
                    'inline-flex items-center gap-1 whitespace-nowrap font-mono',
                    current
                      ? 'font-semibold text-primary'
                      : reached
                        ? 'text-on-surface'
                        : 'text-on-surface-variant/60'
                  )}
                >
                  <span>0{stepNum}</span>
                  <span className="font-sans">{label}</span>
                </span>
              )
            })}
          </div>

          <span className="shrink-0 font-mono tabular-nums text-[10px] text-on-surface-variant">
            {prefersReducedMotion ? 'Statis' : `${(effectiveElapsedMs / 1000).toFixed(1)}s / 12.0s`}
          </span>
        </div>

        <div
          aria-hidden="true"
          className="mt-1.5 h-[2px] w-full overflow-hidden bg-surface-container"
        >
          <div
            className="h-full bg-primary"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}
