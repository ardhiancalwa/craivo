import { describe, it, expect } from 'vitest'
import {
  calculateCashflowMetrics,
  DEFAULT_CASHFLOW_PROFILE,
  type CashflowProfileData,
} from '@/lib/cashflow-calculator'

describe('Unit: Cashflow & HPP Mathematical Engine (Simplified KISS Model)', () => {
  it('menghitung HPP bahan baku, susut share loss, dan HPP full costing secara akurat', () => {
    const profile: CashflowProfileData = {
      periodName: 'Batch Produksi Standar',
      initialCapital: 50000000,
      rawMaterialCost: 15000000, // Rp15.000.000
      operationalCost: 4500000, // Rp4.500.000
      overheadCost: 6000000, // Rp6.000.000
      salaryStaff: 8000000, // Rp8.000.000
      salaryOwner: 4000000, // Rp4.000.000 (Total Gaji Rp12.000.000)
      targetProductionQty: 1500, // 1.500 cup
      shareLossPercentage: 5.0, // 5% susut
      sellingPricePerUnit: 28000, // Rp28.000
    }

    const metrics = calculateCashflowMetrics(profile, 42000000)

    // 1. Susut Share Loss 5% dari Rp15.000.000 = Rp750.000
    expect(metrics.shareLossNominal).toBe(750000)
    expect(metrics.totalMaterialWithLoss).toBe(15750000)

    // 2. HPP Bahan per Cup = Rp15.750.000 / 1.500 cup = Rp10.500 / cup
    expect(metrics.hppBahanPerUnit).toBe(10500)

    // 3. Total Biaya Produksi = 15.750.000 + 4.500.000 + 6.000.000 + 12.000.000 = Rp38.250.000
    expect(metrics.totalSalary).toBe(12000000)
    expect(metrics.totalProductionCost).toBe(38250000)

    // 4. HPP Full Costing per Cup = Rp38.250.000 / 1.500 = Rp25.500 / cup
    expect(metrics.hppFullCostingPerUnit).toBe(25500)

    // 5. Margin Analisis
    // Gross Profit per Cup = 28.000 - 10.500 = Rp17.500
    expect(metrics.grossProfitPerUnit).toBe(17500)
    // Gross Margin % = (17.500 / 28.000) * 100 = 62.5%
    expect(metrics.grossMarginPercent).toBe(62.5)

    // Net Profit per Cup = 28.000 - 25.500 = Rp2.500
    expect(metrics.netProfitPerUnit).toBe(2500)
    // Net Margin % = (2.500 / 28.000) * 100 = 8.9%
    expect(metrics.netMarginPercent).toBe(8.9)
  })

  it('menghitung HPP dengan toleransi share loss 0% secara presisi tanpa susut tambahan', () => {
    const profile: CashflowProfileData = {
      periodName: 'Zero Loss Batch',
      initialCapital: 30000000,
      rawMaterialCost: 10000000,
      operationalCost: 3000000,
      overheadCost: 5000000,
      salaryStaff: 7000000,
      salaryOwner: 3000000,
      targetProductionQty: 1000,
      shareLossPercentage: 0,
      sellingPricePerUnit: 30000,
    }

    const metrics = calculateCashflowMetrics(profile, 30000000)
    expect(metrics.shareLossNominal).toBe(0)
    expect(metrics.totalMaterialWithLoss).toBe(10000000)
    expect(metrics.hppBahanPerUnit).toBe(10000)
    expect(metrics.totalProductionCost).toBe(28000000)
    expect(metrics.hppFullCostingPerUnit).toBe(28000)
    expect(metrics.netProfitPerUnit).toBe(2000) // 30.000 - 28.000
  })

  it('menghitung Arus Kas (Net Cash Flow) dan Saldo Kas Akhir tanpa double counting', () => {
    const profile: CashflowProfileData = {
      ...DEFAULT_CASHFLOW_PROFILE,
      initialCapital: 20000000, // Rp20.000.000 kas awal
      rawMaterialCost: 10000000,
      operationalCost: 2000000,
      overheadCost: 3000000,
      salaryStaff: 4000000,
      salaryOwner: 1000000,
      targetProductionQty: 1000,
      shareLossPercentage: 0,
      sellingPricePerUnit: 25000,
    }

    // Total Outflow = 10jt + 2jt + 3jt + 5jt = 20jt
    // Kasus 1: Omzet Riil Rp25.000.000 (Surplus Kas Rp5.000.000)
    const metricsSurplus = calculateCashflowMetrics(profile, 25000000)
    expect(metricsSurplus.totalCashOutflow).toBe(20000000)
    expect(metricsSurplus.netCashFlow).toBe(5000000)
    expect(metricsSurplus.endingCashBalance).toBe(25000000) // 20jt + 5jt

    // Kasus 2: Omzet Riil Rp15.000.000 (Defisit Kas Rp5.000.000)
    const metricsDeficit = calculateCashflowMetrics(profile, 15000000)
    expect(metricsDeficit.netCashFlow).toBe(-5000000)
    expect(metricsDeficit.endingCashBalance).toBe(15000000) // 20jt - 5jt
  })

  it('kebal terhadap division by zero ketika kuantitas produksi bernilai 0 (Zero-Division Safe)', () => {
    const zeroProfile: CashflowProfileData = {
      periodName: 'Uji Zero',
      initialCapital: 10000000,
      rawMaterialCost: 5000000,
      operationalCost: 2000000,
      overheadCost: 1000000,
      salaryStaff: 3000000,
      salaryOwner: 1000000,
      targetProductionQty: 0, // Target kuantitas 0
      shareLossPercentage: 5.0,
      sellingPricePerUnit: 25000,
    }

    const metrics = calculateCashflowMetrics(zeroProfile, 0)
    expect(metrics.hppBahanPerUnit).toBe(0)
    expect(metrics.hppFullCostingPerUnit).toBe(0)
    expect(Number.isFinite(metrics.hppBahanPerUnit)).toBe(true)
    expect(Number.isFinite(metrics.hppFullCostingPerUnit)).toBe(true)
    expect(Number.isFinite(metrics.netProfitPerUnit)).toBe(true)
    expect(metrics.endingCashBalance).toBe(10000000 - metrics.totalProductionCost)
  })
})
