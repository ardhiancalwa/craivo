'use client'

import * as React from 'react'
import {
  Banknote,
  Scale,
  RefreshCw,
  Save,
  RotateCcw,
  AlertTriangle,
  PieChart,
  Calendar,
  SlidersHorizontal,
  Wallet,
  Receipt,
  Users,
  Building2,
  Package,
  Info,
} from 'lucide-react'
import { formatIDR, cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import type {
  CashflowProfileData,
  CashflowCalculatedMetrics,
  CashflowRealizedSales,
  CashflowSummaryResponse,
} from '@/lib/cashflow-calculator'
import { calculateCashflowMetrics } from '@/lib/cashflow-calculator'

function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`
}

function formatDateString(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`
}

export function CashflowAdminView() {
  const { showToast } = useToast()

  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // Rentang tanggal filter (Default bulan berjalan zona Jakarta)
  const today = new Date()
  const defaultStartDate = `${today.getFullYear()}-${padZero(today.getMonth() + 1)}-01`
  const defaultEndDate = formatDateString(today)

  const [startDate, setStartDate] = React.useState<string>(defaultStartDate)
  const [endDate, setEndDate] = React.useState<string>(defaultEndDate)
  const [activePreset, setActivePreset] = React.useState<string>('THIS_MONTH')

  // Stored profile from server
  const [savedProfile, setSavedProfile] = React.useState<CashflowProfileData | null>(null)

  // Live editable form profile
  const [formProfile, setFormProfile] = React.useState<CashflowProfileData>({
    periodName: 'Operasional Bulanan',
    initialCapital: 50000000,
    rawMaterialCost: 15000000,
    operationalCost: 4500000,
    overheadCost: 6000000,
    salaryStaff: 8000000,
    salaryOwner: 4000000,
    targetProductionQty: 1500,
    shareLossPercentage: 5.0,
    sellingPricePerUnit: 28000,
    notes: '',
  })

  // Realized sales data from server
  const [realizedSales, setRealizedSales] = React.useState<CashflowRealizedSales>({
    realizedRevenue: 0,
    realizedPaidOrders: 0,
    realizedItemsSold: 0,
    averageSellingPriceReal: 28000,
    startDateJakarta: defaultStartDate,
    endDateJakarta: defaultEndDate,
    isProjection: false,
  })

  // Load summary from API with date filters
  const loadCashflowData = React.useCallback(async (start?: string, end?: string) => {
    setIsLoading(true)
    setErrorMsg(null)
    const queryStart = start || startDate
    const queryEnd = end || endDate

    if (queryStart > queryEnd) {
      setErrorMsg('Tanggal mulai tidak boleh lebih besar dari tanggal akhir.')
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/staff/admin/cashflow?startDate=${queryStart}&endDate=${queryEnd}`)
      const json = await res.json()
      if (res.ok && json.success && json.data) {
        const data: CashflowSummaryResponse = json.data
        setSavedProfile(data.profile)
        setFormProfile(data.profile)
        setRealizedSales(data.realized)
      } else {
        setErrorMsg(json.message || 'Gagal memuat data arus kas.')
      }
    } catch {
      setErrorMsg('Gagal terhubung ke server untuk memuat data arus kas.')
    } finally {
      setIsLoading(false)
    }
  }, [startDate, endDate])

  React.useEffect(() => {
    loadCashflowData(defaultStartDate, defaultEndDate)
  }, [loadCashflowData, defaultStartDate, defaultEndDate])

  // Handle Preset Selection
  const applyPreset = (preset: string) => {
    setActivePreset(preset)
    const now = new Date()
    let start = ''
    let end = ''

    if (preset === 'TODAY') {
      start = formatDateString(now)
      end = formatDateString(now)
    } else if (preset === 'THIS_WEEK') {
      const day = now.getDay()
      const diffToMonday = day === 0 ? -6 : 1 - day
      const monday = new Date(now)
      monday.setDate(now.getDate() + diffToMonday)
      start = formatDateString(monday)
      end = formatDateString(now)
    } else if (preset === 'LAST_WEEK') {
      const day = now.getDay()
      const diffToMonday = day === 0 ? -6 : 1 - day
      const lastMonday = new Date(now)
      lastMonday.setDate(now.getDate() + diffToMonday - 7)
      const lastSunday = new Date(lastMonday)
      lastSunday.setDate(lastMonday.getDate() + 6)
      start = formatDateString(lastMonday)
      end = formatDateString(lastSunday)
    } else if (preset === 'THIS_MONTH') {
      start = `${now.getFullYear()}-${padZero(now.getMonth() + 1)}-01`
      end = formatDateString(now)
    } else if (preset === 'LAST_MONTH') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      start = formatDateString(lastMonthDate)
      end = formatDateString(lastDayOfLastMonth)
    } else if (preset === 'THIS_YEAR') {
      start = `${now.getFullYear()}-01-01`
      end = formatDateString(now)
    } else if (preset === 'LAST_YEAR') {
      start = `${now.getFullYear() - 1}-01-01`
      end = `${now.getFullYear() - 1}-12-31`
    } else if (preset === 'NEXT_MONTH') {
      // Proyeksi bulan depan
      const nextMonthFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const nextMonthLast = new Date(now.getFullYear(), now.getMonth() + 2, 0)
      start = formatDateString(nextMonthFirst)
      end = formatDateString(nextMonthLast)
    }

    if (start && end) {
      setStartDate(start)
      setEndDate(end)
      loadCashflowData(start, end)
    }
  }

  // Reactive live calculations
  const metrics: CashflowCalculatedMetrics = React.useMemo(() => {
    return calculateCashflowMetrics(formProfile, realizedSales.realizedRevenue)
  }, [formProfile, realizedSales.realizedRevenue])

  // Check if form has unsaved modifications
  const hasUnsavedChanges = React.useMemo(() => {
    if (!savedProfile) return false
    return (
      formProfile.initialCapital !== savedProfile.initialCapital ||
      formProfile.rawMaterialCost !== savedProfile.rawMaterialCost ||
      formProfile.operationalCost !== savedProfile.operationalCost ||
      formProfile.overheadCost !== savedProfile.overheadCost ||
      formProfile.salaryStaff !== savedProfile.salaryStaff ||
      formProfile.salaryOwner !== savedProfile.salaryOwner ||
      formProfile.targetProductionQty !== savedProfile.targetProductionQty ||
      formProfile.shareLossPercentage !== savedProfile.shareLossPercentage ||
      formProfile.sellingPricePerUnit !== savedProfile.sellingPricePerUnit ||
      formProfile.periodName !== savedProfile.periodName
    )
  }, [formProfile, savedProfile])

  // Save changes to API
  const handleSaveChanges = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/staff/admin/cashflow', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(formProfile),
      })

      const json = await res.json()
      if (res.ok && json.success && json.data) {
        const data: CashflowSummaryResponse = json.data
        setSavedProfile(data.profile)
        setFormProfile(data.profile)
        setRealizedSales(data.realized)
        showToast('Parameter arus kas & HPP berhasil disimpan!', 'success')
      } else {
        showToast(json.message || 'Gagal menyimpan parameter.', 'error')
      }
    } catch {
      showToast('Terjadi kendala jaringan saat menyimpan.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Reset to saved profile
  const handleReset = () => {
    if (savedProfile) {
      setFormProfile(savedProfile)
      showToast('Nilai formulir dikembalikan ke konfigurasi tersimpan.', 'info')
    }
  }

  // Handle number input changes
  const updateField = (field: keyof CashflowProfileData, value: number | string) => {
    setFormProfile((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="h-10 w-64 bg-surface-container rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-surface-container-low rounded-2xl border border-outline-variant" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-surface-container-low rounded-2xl border border-outline-variant" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-7 p-4 sm:p-6 max-w-7xl mx-auto font-sans">
      {/* Header View & Periode Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Banknote className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface">
                Arus Kas & Manajemen HPP
              </h1>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Kalkulasi arus kas, analisis food cost, simulasi margin, dan titik impas F&B
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasUnsavedChanges || isSaving}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer',
              hasUnsavedChanges
                ? 'border-outline-variant bg-surface-lowest text-on-surface hover:bg-surface-container-low'
                : 'border-transparent text-on-surface-variant/40 cursor-not-allowed'
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={!hasUnsavedChanges || isSaving}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer',
              hasUnsavedChanges
                ? 'bg-primary text-on-primary hover:bg-primary/90'
                : 'bg-surface-container text-on-surface-variant/40 cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Simpan Parameter</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Date Range Picker & Filter Periode Cepat (Preset Bar) */}
      <div className="bg-surface-lowest p-4 sm:p-5 rounded-2xl border border-outline-variant shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-on-surface">
            <span className="flex items-center gap-1.5 font-bold text-brand">
              <Calendar className="h-4 w-4 text-primary" />
              Periode Evaluasi:
            </span>

            <div className="flex items-center gap-2">
              <span className="text-on-surface-variant text-[11px]">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setActivePreset('CUSTOM')
                }}
                className="px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs font-mono font-medium focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-on-surface-variant text-[11px]">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setActivePreset('CUSTOM')
                }}
                className="px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs font-mono font-medium focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="button"
              onClick={() => loadCashflowData(startDate, endDate)}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl border border-outline-variant bg-surface-container-low hover:bg-surface-container text-xs font-bold text-on-surface flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 active:scale-95"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              <span>Segarkan</span>
            </button>
          </div>

          {realizedSales.isProjection && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs font-bold">
              <span>🔮</span>
              <span>Mode Proyeksi Target (Bulan Mendatang)</span>
            </div>
          )}
        </div>

        {/* Preset Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-outline-variant/50">
          <span className="text-[11px] font-semibold text-on-surface-variant mr-1">Filter Cepat:</span>
          {[
            { id: 'TODAY', label: 'Hari Ini' },
            { id: 'THIS_WEEK', label: 'Minggu Ini' },
            { id: 'LAST_WEEK', label: 'Minggu Kemarin' },
            { id: 'THIS_MONTH', label: 'Bulan Ini' },
            { id: 'LAST_MONTH', label: 'Bulan Kemarin' },
            { id: 'THIS_YEAR', label: 'Tahun Ini' },
            { id: 'LAST_YEAR', label: 'Tahun Kemarin' },
            { id: 'NEXT_MONTH', label: 'Proyeksi Bulan Depan' },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer',
                activePreset === preset.id
                  ? 'bg-charcoal-950 text-white shadow-2xs font-bold'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {hasUnsavedChanges && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-950 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base">💡</span>
            <span>Terdapat perubahan simulasi yang belum disimpan. Seluruh kartu di bawah menghitung hasil simulasi secara langsung.</span>
          </div>
          <button
            type="button"
            onClick={handleSaveChanges}
            className="text-xs font-bold text-primary underline underline-offset-2 hover:text-primary-container shrink-0 cursor-pointer"
          >
            Simpan Sekarang
          </button>
        </div>
      )}

      {/* Row 1: Executive Cash Flow Summary Cards (Tanpa Penomoran) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-primary" />
            Ikhtisar Arus Kas Kafe
          </h2>
          <span className="text-[11px] text-on-surface-variant/80">
            Penjualan: {realizedSales.startDateJakarta} s/d {realizedSales.endDateJakarta}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Saldo Kas Akhir */}
          <div className="p-5 rounded-2xl bg-surface-lowest border border-outline-variant shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-xs text-on-surface-variant">
              <span className="font-medium">Saldo Kas Akhir</span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide',
                  metrics.endingCashBalance >= formProfile.initialCapital
                    ? 'bg-emerald-500/10 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-500/10 text-rose-800 border border-rose-300'
                )}
              >
                {metrics.endingCashBalance >= formProfile.initialCapital ? 'Kas Surplus' : 'Kas Berkurang'}
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-on-surface font-price-tabular">
                {formatIDR(metrics.endingCashBalance)}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1">
                Modal Awal: <span className="font-price-tabular font-medium">{formatIDR(formProfile.initialCapital)}</span>
              </p>
            </div>
          </div>

          {/* Card 2: Omzet Penjualan Riil */}
          <div className="p-5 rounded-2xl bg-surface-lowest border border-outline-variant shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-xs text-on-surface-variant">
              <span className="font-medium">Omzet Inflow</span>
              <span className="font-mono text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                {realizedSales.isProjection ? 'Proyeksi' : 'POS & QRIS'}
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-primary font-price-tabular">
                {formatIDR(realizedSales.realizedRevenue)}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1">
                Terjual <strong className="font-price-tabular">{realizedSales.realizedItemsSold} porsi/item</strong> dari{' '}
                <span className="font-price-tabular">{realizedSales.realizedPaidOrders} transaksi</span>
              </p>
            </div>
          </div>

          {/* Card 3: Total Pengeluaran Kas */}
          <div className="p-5 rounded-2xl bg-surface-lowest border border-outline-variant shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-xs text-on-surface-variant">
              <span className="font-medium">Total Pengeluaran (Outflow)</span>
              <span className="text-[11px] text-on-surface-variant font-medium">Beban Periode</span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-on-surface font-price-tabular">
                {formatIDR(metrics.totalCashOutflow)}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1">
                Bahan + Susut + Ops + Overhead + Gaji
              </p>
            </div>
          </div>

          {/* Card 4: Net Cash Flow */}
          <div className="p-5 rounded-2xl bg-surface-lowest border border-outline-variant shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-xs text-on-surface-variant">
              <span className="font-medium">Arus Kas Bersih (Net)</span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide',
                  metrics.netCashFlow >= 0
                    ? 'bg-emerald-500/10 text-emerald-800'
                    : 'bg-rose-500/10 text-rose-800'
                )}
              >
                {metrics.netCashFlow >= 0 ? '+ Positif' : '- Defisit'}
              </span>
            </div>
            <div>
              <div
                className={cn(
                  'text-2xl sm:text-3xl font-bold tracking-tight font-price-tabular',
                  metrics.netCashFlow >= 0 ? 'text-status-paid' : 'text-status-error'
                )}
              >
                {formatIDR(metrics.netCashFlow)}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1">
                {metrics.netCashFlow >= 0
                  ? 'Omzet menutup seluruh pengeluaran'
                  : 'Pengeluaran melebihi omzet berjalan'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION C (Lanjutan): Bar Komposisi Beban Pengeluaran */}
      <section className="p-5 rounded-2xl bg-surface-lowest border border-outline-variant shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface">
              Distribusi Beban Pengeluaran Operasional
            </h2>
          </div>
          <span className="text-[11px] text-on-surface-variant font-medium">
            Total Pengeluaran: <strong className="font-price-tabular text-on-surface">{formatIDR(metrics.totalProductionCost)}</strong>
          </span>
        </div>

        <div className="space-y-3">
          <div className="w-full h-3.5 rounded-full overflow-hidden flex shadow-2xs bg-surface-container">
            {metrics.totalProductionCost > 0 && (
              <>
                <div
                  className="bg-amber-600 transition-all"
                  style={{
                    width: `${Math.round(
                      (metrics.totalMaterialWithLoss / metrics.totalProductionCost) * 100
                    )}%`,
                  }}
                  title="Bahan Baku & Susut"
                />
                <div
                  className="bg-primary transition-all"
                  style={{
                    width: `${Math.round(
                      (metrics.totalSalary / metrics.totalProductionCost) * 100
                    )}%`,
                  }}
                  title="Gaji Staf & Owner"
                />
                <div
                  className="bg-stone-500 transition-all"
                  style={{
                    width: `${Math.round(
                      (formProfile.operationalCost / metrics.totalProductionCost) * 100
                    )}%`,
                  }}
                  title="Biaya Operasional"
                />
                <div
                  className="bg-stone-400 transition-all"
                  style={{
                    width: `${Math.round(
                      (formProfile.overheadCost / metrics.totalProductionCost) * 100
                    )}%`,
                  }}
                  title="Overhead Tetap"
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-amber-600 shrink-0" />
              <div>
                <span className="text-on-surface-variant text-[11px] block">Bahan & Susut</span>
                <strong className="font-price-tabular text-on-surface">
                  {formatIDR(metrics.totalMaterialWithLoss)} (
                  {metrics.totalProductionCost > 0
                    ? Math.round((metrics.totalMaterialWithLoss / metrics.totalProductionCost) * 100)
                    : 0}%)
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-primary shrink-0" />
              <div>
                <span className="text-on-surface-variant text-[11px] block">Gaji Staf & Owner</span>
                <strong className="font-price-tabular text-on-surface">
                  {formatIDR(metrics.totalSalary)} (
                  {metrics.totalProductionCost > 0
                    ? Math.round((metrics.totalSalary / metrics.totalProductionCost) * 100)
                    : 0}%)
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-stone-500 shrink-0" />
              <div>
                <span className="text-on-surface-variant text-[11px] block">Operasional</span>
                <strong className="font-price-tabular text-on-surface">
                  {formatIDR(formProfile.operationalCost)} (
                  {metrics.totalProductionCost > 0
                    ? Math.round((formProfile.operationalCost / metrics.totalProductionCost) * 100)
                    : 0}%)
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-stone-400 shrink-0" />
              <div>
                <span className="text-on-surface-variant text-[11px] block">Overhead Tetap</span>
                <strong className="font-price-tabular text-on-surface">
                  {formatIDR(formProfile.overheadCost)} (
                  {metrics.totalProductionCost > 0
                    ? Math.round((formProfile.overheadCost / metrics.totalProductionCost) * 100)
                    : 0}%)
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION B: Kalkulasi HPP & Estimasi Margin Sederhana */}
      <section className="p-5 rounded-2xl bg-surface-lowest border border-outline-variant shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface">
              Kalkulasi HPP & Estimasi Margin
            </h2>
          </div>
          <span className="text-[11px] text-on-surface-variant">
            Perhitungan biaya per unit berdasarkan alokasi kuantitas produksi ({formProfile.targetProductionQty.toLocaleString('id-ID')} unit)
          </span>
        </div>

        {formProfile.targetProductionQty <= 0 && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-950 text-xs flex items-center gap-2">
            <Info className="h-4 w-4 text-amber-700 shrink-0" />
            <span>Target kuantitas produksi bernilai 0. Masukkan kuantitas produksi pada parameter di bawah untuk menghitung HPP per unit.</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Biaya Produksi */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 space-y-1">
            <span className="text-[11px] font-medium text-on-surface-variant block">Total Biaya Produksi</span>
            <div className="text-xl sm:text-2xl font-bold font-price-tabular text-on-surface">
              {formatIDR(metrics.totalProductionCost)}
            </div>
            <p className="text-[10px] text-on-surface-variant">Bahan + Susut + Ops + Overhead + Gaji</p>
          </div>

          {/* 2. HPP Bahan per Unit */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 space-y-1">
            <span className="text-[11px] font-medium text-on-surface-variant block">Estimasi HPP Bahan Pokok</span>
            <div className="text-xl sm:text-2xl font-bold font-price-tabular text-on-surface">
              {formatIDR(metrics.hppBahanPerUnit)}
              <span className="text-xs font-medium text-on-surface-variant ml-1">/ unit</span>
            </div>
            <p className="text-[10px] text-on-surface-variant">Biaya bahan murni + susut per porsi</p>
          </div>

          {/* 3. HPP Full Costing per Unit */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 space-y-1">
            <span className="text-[11px] font-medium text-on-surface-variant block">Estimasi HPP Penuh (Full Costing)</span>
            <div className="text-xl sm:text-2xl font-bold font-price-tabular text-primary">
              {formatIDR(metrics.hppFullCostingPerUnit)}
              <span className="text-xs font-medium text-on-surface-variant ml-1">/ unit</span>
            </div>
            <p className="text-[10px] text-on-surface-variant">Seluruh beban biaya dibagi kuantitas produksi</p>
          </div>

          {/* 4. Harga Jual & Selisih Margin */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] font-medium text-on-surface-variant">Harga Jual Manual</span>
              <span className="text-[10px] text-on-surface-variant font-mono">
                {formatIDR(formProfile.sellingPricePerUnit)}
              </span>
            </div>
            <div className={cn(
              "text-xl sm:text-2xl font-bold font-price-tabular",
              metrics.netProfitPerUnit >= 0 ? "text-status-paid" : "text-status-error"
            )}>
              {metrics.netProfitPerUnit >= 0 ? '+' : ''}{formatIDR(metrics.netProfitPerUnit)}
              <span className="text-xs font-medium ml-1">/ unit</span>
            </div>
            <p className="text-[10px] text-on-surface-variant">
              Margin Bersih: <strong className="font-price-tabular">{metrics.netMarginPercent}%</strong> per unit
            </p>
          </div>
        </div>

        {/* Rincian Alokasi Biaya per Unit */}
        {formProfile.targetProductionQty > 0 && (
          <div className="pt-2 border-t border-outline-variant/60 text-xs font-sans text-on-surface-variant">
            <span className="font-semibold text-on-surface text-[11px] block mb-2">Rincian Alokasi Biaya per Unit ({formProfile.targetProductionQty.toLocaleString('id-ID')} unit):</span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-surface border border-outline-variant/40 flex justify-between">
                <span>Bahan Pokok:</span>
                <strong className="font-price-tabular text-on-surface">
                  {formatIDR(Math.round(formProfile.rawMaterialCost / formProfile.targetProductionQty))}
                </strong>
              </div>
              <div className="p-2 rounded-lg bg-surface border border-outline-variant/40 flex justify-between">
                <span>Alokasi Susut ({formProfile.shareLossPercentage}%):</span>
                <strong className="font-price-tabular text-amber-900">
                  +{formatIDR(Math.round(metrics.shareLossNominal / formProfile.targetProductionQty))}
                </strong>
              </div>
              <div className="p-2 rounded-lg bg-surface border border-outline-variant/40 flex justify-between">
                <span>Ops & Overhead:</span>
                <strong className="font-price-tabular text-on-surface">
                  +{formatIDR(Math.round((formProfile.operationalCost + formProfile.overheadCost) / formProfile.targetProductionQty))}
                </strong>
              </div>
              <div className="p-2 rounded-lg bg-surface border border-outline-variant/40 flex justify-between">
                <span>Gaji (Staf + Owner):</span>
                <strong className="font-price-tabular text-on-surface">
                  +{formatIDR(Math.round(metrics.totalSalary / formProfile.targetProductionQty))}
                </strong>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Row 4: Financial Input Panels (Tanpa Penomoran) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Parameter Finansial Operasional & Produksi
          </h2>
          <span className="text-xs text-on-surface-variant font-medium">
            Mempengaruhi kalkulasi HPP dan proyeksi kas
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Panel 1: Modal Awal & Produksi */}
          <div className="p-5 rounded-2xl bg-surface-lowest border border-outline-variant shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-on-surface pb-2 border-b border-outline-variant">
              <Building2 className="h-4 w-4 text-primary" />
              <span>Modal & Target Volume</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Modal Awal Kas
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-on-surface-variant font-mono">Rp</span>
                  <input
                    type="number"
                    value={formProfile.initialCapital}
                    onChange={(e) => updateField('initialCapital', parseInt(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-outline-variant text-xs font-price-tabular bg-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1">Saldo kas awal yang disiapkan kafe</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Target Volume Produksi
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formProfile.targetProductionQty}
                    onChange={(e) => updateField('targetProductionQty', Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full pl-3 pr-16 py-2 rounded-xl border border-outline-variant text-xs font-price-tabular bg-surface focus:outline-none focus:border-primary"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-on-surface-variant font-medium">unit</span>
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1">Total estimasi item/porsi dalam periode</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Rata-Rata Harga Jual
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-on-surface-variant font-mono">Rp</span>
                  <input
                    type="number"
                    value={formProfile.sellingPricePerUnit}
                    onChange={(e) => updateField('sellingPricePerUnit', Math.max(100, parseInt(e.target.value) || 100))}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-outline-variant text-xs font-price-tabular bg-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1">Rata-rata harga jual menu per unit/porsi</p>
              </div>
            </div>
          </div>

          {/* Panel 2: Harga Bahan & Susut */}
          <div className="p-5 rounded-2xl bg-surface-lowest border border-outline-variant shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-on-surface pb-2 border-b border-outline-variant">
              <Package className="h-4 w-4 text-primary" />
              <span>Biaya Bahan Baku & Susut</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Harga Bahan Baku Total
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-on-surface-variant font-mono">Rp</span>
                  <input
                    type="number"
                    value={formProfile.rawMaterialCost}
                    onChange={(e) => updateField('rawMaterialCost', parseInt(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-outline-variant text-xs font-price-tabular bg-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1">Kopi, susu, sirup, wadah, kemasan</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-on-surface">
                    Share Loss Susut Bahan
                  </label>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-900 border border-amber-300">
                    Klarifikasi Kebutuhan
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={formProfile.shareLossPercentage}
                    onChange={(e) => updateField('shareLossPercentage', parseFloat(e.target.value) || 0)}
                    className="w-full pl-3 pr-10 py-2 rounded-xl border border-outline-variant text-xs font-price-tabular bg-surface focus:outline-none focus:border-primary"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-on-surface-variant font-medium">%</span>
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1">Estimasi toleransi susut bahan baku (Req #9 Client)</p>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/60 text-[11px] text-on-surface-variant">
                <div className="flex justify-between">
                  <span>Nominal Susut:</span>
                  <strong className="font-price-tabular text-amber-900">{formatIDR(metrics.shareLossNominal)}</strong>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Bahan + Susut:</span>
                  <strong className="font-price-tabular text-on-surface">{formatIDR(metrics.totalMaterialWithLoss)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Panel 3: Operasional & Overhead */}
          <div className="p-5 rounded-2xl bg-surface-lowest border border-outline-variant shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-on-surface pb-2 border-b border-outline-variant">
              <Receipt className="h-4 w-4 text-primary" />
              <span>Operasional & Overhead</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Biaya Operasional Kedai
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-on-surface-variant font-mono">Rp</span>
                  <input
                    type="number"
                    value={formProfile.operationalCost}
                    onChange={(e) => updateField('operationalCost', parseInt(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-outline-variant text-xs font-price-tabular bg-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1">Listrik, air, gas, internet, sanitasi</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Overhead Operasional
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-on-surface-variant font-mono">Rp</span>
                  <input
                    type="number"
                    value={formProfile.overheadCost}
                    onChange={(e) => updateField('overheadCost', parseInt(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-outline-variant text-xs font-price-tabular bg-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1">Sewa tempat, depresiasi alat espresso</p>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/60 text-[11px] text-on-surface-variant">
                <div className="flex justify-between">
                  <span>Total Beban Fasilitas:</span>
                  <strong className="font-price-tabular text-on-surface">
                    {formatIDR(formProfile.operationalCost + formProfile.overheadCost)}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Panel 4: Gaji Staf & Owner */}
          <div className="p-5 rounded-2xl bg-surface-lowest border border-outline-variant shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-on-surface pb-2 border-b border-outline-variant">
              <Users className="h-4 w-4 text-primary" />
              <span>Alokasi Gaji Tenaga Kerja</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Gaji Staf Kafe
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-on-surface-variant font-mono">Rp</span>
                  <input
                    type="number"
                    value={formProfile.salaryStaff}
                    onChange={(e) => updateField('salaryStaff', parseInt(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-outline-variant text-xs font-price-tabular bg-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1">Total gaji bulanan barista & kasir</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Gaji / Prive Owner
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-on-surface-variant font-mono">Rp</span>
                  <input
                    type="number"
                    value={formProfile.salaryOwner}
                    onChange={(e) => updateField('salaryOwner', parseInt(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-outline-variant text-xs font-price-tabular bg-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1">Alokasi gaji operasional founder/owner</p>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/60 text-[11px] text-on-surface-variant">
                <div className="flex justify-between">
                  <span>Total Beban Gaji:</span>
                  <strong className="font-price-tabular text-primary">{formatIDR(metrics.totalSalary)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
