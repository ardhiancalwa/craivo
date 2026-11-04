import 'server-only'
import crypto from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { prisma } from './db'
import { calculateOrderFinancials } from './financial-calculator'
import { getServerEnv } from './env'

export interface QuoteItemInput {
  menuItemId: string
  selectedModifierOptionIds: string[]
  quantity: number // 1–50
  notes?: string // max 100
}

export interface QuoteRequestInput {
  tableNumber: string
  items: QuoteItemInput[]
  previousQuoteToken?: string // Optional token to detect PRICE_CHANGED
  guestSessionId?: string
}

export interface QuoteCalculatedItem {
  menuItemId: string
  name: string
  basePrice: number
  quantity: number
  notes?: string
  modifiers: Array<{
    optionId: string
    groupId: string
    groupName: string
    optionName: string
    price: number
  }>
  unitPrice: number
  subtotal: number
}

export interface CalculatedCartResult {
  calculatedItems: QuoteCalculatedItem[]
  subtotalAmount: number
  taxAmount: number
  serviceAmount: number
  totalAmount: number
  financialBreakdown?: {
    isTaxInclusive: boolean
    taxRateBps: number
    serviceRateBps: number
    taxPercentageFormatted: string
    servicePercentageFormatted: string
    netBaseAmount: number
  }
}

export interface QuoteResult {
  quoteId: string
  quoteToken: string
  tableNumber: string
  guestSessionId?: string
  subtotalAmount: number
  taxAmount: number
  serviceAmount: number
  totalAmount: number
  expiresAt: string
  items: QuoteCalculatedItem[]
  financialBreakdown?: {
    isTaxInclusive: boolean
    taxRateBps: number
    serviceRateBps: number
    taxPercentageFormatted: string
    servicePercentageFormatted: string
    netBaseAmount: number
  }
}

export interface QuoteTokenPayload {
  quoteId: string
  tableNumber: string
  gsid?: string
  itemsHash: string
  subtotalAmount: number
  taxAmount: number
  serviceAmount: number
  totalAmount: number
  itemsSnapshot: Array<{
    menuItemId: string
    name: string
    basePrice: number
    quantity: number
    unitPrice: number
    modifiers: Array<{
      optionId: string
      groupId: string
      groupName: string
      optionName: string
      price: number
    }>
  }>
}

export type QuoteErrorCode =
  | 'TABLE_NOT_FOUND'
  | 'TABLE_INACTIVE'
  | 'EMPTY_CART'
  | 'ITEM_NOT_FOUND'
  | 'ITEM_STOCK_DEPLETED'
  | 'MODIFIER_INVALID'
  | 'MODIFIER_GROUP_REQUIRED'
  | 'MODIFIER_GROUP_EXCEEDED'
  | 'PRICE_CHANGED'
  | 'QUOTE_EXPIRED'
  | 'QUOTE_INVALID'
  | 'VALIDATION_FAILED'

export class QuoteServiceError extends Error {
  code: QuoteErrorCode
  statusCode: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any

