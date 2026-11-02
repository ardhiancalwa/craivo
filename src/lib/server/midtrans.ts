import 'server-only'
import crypto from 'node:crypto'
import { getServerEnv } from './env'

export class MidtransGatewayError extends Error {
  statusCode: number
  midtransCode?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any

  constructor(
    message: string,
    statusCode = 502,
    midtransCode?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details?: any
  ) {
    super(message)
    this.name = 'MidtransGatewayError'
    this.statusCode = statusCode
    this.midtransCode = midtransCode
    this.details = details
  }
}

export class MidtransTimeoutError extends Error {
  merchantOrderId: string

  constructor(merchantOrderId: string, message = 'Koneksi ke gateway Midtrans mengalami timeout.') {
    super(message)
    this.name = 'MidtransTimeoutError'
    this.merchantOrderId = merchantOrderId
  }
}

export interface ChargeQrisParams {
  orderId: string // merchantOrderId unik per attempt (e.g. SELA-261029-001-P1)
  grossAmount: number // Integer IDR
  expiryMinutes?: number // Default 15
}

export interface MidtransChargeResult {
  statusCode: string
  statusMessage: string
  transactionId: string
  orderId: string
  grossAmount: number
  currency: string
  paymentType: string
  transactionTime: string
  transactionStatus: string
  fraudStatus?: string
  acquirer?: string
  qrString?: string
  qrUrl?: string | null
  expiryTime?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawResponse: any
}

export interface MidtransStatusResult {
  notFound?: boolean
  statusCode: string
  statusMessage: string
  transactionId?: string
  orderId: string
  grossAmount?: number
  paymentType?: string
  transactionStatus: string // 'pending' | 'settlement' | 'capture' | 'deny' | 'cancel' | 'expire' | 'failure'
  fraudStatus?: string
  transactionTime?: string
  expiryTime?: string
  signatureKey?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawResponse: any
}

/**
 * Mendapatkan Base URL Midtrans sesuai konfigurasi (Sandbox atau Production).
 */
export function getMidtransBaseUrl(): string {
  const env = getServerEnv()
  return env.MIDTRANS_IS_PRODUCTION
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com'
}

/**
 * Mendapatkan Header Authorization HTTP Basic Auth Midtrans (server-only).
 */
export function getMidtransAuthHeader(): string {
  const env = getServerEnv()
  const rawAuth = `${env.MIDTRANS_SERVER_KEY}:`
  return `Basic ${Buffer.from(rawAuth).toString('base64')}`
}

/**
 * Format timestamp untuk custom_expiry Midtrans: YYYY-MM-DD HH:mm:ss +0700 (Asia/Jakarta).
 */
export function formatMidtransOrderTime(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const y = parts.find((p) => p.type === 'year')?.value || '2026'
  const m = parts.find((p) => p.type === 'month')?.value || '10'
  const d = parts.find((p) => p.type === 'day')?.value || '29'
  const hh = parts.find((p) => p.type === 'hour')?.value || '12'
  const mm = parts.find((p) => p.type === 'minute')?.value || '00'
  const ss = parts.find((p) => p.type === 'second')?.value || '00'

  return `${y}-${m}-${d} ${hh}:${mm}:${ss} +0700`
}

/**
 * Memanggil Midtrans Core API POST /v2/charge untuk membuat charge QRIS dinamis.
 */
