export interface CashflowProfileData {
  id?: string
  periodName?: string
  initialCapital: number // Modal awal (Integer IDR)
  rawMaterialCost: number // Harga bahan baku (Integer IDR)
  operationalCost: number // Biaya operasional kedai (Integer IDR)
  overheadCost: number // Overhead operasional (Integer IDR)
  salaryStaff: number // Biaya gaji staf kafe (Integer IDR)
  salaryOwner: number // Gaji / owner draw (Integer IDR)
  targetProductionQty: number // Target volume produksi (Integer unit/porsi)
  shareLossPercentage: number // Toleransi susut bahan baku (Persen, misal 5.0%)
  sellingPricePerUnit: number // Rata-rata harga jual per unit/porsi (Integer IDR)
  notes?: string | null
  updatedAt?: string
}

export interface CashflowCalculatedMetrics {
  shareLossNominal: number // Nominal susut bahan
  totalMaterialWithLoss: number // Harga bahan baku + alokasi susut
  hppBahanPerUnit: number // HPP Bahan Pokok per unit/porsi
  totalSalary: number // Gaji staf + Gaji owner
  totalProductionCost: number // Total Biaya: Bahan + Susut + Ops + Overhead + Gaji
  hppFullCostingPerUnit: number // HPP Penuh (Full Costing) per unit/porsi
  grossProfitPerUnit: number // Harga Jual - HPP Bahan Pokok
  grossMarginPercent: number // Gross Profit / Harga Jual (%)
  netProfitPerUnit: number // Harga Jual - HPP Full Costing
  netMarginPercent: number // Net Profit / Harga Jual (%)
  totalCashInflow: number // Modal Awal + Kas Masuk Riil
  totalCashOutflow: number // Total Pengeluaran Kas
  netCashFlow: number // Kas Masuk Riil - Total Pengeluaran
  endingCashBalance: number // Modal Awal + Arus Kas Bersih
}

export interface CashflowRealizedSales {
  realizedRevenue: number // Omzet riil pesanan PAID
  realizedPaidOrders: number // Total transaksi lunas
  realizedItemsSold: number // Total item/porsi riil terjual
  averageSellingPriceReal: number // Rata-rata harga jual aktual per unit/porsi
  startDateJakarta: string
  endDateJakarta: string
  isProjection?: boolean // Flag apakah data merupakan proyeksi masa depan
}

export interface CashflowSummaryResponse {
  profile: Required<CashflowProfileData>
  metrics: CashflowCalculatedMetrics
  realized: CashflowRealizedSales
}

export const DEFAULT_CASHFLOW_PROFILE: CashflowProfileData = {
  periodName: 'Operasional Bulanan',
  initialCapital: 50000000, // Rp50.000.000
  rawMaterialCost: 15000000, // Rp15.000.000
  operationalCost: 4500000, // Rp4.500.000
  overheadCost: 6000000, // Rp6.000.000
  salaryStaff: 8000000, // Rp8.000.000
  salaryOwner: 4000000, // Rp4.000.000
  targetProductionQty: 1500, // 1.500 cup
  shareLossPercentage: 5.0, // 5% susut (kalibrasi beans & sisa milk steaming)
  sellingPricePerUnit: 28000, // Rp28.000 rata-rata menu SELA
  notes: 'Estimasi standar operasional kedai kopi spesialti SELA',
}

/**
 * Menghitung seluruh metrik finansial, HPP, unit economics, dan arus kas secara presisi (Client & Server Safe).
 */
export function calculateCashflowMetrics(
  profile: CashflowProfileData,
  realizedRevenue: number
): CashflowCalculatedMetrics {
  const rawMaterial = Math.max(0, Math.round(profile.rawMaterialCost || 0))
  const shareLossPct = Math.max(0, profile.shareLossPercentage || 0)
  const operational = Math.max(0, Math.round(profile.operationalCost || 0))
  const overhead = Math.max(0, Math.round(profile.overheadCost || 0))
  const salaryStaff = Math.max(0, Math.round(profile.salaryStaff || 0))
  const salaryOwner = Math.max(0, Math.round(profile.salaryOwner || 0))
  const targetQty = Math.max(0, Math.round(profile.targetProductionQty || 0))
  const sellingPrice = Math.max(0, Math.round(profile.sellingPricePerUnit || 0))
  const initialCap = Math.max(0, Math.round(profile.initialCapital || 0))

  // 1. Alokasi Share Loss
  const shareLossNominal = Math.round(rawMaterial * (shareLossPct / 100))
  const totalMaterialWithLoss = rawMaterial + shareLossNominal

  // 2. Total Biaya Tenaga Kerja (Labor Cost)
  const totalSalary = salaryStaff + salaryOwner

  // 3. Total Biaya Produksi
  const totalProductionCost = totalMaterialWithLoss + operational + overhead + totalSalary

  // 4. Perhitungan HPP per Unit (Zero-Division Safe)
  let hppBahanPerUnit = 0
  let hppFullCostingPerUnit = 0
  if (targetQty > 0) {
    hppBahanPerUnit = Math.round(totalMaterialWithLoss / targetQty)
    hppFullCostingPerUnit = Math.round(totalProductionCost / targetQty)
  }

  // 5. Margin & Selisih per Unit
  const grossProfitPerUnit = sellingPrice > 0 ? sellingPrice - hppBahanPerUnit : 0
  const grossMarginPercent =
    sellingPrice > 0
      ? Math.round(((grossProfitPerUnit / sellingPrice) * 100) * 10) / 10
      : 0

  const netProfitPerUnit = sellingPrice > 0 ? sellingPrice - hppFullCostingPerUnit : 0
  const netMarginPercent =
    sellingPrice > 0
      ? Math.round(((netProfitPerUnit / sellingPrice) * 100) * 10) / 10
      : 0

  // 6. Arus Kas (Cash Flow)
  const totalCashInflow = initialCap + realizedRevenue
  const totalCashOutflow = totalProductionCost
  const netCashFlow = realizedRevenue - totalCashOutflow
  const endingCashBalance = initialCap + netCashFlow

  return {
    shareLossNominal,
    totalMaterialWithLoss,
    hppBahanPerUnit,
    totalSalary,
    totalProductionCost,
    hppFullCostingPerUnit,
    grossProfitPerUnit,
    grossMarginPercent,
    netProfitPerUnit,
    netMarginPercent,
    totalCashInflow,
    totalCashOutflow,
    netCashFlow,
    endingCashBalance,
  }
}

