import 'server-only'
import prisma from './db'
import { formatBpsPercentage } from './financial-calculator'
import { publishEvent } from './realtime-bus'
import type { StaffUser } from '@prisma/client'

export const MAIN_CONFIG_ID = 'cravio-main-config'

export interface CafeConfigDTO {
  id: string
  name: string
  tagline: string
  address: string | null
  phone: string | null
  taxRateBps: number
  serviceRateBps: number
  isTaxInclusive: boolean
  currency: string
  timezone: string
  openingHours: string | null
  qrisTimeoutMinutes: number
  cashTimeoutMinutes: number
  quizVersion: number
  productionDomain: string | null
  taxPercentageFormatted: string
  servicePercentageFormatted: string
  // Metode Pembayaran Fleksibel
  enableMidtransQris: boolean
  enableCash: boolean
  enableManualQris: boolean
  manualQrisImageUrl: string | null
  manualQrisName: string | null
  enableManualTransfer: boolean
  manualTransferBank: string | null
  manualTransferAccount: string | null
  manualTransferName: string | null
}

export interface UpdateCafeIdentityInput {
  name: string
  tagline: string
  address?: string | null
  phone?: string | null
  openingHours?: string | null
  productionDomain?: string | null
}

export interface UpdatePaymentMethodsInput {
  enableMidtransQris?: boolean
  enableCash?: boolean
  enableManualQris?: boolean
  manualQrisImageUrl?: string | null
  manualQrisName?: string | null
  enableManualTransfer?: boolean
  manualTransferBank?: string | null
  manualTransferAccount?: string | null
  manualTransferName?: string | null
}

export interface UpdateFinancialPolicyInput {
  taxRateBps: number
  serviceRateBps: number
  isTaxInclusive: boolean
}

/**
 * Mengambil konfigurasi kafe utama Cravio (atau membuat konfigurasi awal jika belum ada).
 */
export async function getCafeConfig(): Promise<CafeConfigDTO> {
  let config = await prisma.cravioConfig.findUnique({
    where: { id: MAIN_CONFIG_ID },
  })

  if (!config) {
    config = await prisma.cravioConfig.create({
      data: {
        id: MAIN_CONFIG_ID,
        name: 'Cravio',
        tagline: 'Your craving, Perfectly Matched',
        address: 'Jl. Senopati No. 42, Jakarta Selatan',
        phone: '0812-3456-7890',
        taxRateBps: 0,
        serviceRateBps: 0,
        isTaxInclusive: false,
        currency: 'IDR',
        timezone: 'Asia/Jakarta',
        openingHours: '08:00 - 22:00 WIB',
        qrisTimeoutMinutes: 15,
        cashTimeoutMinutes: 20,
        quizVersion: 1,
      },
    })
  }

  return {
    ...config,
    taxPercentageFormatted: formatBpsPercentage(config.taxRateBps),
    servicePercentageFormatted: formatBpsPercentage(config.serviceRateBps),
  }
}

/**
 * Memperbarui identitas dan kontak resmi kafe.
 */
export async function updateCafeIdentity(
  input: UpdateCafeIdentityInput,
  actor: StaffUser,
  ipAddress?: string | null
): Promise<CafeConfigDTO> {
  const current = await getCafeConfig()

  const updated = await prisma.cravioConfig.update({
    where: { id: MAIN_CONFIG_ID },
    data: {
      name: input.name.trim(),
      tagline: input.tagline.trim(),
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      openingHours: input.openingHours?.trim() || null,
      productionDomain: input.productionDomain?.trim() || null,
    },
  })

  await prisma.auditLog.create({
    data: {
      staffUserId: actor.id,
      action: 'CONFIG_UPDATED',
      details: JSON.stringify({
        actor: actor.username,
        role: actor.role,
        previous: {
          name: current.name,
          tagline: current.tagline,
          address: current.address,
          phone: current.phone,
          openingHours: current.openingHours,
        },
        new: {
          name: updated.name,
          tagline: updated.tagline,
          address: updated.address,
          phone: updated.phone,
          openingHours: updated.openingHours,
        },
      }),
      ipAddress: ipAddress || '127.0.0.1',
    },
  })

  await publishEvent({
    channel: 'CATALOG',
    aggregateType: 'CONFIG',
    aggregateId: MAIN_CONFIG_ID,
    eventType: 'CONFIG_UPDATED',
    payload: {
      name: updated.name,
      openingHours: updated.openingHours,
    },
  })

  return {
    ...updated,
    taxPercentageFormatted: formatBpsPercentage(updated.taxRateBps),
    servicePercentageFormatted: formatBpsPercentage(updated.serviceRateBps),
  }
}