export async function chargeQris(params: ChargeQrisParams): Promise<MidtransChargeResult> {
  const { orderId, grossAmount, expiryMinutes = 15 } = params
  const baseUrl = getMidtransBaseUrl()
  const authHeader = getMidtransAuthHeader()

  const payload = {
    payment_type: 'qris',
    transaction_details: {
      order_id: orderId,
      gross_amount: Math.round(grossAmount),
    },
    qris: {
      acquirer: 'gopay',
    },
    custom_expiry: {
      order_time: formatMidtransOrderTime(),
      expiry_duration: expiryMinutes,
      unit: 'minute',
    },
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}/v2/charge`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10 detik batas waktu jaringan
    })
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new MidtransTimeoutError(orderId)
    }
    throw new MidtransGatewayError(
      `Gagal terhubung ke gateway Midtrans: ${err instanceof Error ? err.message : String(err)}`,
      502
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any
  try {
    data = await response.json()
  } catch {
    throw new MidtransGatewayError('Format respons dari gateway Midtrans bukan JSON valid.', 502)
  }

  // Status code 201 menandakan transaksi berhasil dibuat
  if (data.status_code !== '201' && data.status_code !== '200') {
    throw new MidtransGatewayError(
      data.status_message || 'Pembuatan transaksi QRIS ditolak oleh gateway.',
      response.status === 400 || response.status === 406 ? 400 : 502,
      data.status_code,
      data
    )
  }

  // Ambil URL gambar QR Code dari actions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qrAction = data.actions?.find((act: any) => act.name === 'generate-qr-code')
  const qrUrl = qrAction?.url || null

  return {
    statusCode: data.status_code,
    statusMessage: data.status_message,
    transactionId: data.transaction_id,
    orderId: data.order_id,
    grossAmount: Number.parseFloat(data.gross_amount) || grossAmount,
    currency: data.currency || 'IDR',
    paymentType: data.payment_type || 'qris',
    transactionTime: data.transaction_time,
    transactionStatus: data.transaction_status,
    fraudStatus: data.fraud_status,
    acquirer: data.acquirer,
    qrString: data.qr_string,
    qrUrl,
    expiryTime: data.expiry_time,
    rawResponse: data,
  }
}

/**
 * Memanggil Midtrans Core API GET /v2/{order_id}/status untuk memeriksa status transaksi resmi.
 */
export async function getTransactionStatus(
  merchantOrderId: string
): Promise<MidtransStatusResult> {
  const baseUrl = getMidtransBaseUrl()
  const authHeader = getMidtransAuthHeader()

  let response: Response
  try {
    response = await fetch(`${baseUrl}/v2/${encodeURIComponent(merchantOrderId)}/status`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new MidtransTimeoutError(merchantOrderId)
    }
    throw new MidtransGatewayError(
      `Gagal mengambil status transaksi dari Midtrans: ${err instanceof Error ? err.message : String(err)}`,
      502
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any
  try {
    data = await response.json()
  } catch {
    throw new MidtransGatewayError('Format respons status dari Midtrans bukan JSON valid.', 502)
  }

  if (response.status === 404 || data.status_code === '404') {
    return {
      notFound: true,
      statusCode: '404',
      statusMessage: data.status_message || "Transaction doesn't exist.",
      orderId: merchantOrderId,
      transactionStatus: 'not_found',
      rawResponse: data,
    }
  }

  return {
    notFound: false,
    statusCode: data.status_code,
    statusMessage: data.status_message,
    transactionId: data.transaction_id,
    orderId: data.order_id,
    grossAmount: Number.parseFloat(data.gross_amount) || 0,
    paymentType: data.payment_type,
    transactionStatus: data.transaction_status,
    fraudStatus: data.fraud_status,
    transactionTime: data.transaction_time,
    expiryTime: data.expiry_time,
    signatureKey: data.signature_key,
    rawResponse: data,
  }
}

/**
 * Mem-parse nominal uang dari string representasi Midtrans secara aman tanpa menggunakan
 * parseInt atau parseFloat yang dapat menyembunyikan pecahan desimal tidak sah (misal .50 atau .99).
 * Hanya menerima integer IDR murni (misal "38000" atau "38000.00").
 */
export function parseAndValidateIdrAmount(rawGrossAmount: string): number {
  if (typeof rawGrossAmount !== 'string') {
    throw new Error('Nominal gross_amount wajib berupa string asli dari payload gateway.')
  }

  const trimmed = rawGrossAmount.trim()
  // Hanya menerima angka integer atau desimal tepat .00
  const match = trimmed.match(/^(\d+)(\.00)?$/)
  if (!match) {
    throw new Error(
      `Format nominal uang tidak sah atau memuat pecahan desimal tidak diperkenankan pada IDR: "${rawGrossAmount}"`
    )
  }

  const integerStr = match[1]
  const amount = Number(integerStr)

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`Nominal bukan integer positif yang aman: "${rawGrossAmount}"`)
  }

  return amount
}

/**
 * Memverifikasi signature SHA-512 callback Midtrans:
 * SHA512(order_id + status_code + gross_amount + ServerKey)
 * Menggunakan representasi string asli dan pembandingan timingSafeEqual untuk menangkal timing attack.
 */
export function verifyMidtransSignature(params: {
  orderId: string
  statusCode: string
  grossAmount: string
  signatureKey: string
  serverKey?: string
}): boolean {
  const { orderId, statusCode, grossAmount, signatureKey, serverKey } = params
  const env = getServerEnv()
  const keyToUse = serverKey || env.MIDTRANS_SERVER_KEY

  if (!signatureKey || typeof signatureKey !== 'string') {
    return false
  }

  const payloadString = `${orderId}${statusCode}${grossAmount}${keyToUse}`
  const expectedHash = crypto.createHash('sha512').update(payloadString).digest('hex')

  const signatureBuffer = Buffer.from(signatureKey.toLowerCase(), 'utf-8')
  const expectedBuffer = Buffer.from(expectedHash.toLowerCase(), 'utf-8')

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
}

/**
 * Memanggil Midtrans Core API POST /v2/{order_id}/expire untuk menutup transaksi pending secara paksa.
 */
export async function expireTransaction(
  merchantOrderId: string
): Promise<MidtransStatusResult> {
  const baseUrl = getMidtransBaseUrl()
  const authHeader = getMidtransAuthHeader()

  let response: Response
  try {
    response = await fetch(`${baseUrl}/v2/${encodeURIComponent(merchantOrderId)}/expire`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new MidtransTimeoutError(merchantOrderId)
    }
    throw new MidtransGatewayError(
      `Gagal meminta kedaluwarsa transaksi ke Midtrans: ${err instanceof Error ? err.message : String(err)}`,
      502
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any
  try {
    data = await response.json()
  } catch {
    throw new MidtransGatewayError('Format respons expire dari Midtrans bukan JSON valid.', 502)
  }

  return {
    notFound: response.status === 404 || data.status_code === '404',
    statusCode: data.status_code,
    statusMessage: data.status_message,
    transactionId: data.transaction_id,
    orderId: merchantOrderId,
    transactionStatus: data.transaction_status || 'expire',
    rawResponse: data,
  }
}

/**
 * Memanggil Midtrans Core API POST /v2/{order_id}/cancel untuk membatalkan transaksi pending secara resmi.
 */
export async function cancelTransaction(
  merchantOrderId: string
): Promise<MidtransStatusResult> {
  const baseUrl = getMidtransBaseUrl()
  const authHeader = getMidtransAuthHeader()

  let response: Response
  try {
    response = await fetch(`${baseUrl}/v2/${encodeURIComponent(merchantOrderId)}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new MidtransTimeoutError(merchantOrderId)
    }
    throw new MidtransGatewayError(
      `Gagal meminta pembatalan transaksi ke Midtrans: ${err instanceof Error ? err.message : String(err)}`,
      502
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any
  try {
    data = await response.json()
  } catch {
    throw new MidtransGatewayError('Format respons cancel dari Midtrans bukan JSON valid.', 502)
  }

  return {
    notFound: response.status === 404 || data.status_code === '404',
    statusCode: data.status_code,
    statusMessage: data.status_message,
    transactionId: data.transaction_id,
    orderId: merchantOrderId,
    transactionStatus: data.transaction_status || 'cancel',
    rawResponse: data,
  }
}