  constructor(
    code: QuoteErrorCode,
    message: string,
    statusCode = 400,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details?: any
  ) {
    super(message)
    this.name = 'QuoteServiceError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

/**
 * Validasi setiap baris item, stok, grup modifier, dan hitung subtotal secara authoritatif.
 */
export async function calculateCartItems(
  items: QuoteItemInput[]
): Promise<CalculatedCartResult> {
  if (!items || items.length === 0) {
    throw new QuoteServiceError(
      'EMPTY_CART',
      'Keranjang belanja masih kosong. Pilih menu sebelum meminta quote.',
      400
    )
  }

  const calculatedItems: QuoteCalculatedItem[] = []
  let subtotalAmount = 0

  for (const item of items) {
    // Validasi kuantitas 1-50
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) {
      throw new QuoteServiceError(
        'VALIDATION_FAILED',
        `Kuantitas menu harus berupa bilangan bulat antara 1 hingga 50 (diterima: ${item.quantity}).`,
        400
      )
    }

    // Validasi catatan (max 100 karakter)
    const safeNotes = item.notes ? item.notes.slice(0, 100).trim() : undefined

    // Ambil menu item beserta grup modifier yang ditugaskan ke menu ini
    const dbItem = await prisma.menuItem.findUnique({
      where: { id: item.menuItemId },
      include: {
        modifierGroups: {
          include: {
            group: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    })

    if (!dbItem || dbItem.isArchived) {
      throw new QuoteServiceError(
        'ITEM_NOT_FOUND',
        `Menu dengan ID ${item.menuItemId} tidak ditemukan atau telah diarsipkan.`,
        404
      )
    }

    // Stock guard: cek apakah menu habis
    if (!dbItem.isAvailable) {
      throw new QuoteServiceError(
        'ITEM_STOCK_DEPLETED',
        `Menu "${dbItem.name}" saat ini sedang habis. Silakan hapus atau ganti dengan menu lain.`,
        409,
        { depletedItemId: dbItem.id, itemName: dbItem.name }
      )
    }

    // Cek duplikasi option IDs dalam satu baris
    const rawOptions = item.selectedModifierOptionIds || []
    if (new Set(rawOptions).size !== rawOptions.length) {
      throw new QuoteServiceError(
        'MODIFIER_INVALID',
        `Opsi modifier pada menu "${dbItem.name}" tidak boleh diduplikasi.`,
        400
      )
    }

    // Petakan opsi modifier yang sah dan terdaftar untuk menu ini
    const allowedOptionsMap = new Map<
      string,
      {
        option: { id: string; name: string; price: number; isAvailable: boolean }
        group: {
          id: string
          name: string
          isRequired: boolean
          minSelect: number
          maxSelect: number
        }
      }
    >()

    const overrides = (dbItem.modifierPriceOverrides as Record<string, number> | null) || {}

    for (const mg of dbItem.modifierGroups) {
      for (const opt of mg.group.options) {
        const effectivePrice =
          typeof overrides[opt.id] === 'number' ? (overrides[opt.id] as number) : opt.price
        allowedOptionsMap.set(opt.id, {
          option: {
            id: opt.id,
            name: opt.name,
            price: effectivePrice,
            isAvailable: opt.isAvailable,
          },
          group: mg.group,
        })
      }
    }

    const selectedModifiersList: Array<{
      optionId: string
      groupId: string
      groupName: string
      optionName: string
      price: number
    }> = []

    let itemModifierSum = 0

    for (const optId of rawOptions) {
      const mapping = allowedOptionsMap.get(optId)
      if (!mapping) {
        throw new QuoteServiceError(
          'MODIFIER_INVALID',
          `Opsi modifier (${optId}) tidak terdaftar untuk menu "${dbItem.name}" atau diselundupkan dari menu lain.`,
          400
        )
      }

      if (!mapping.option.isAvailable) {
        throw new QuoteServiceError(
          'ITEM_STOCK_DEPLETED',
          `Varian "${mapping.option.name}" untuk menu "${dbItem.name}" sedang habis.`,
          409,
          { depletedOptionId: optId, optionName: mapping.option.name }
        )
      }

      selectedModifiersList.push({
        optionId: mapping.option.id,
        groupId: mapping.group.id,
        groupName: mapping.group.name,
        optionName: mapping.option.name,
        price: mapping.option.price,
      })
      itemModifierSum += mapping.option.price
    }

    // Verifikasi batasan grup modifier (isRequired, minSelect, maxSelect)
    for (const mg of dbItem.modifierGroups) {
      const group = mg.group
      const groupSelectedCount = rawOptions.filter(
        (id) => allowedOptionsMap.get(id)?.group.id === group.id
      ).length

      if (group.isRequired && groupSelectedCount < group.minSelect) {
        throw new QuoteServiceError(
          'MODIFIER_GROUP_REQUIRED',
          `Grup modifier "${group.name}" pada menu "${dbItem.name}" wajib dipilih (minimal ${group.minSelect}).`,
          400
        )
      }

      if (groupSelectedCount > group.maxSelect) {
        throw new QuoteServiceError(
          'MODIFIER_GROUP_EXCEEDED',
          `Pilihan pada grup modifier "${group.name}" melebihi batas maksimal ${group.maxSelect}.`,
          400
        )
      }
    }

    const unitPrice = dbItem.price + itemModifierSum
    const lineSubtotal = unitPrice * item.quantity
    subtotalAmount += lineSubtotal

    calculatedItems.push({
      menuItemId: dbItem.id,
      name: dbItem.name,
      basePrice: dbItem.price,
      quantity: item.quantity,
      notes: safeNotes,
      modifiers: selectedModifiersList,
      unitPrice,
      subtotal: lineSubtotal,
    })
  }

  // Pajak & Layanan dihitung berdasarkan kebijakan aktif kafe
  const cafeConfig = await prisma.cravioConfig.findUnique({
    where: { id: 'cravio-main-config' },
  })

  const financials = calculateOrderFinancials(subtotalAmount, {
    taxRateBps: cafeConfig?.taxRateBps ?? 0,
    serviceRateBps: cafeConfig?.serviceRateBps ?? 0,
    isTaxInclusive: cafeConfig?.isTaxInclusive ?? false,
  })

  return {
    calculatedItems,
    subtotalAmount: financials.subtotalAmount,
    taxAmount: financials.taxAmount,
    serviceAmount: financials.serviceAmount,
    totalAmount: financials.totalAmount,
    financialBreakdown: {
      isTaxInclusive: financials.isTaxInclusive,
      taxRateBps: financials.taxRateBps,
      serviceRateBps: financials.serviceRateBps,
      taxPercentageFormatted: financials.taxPercentageFormatted,
      servicePercentageFormatted: financials.servicePercentageFormatted,
      netBaseAmount: financials.netBaseAmount,
    },
  }
}

/**
 * Menghitung hash kanonis isi keranjang untuk deteksi perubahan.
 */
export function computeCanonicalItemsHash(
  tableNumber: string,
  items: QuoteCalculatedItem[],
  totalAmount: number
): string {
  const canonicalItems = items
    .map((it) => ({
      menuItemId: it.menuItemId,
      optionIds: it.modifiers.map((m) => m.optionId).sort(),
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      notes: it.notes || '',
    }))
    .sort((a, b) => a.menuItemId.localeCompare(b.menuItemId))

  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        tableNumber: tableNumber.trim(),
        canonicalItems,
        totalAmount,
      })
    )
    .digest('hex')
}

/**
 * Mengalkulasi subtotal dan total harga pesanan secara server-authoritative
 * dan menerbitkan token quote kriptografis yang berlaku selama 15 menit.
 */
export async function createOrderQuote(
  input: QuoteRequestInput
): Promise<QuoteResult> {
  const { tableNumber, items, previousQuoteToken, guestSessionId } = input

  // 1. Validasi Meja
  const cleanTableNumber = tableNumber.trim()
  const table = await prisma.table.findUnique({
    where: { tableNumber: cleanTableNumber },
  })

  if (!table) {
    throw new QuoteServiceError(
      'TABLE_NOT_FOUND',
      `Meja ${cleanTableNumber} tidak ditemukan. Silakan pindai ulang QR meja resmi.`,
      404
    )
  }

  if (!table.isActive) {
    throw new QuoteServiceError(
      'TABLE_INACTIVE',
      `Meja ${cleanTableNumber} sedang dinonaktifkan oleh staf kafe.`,
      403
    )
  }

  // 2. Hitung Keranjang
  const calc = await calculateCartItems(items)

  // 3. Cek Perubahan Harga vs Previous Quote (PRICE_CHANGED Detection)
  if (previousQuoteToken) {
    try {
      const secret = new TextEncoder().encode(getServerEnv().JWT_SECRET)
      const { payload } = await jwtVerify(previousQuoteToken, secret)
      const prevTotal = payload.totalAmount as number

      if (prevTotal !== undefined && prevTotal !== calc.totalAmount) {
        throw new QuoteServiceError(
          'PRICE_CHANGED',
          `Harga menu telah diperbarui oleh kafe dari Rp${prevTotal.toLocaleString('id-ID')} menjadi Rp${calc.totalAmount.toLocaleString('id-ID')}. Silakan konfirmasi ulang sebelum melanjutkan.`,
          409,
          {
            previousTotal: prevTotal,
            updatedTotal: calc.totalAmount,
          }
        )
      }
    } catch (err: unknown) {
      if (err instanceof QuoteServiceError) {
        throw err
      }
      // If previous token was expired or corrupt, continue generating fresh quote
    }
  }

  // 4. Hash kanonis
  const itemsHash = computeCanonicalItemsHash(
    cleanTableNumber,
    calc.calculatedItems,
    calc.totalAmount
  )

  const quoteId = `quote_${crypto.randomUUID()}`
  const expiresAtDate = new Date(Date.now() + 15 * 60 * 1000) // 15 menit
  const expiresAt = expiresAtDate.toISOString()

  // 5. Terbitkan Quote Token (JWT Bertanda Tangan Kriptografis)
  const secretKey = new TextEncoder().encode(getServerEnv().JWT_SECRET)
  const quoteToken = await new SignJWT({
    quoteId,
    tableNumber: cleanTableNumber,
    gsid: guestSessionId,
    itemsHash,
    subtotalAmount: calc.subtotalAmount,
    taxAmount: calc.taxAmount,
    serviceAmount: calc.serviceAmount,
    totalAmount: calc.totalAmount,
    itemsSnapshot: calc.calculatedItems.map((it) => ({
      menuItemId: it.menuItemId,
      name: it.name,
      basePrice: it.basePrice,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      modifiers: it.modifiers,
    })),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secretKey)

  return {
    quoteId,
    quoteToken,
    tableNumber: cleanTableNumber,
    guestSessionId,
    subtotalAmount: calc.subtotalAmount,
    taxAmount: calc.taxAmount,
    serviceAmount: calc.serviceAmount,
    totalAmount: calc.totalAmount,
    expiresAt,
    items: calc.calculatedItems,
    financialBreakdown: calc.financialBreakdown,
  }
}

/**
 * Memverifikasi validitas token quote secara kriptografis.
 */
export async function verifyQuoteToken(
  quoteToken: string
): Promise<QuoteTokenPayload> {
  try {
    const secretKey = new TextEncoder().encode(getServerEnv().JWT_SECRET)
    const { payload } = await jwtVerify(quoteToken, secretKey)
    return payload as unknown as QuoteTokenPayload
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('expired') || message.includes('exp claim')) {
      throw new QuoteServiceError(
        'QUOTE_EXPIRED',
        'Quote pesanan telah kedaluwarsa (berlaku 15 menit). Silakan perbarui quote.',
        409
      )
    }
    throw new QuoteServiceError(
      'QUOTE_INVALID',
      'Token quote tidak valid atau rusak.',
      400
    )
  }
}