/**
 * Memperbarui kebijakan finansial kafe (pajak PB1, service charge, dan mode inklusif).
 * Mutlak membutuhkan otorisasi ADMIN.
 */
export async function updateFinancialPolicy(
  input: UpdateFinancialPolicyInput,
  actor: StaffUser,
  ipAddress?: string | null
): Promise<CafeConfigDTO> {
  const current = await getCafeConfig()

  const safeTaxRate = Math.min(5000, Math.max(0, Math.floor(input.taxRateBps)))
  const safeServiceRate = Math.min(5000, Math.max(0, Math.floor(input.serviceRateBps)))
  const isTaxInclusive = Boolean(input.isTaxInclusive)

  const updated = await prisma.cravioConfig.update({
    where: { id: MAIN_CONFIG_ID },
    data: {
      taxRateBps: safeTaxRate,
      serviceRateBps: safeServiceRate,
      isTaxInclusive,
    },
  })

  await prisma.auditLog.create({
    data: {
      staffUserId: actor.id,
      action: 'FINANCIAL_POLICY_UPDATED',
      details: JSON.stringify({
        actor: actor.username,
        role: actor.role,
        previous: {
          taxRateBps: current.taxRateBps,
          serviceRateBps: current.serviceRateBps,
          isTaxInclusive: current.isTaxInclusive,
        },
        new: {
          taxRateBps: updated.taxRateBps,
          serviceRateBps: updated.serviceRateBps,
          isTaxInclusive: updated.isTaxInclusive,
        },
      }),
      ipAddress: ipAddress || '127.0.0.1',
    },
  })

  await publishEvent({
    channel: 'CATALOG',
    aggregateType: 'CONFIG',
    aggregateId: MAIN_CONFIG_ID,
    eventType: 'CONFIG_UPDATED',
    payload: {
      taxRateBps: updated.taxRateBps,
      serviceRateBps: updated.serviceRateBps,
      isTaxInclusive: updated.isTaxInclusive,
    },
  })

  return {
    ...updated,
    taxPercentageFormatted: formatBpsPercentage(updated.taxRateBps),
    servicePercentageFormatted: formatBpsPercentage(updated.serviceRateBps),
  }
}

/**
 * Memperbarui konfigurasi metode pembayaran (Midtrans, Tunai, QRIS Statis, Transfer Bank).
 */
export async function updatePaymentMethodsConfig(
  input: UpdatePaymentMethodsInput,
  actor: StaffUser,
  ipAddress?: string | null
): Promise<CafeConfigDTO> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {}

  if (input.enableMidtransQris !== undefined) updateData.enableMidtransQris = Boolean(input.enableMidtransQris)
  if (input.enableCash !== undefined) updateData.enableCash = Boolean(input.enableCash)
  if (input.enableManualQris !== undefined) updateData.enableManualQris = Boolean(input.enableManualQris)
  if (input.manualQrisImageUrl !== undefined) updateData.manualQrisImageUrl = input.manualQrisImageUrl?.trim() || null
  if (input.manualQrisName !== undefined) updateData.manualQrisName = input.manualQrisName?.trim() || 'QRIS Kafe'
  if (input.enableManualTransfer !== undefined) updateData.enableManualTransfer = Boolean(input.enableManualTransfer)
  if (input.manualTransferBank !== undefined) updateData.manualTransferBank = input.manualTransferBank?.trim() || null
  if (input.manualTransferAccount !== undefined) updateData.manualTransferAccount = input.manualTransferAccount?.trim() || null
  if (input.manualTransferName !== undefined) updateData.manualTransferName = input.manualTransferName?.trim() || null

  const updated = await prisma.cravioConfig.update({
    where: { id: MAIN_CONFIG_ID },
    data: updateData,
  })

  await prisma.auditLog.create({
    data: {
      staffUserId: actor.id,
      action: 'PAYMENT_METHODS_UPDATED',
      details: JSON.stringify({
        actor: actor.username,
        role: actor.role,
        updatedFields: Object.keys(updateData),
      }),
      ipAddress: ipAddress || '127.0.0.1',
    },
  })

  await publishEvent({
    channel: 'CATALOG',
    aggregateType: 'CONFIG',
    aggregateId: MAIN_CONFIG_ID,
    eventType: 'PAYMENT_METHODS_UPDATED',
    payload: updateData,
  })

  return {
    ...updated,
    taxPercentageFormatted: formatBpsPercentage(updated.taxRateBps),
    servicePercentageFormatted: formatBpsPercentage(updated.serviceRateBps),
  }
}





