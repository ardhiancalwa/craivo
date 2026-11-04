import 'server-only'
import prisma from './db'
import { getTurnoverReport } from './report-service'
import { getJakartaTodayString } from './timezone-utils'

export type {
  CashflowProfileData,
  CashflowCalculatedMetrics,
  CashflowRealizedSales,
  CashflowSummaryResponse,
} from '@/lib/cashflow-calculator'

export {
  DEFAULT_CASHFLOW_PROFILE,
  calculateCashflowMetrics,
} from '@/lib/cashflow-calculator'

import {
  type CashflowProfileData,
  type CashflowSummaryResponse,
  type CashflowRealizedSales,
  DEFAULT_CASHFLOW_PROFILE,
  calculateCashflowMetrics,
} from '@/lib/cashflow-calculator'

/**
 * Mengambil ringkasan profil arus kas aktif beserta integrasi omzet riil dari database pesanan CRAIVO.
 * Mendukung filter rentang tanggal dinamis dan mode proyeksi masa depan.
 */
export async function getCashflowSummary(
  startDate?: string,
  endDate?: string
): Promise<CashflowSummaryResponse> {
  // 1. Ambil atau inisialisasi CashflowProfile
  let profileRecord = await prisma.cashflowProfile.findFirst({
    orderBy: { updatedAt: 'desc' },
  })

  if (!profileRecord) {
    try {
      profileRecord = await prisma.cashflowProfile.create({
        data: {
          periodName: DEFAULT_CASHFLOW_PROFILE.periodName || 'Operasional Bulanan',
          initialCapital: DEFAULT_CASHFLOW_PROFILE.initialCapital,
          rawMaterialCost: DEFAULT_CASHFLOW_PROFILE.rawMaterialCost,
          operationalCost: DEFAULT_CASHFLOW_PROFILE.operationalCost,
          overheadCost: DEFAULT_CASHFLOW_PROFILE.overheadCost,
          salaryStaff: DEFAULT_CASHFLOW_PROFILE.salaryStaff,
          salaryOwner: DEFAULT_CASHFLOW_PROFILE.salaryOwner,
          targetProductionQty: DEFAULT_CASHFLOW_PROFILE.targetProductionQty,
          shareLossPercentage: DEFAULT_CASHFLOW_PROFILE.shareLossPercentage,
          sellingPricePerUnit: DEFAULT_CASHFLOW_PROFILE.sellingPricePerUnit,
          notes: DEFAULT_CASHFLOW_PROFILE.notes,
        },
      })
    } catch {
      // Fallback
    }
  }

  const activeRecord = profileRecord || {
    id: 'default-profile-id',
    periodName: DEFAULT_CASHFLOW_PROFILE.periodName || 'Operasional Bulanan',
    initialCapital: DEFAULT_CASHFLOW_PROFILE.initialCapital,
    rawMaterialCost: DEFAULT_CASHFLOW_PROFILE.rawMaterialCost,
    operationalCost: DEFAULT_CASHFLOW_PROFILE.operationalCost,
    overheadCost: DEFAULT_CASHFLOW_PROFILE.overheadCost,
    salaryStaff: DEFAULT_CASHFLOW_PROFILE.salaryStaff,
    salaryOwner: DEFAULT_CASHFLOW_PROFILE.salaryOwner,
    targetProductionQty: DEFAULT_CASHFLOW_PROFILE.targetProductionQty,
    shareLossPercentage: DEFAULT_CASHFLOW_PROFILE.shareLossPercentage,
    sellingPricePerUnit: DEFAULT_CASHFLOW_PROFILE.sellingPricePerUnit,
    notes: DEFAULT_CASHFLOW_PROFILE.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // 2. Tentukan rentang tanggal (WIB)
  const todayJakarta = getJakartaTodayString() // e.g. "2026-11-04"
  const startOfMonthJakarta = todayJakarta.slice(0, 8) + '01' // e.g. "2026-11-01"

  const effectiveStartDate = startDate && startDate.trim() ? startDate.trim() : startOfMonthJakarta
  const effectiveEndDate = endDate && endDate.trim() ? endDate.trim() : todayJakarta

  let realizedRevenue = 0
  let realizedPaidOrders = 0
  let realizedItemsSold = 0
  let isProjection = false

  // Cek apakah rentang tanggal seluruhnya di masa depan (Mode Proyeksi Target)
  if (effectiveStartDate > todayJakarta) {
    isProjection = true
    realizedRevenue = activeRecord.targetProductionQty * activeRecord.sellingPricePerUnit
    realizedItemsSold = activeRecord.targetProductionQty
    realizedPaidOrders = Math.max(1, Math.round(activeRecord.targetProductionQty / 2))
  } else {
    try {
      const turnover = await getTurnoverReport(effectiveStartDate, effectiveEndDate)
      realizedRevenue = turnover.summary.netTurnover
      realizedPaidOrders = turnover.summary.totalPaidOrders

      // Hitung total item fisik yang terjual pada pesanan PAID periode ini
      const itemAggregate = await prisma.orderItem.aggregate({
        where: {
          order: {
            paymentStatus: 'PAID',
            paidAt: {
              gte: new Date(turnover.period.startUtc),
              lte: new Date(turnover.period.endUtc),
            },
          },
        },
        _sum: {
          quantity: true,
        },
      })
      realizedItemsSold = itemAggregate._sum.quantity || 0
    } catch {
      // Jika tidak ada data atau saat pengujian terisolasi
    }
  }

  const averageSellingPriceReal =
    realizedItemsSold > 0 ? Math.round(realizedRevenue / realizedItemsSold) : activeRecord.sellingPricePerUnit

  const profileData: Required<CashflowProfileData> = {
    id: activeRecord.id,
    periodName: activeRecord.periodName,
    initialCapital: activeRecord.initialCapital,
    rawMaterialCost: activeRecord.rawMaterialCost,
    operationalCost: activeRecord.operationalCost,
    overheadCost: activeRecord.overheadCost,
    salaryStaff: activeRecord.salaryStaff,
    salaryOwner: activeRecord.salaryOwner,
    targetProductionQty: activeRecord.targetProductionQty,
    shareLossPercentage: activeRecord.shareLossPercentage,
    sellingPricePerUnit: activeRecord.sellingPricePerUnit,
    notes: activeRecord.notes || '',
    updatedAt: activeRecord.updatedAt.toISOString(),
  }

  const metrics = calculateCashflowMetrics(profileData, realizedRevenue)

  const realized: CashflowRealizedSales = {
    realizedRevenue,
    realizedPaidOrders,
    realizedItemsSold,
    averageSellingPriceReal,
    startDateJakarta: effectiveStartDate,
    endDateJakarta: effectiveEndDate,
    isProjection,
  }

  return {
    profile: profileData,
    metrics,
    realized,
  }
}

/**
 * Memperbarui parameter profil arus kas dan mencatatnya ke dalam Audit Log.
 */
export async function updateCashflowProfile(
  input: CashflowProfileData,
  staffUser?: { id: string; username: string } | null,
  ipAddress?: string
): Promise<CashflowSummaryResponse> {
  const existing = await prisma.cashflowProfile.findFirst({
    orderBy: { updatedAt: 'desc' },
  })

  let updatedRecord
  if (existing) {
    updatedRecord = await prisma.cashflowProfile.update({
      where: { id: existing.id },
      data: {
        periodName: input.periodName || existing.periodName,
        initialCapital: Math.max(0, Math.round(input.initialCapital ?? existing.initialCapital)),
        rawMaterialCost: Math.max(0, Math.round(input.rawMaterialCost ?? existing.rawMaterialCost)),
        operationalCost: Math.max(0, Math.round(input.operationalCost ?? existing.operationalCost)),
        overheadCost: Math.max(0, Math.round(input.overheadCost ?? existing.overheadCost)),
        salaryStaff: Math.max(0, Math.round(input.salaryStaff ?? existing.salaryStaff)),
        salaryOwner: Math.max(0, Math.round(input.salaryOwner ?? existing.salaryOwner)),
        targetProductionQty: Math.max(1, Math.round(input.targetProductionQty ?? existing.targetProductionQty)),
        shareLossPercentage: Math.max(0, input.shareLossPercentage ?? existing.shareLossPercentage),
        sellingPricePerUnit: Math.max(1, Math.round(input.sellingPricePerUnit ?? existing.sellingPricePerUnit)),
        notes: input.notes !== undefined ? input.notes : existing.notes,
      },
    })
  } else {
    updatedRecord = await prisma.cashflowProfile.create({
      data: {
        periodName: input.periodName || DEFAULT_CASHFLOW_PROFILE.periodName,
        initialCapital: Math.max(0, Math.round(input.initialCapital ?? DEFAULT_CASHFLOW_PROFILE.initialCapital)),
        rawMaterialCost: Math.max(0, Math.round(input.rawMaterialCost ?? DEFAULT_CASHFLOW_PROFILE.rawMaterialCost)),
        operationalCost: Math.max(0, Math.round(input.operationalCost ?? DEFAULT_CASHFLOW_PROFILE.operationalCost)),
        overheadCost: Math.max(0, Math.round(input.overheadCost ?? DEFAULT_CASHFLOW_PROFILE.overheadCost)),
        salaryStaff: Math.max(0, Math.round(input.salaryStaff ?? DEFAULT_CASHFLOW_PROFILE.salaryStaff)),
        salaryOwner: Math.max(0, Math.round(input.salaryOwner ?? DEFAULT_CASHFLOW_PROFILE.salaryOwner)),
        targetProductionQty: Math.max(1, Math.round(input.targetProductionQty ?? DEFAULT_CASHFLOW_PROFILE.targetProductionQty)),
        shareLossPercentage: Math.max(0, input.shareLossPercentage ?? DEFAULT_CASHFLOW_PROFILE.shareLossPercentage),
        sellingPricePerUnit: Math.max(1, Math.round(input.sellingPricePerUnit ?? DEFAULT_CASHFLOW_PROFILE.sellingPricePerUnit)),
        notes: input.notes ?? DEFAULT_CASHFLOW_PROFILE.notes,
      },
    })
  }

  // Catat ke Audit Log jika ada staffUser
  if (staffUser?.id) {
    await prisma.auditLog.create({
      data: {
        staffUserId: staffUser.id,
        action: 'UPDATE_CASHFLOW_PROFILE',
        details: JSON.stringify({
          profileId: updatedRecord.id,
          initialCapital: updatedRecord.initialCapital,
          rawMaterialCost: updatedRecord.rawMaterialCost,
          targetProductionQty: updatedRecord.targetProductionQty,
          shareLossPercentage: updatedRecord.shareLossPercentage,
        }),
        ipAddress: ipAddress || null,
      },
    }).catch(() => { })
  }

  return getCashflowSummary()
}