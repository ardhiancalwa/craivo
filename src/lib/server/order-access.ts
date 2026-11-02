import 'server-only'
import { cookies } from 'next/headers'
import { prisma } from './db'
import { verifyOrderCapabilityToken } from './order-capability'
import { getAuthenticatedStaff } from './auth-guard'
import type { StaffRole } from '@prisma/client'
import type { StaffJWTPayload } from './auth'

export class OrderAccessError extends Error {
  code: string
  statusCode: number

  constructor(code = 'FORBIDDEN', message = 'Akses pesanan tidak diizinkan.', statusCode = 403) {
    super(message)
    this.name = 'OrderAccessError'
    this.code = code
    this.statusCode = statusCode
  }
}

/**
 * Mengekstrak orderSecretToken dari header X-Order-Secret-Token atau cookie HttpOnly cravio_ot_<orderId>.
 */
export async function extractOrderSecretToken(
  orderId: string,
  request?: Request
): Promise<string | null> {
  // 1. Coba dari header jika request object diberikan
  if (request) {
    const headerToken = request.headers.get('x-order-secret-token')
    if (headerToken && headerToken.trim()) {
      return headerToken.trim()
    }
  }

  // 2. Coba dari Next.js cookies()
  try {
    const cookieStore = await cookies()
    const cookieName = `cravio_ot_${orderId}`
    const cookieToken = cookieStore.get(cookieName)?.value
    if (cookieToken && cookieToken.trim()) {
      return cookieToken.trim()
    }
  } catch {
    // cookies() mungkin tidak tersedia di luar konteks request Next.js (misal di worker atau tes murni)
  }

  return null
}

/**
 * Memverifikasi hak akses capability token ke suatu order.
 * Mengembalikan data order lengkap jika terverifikasi, atau melempar OrderAccessError 403 seragam.
 * Menghindari kebocoran informasi apakah orderId ada atau tidak jika token salah.
 */
export async function verifyOrderAccess(
  orderId: string,
  providedToken?: string | null
) {
  if (!orderId || !providedToken) {
    throw new OrderAccessError('FORBIDDEN', 'Token akses pesanan tidak ditemukan atau tidak valid.', 403)
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      table: true,
      items: {
        include: {
          modifiers: true,
        },
      },
    },
  })

  if (!order || !order.orderSecretTokenHash) {
    // Berikan respons 403 yang sama persis seperti token salah
    throw new OrderAccessError('FORBIDDEN', 'Akses pesanan tidak diizinkan.', 403)
  }

  const isValid = verifyOrderCapabilityToken(providedToken, order.orderSecretTokenHash)
  if (!isValid) {
    throw new OrderAccessError('FORBIDDEN', 'Akses pesanan tidak diizinkan.', 403)
  }

  // Hapus field kriptografis sensitif sebelum dikembalikan ke pemanggil
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { orderSecretTokenHash, capabilityNonce, ...safeOrder } = order

  return safeOrder
}

export interface OrderAccessOptions {
  allowedRoles?: StaffRole[]
  allowCustomer?: boolean
}

export interface VerifiedOrderResult {
  order: Awaited<ReturnType<typeof verifyOrderAccess>>
  actorType: 'STAFF' | 'CUSTOMER'
  staffUser: StaffJWTPayload | null
}

/**
 * Memverifikasi apakah pemanggil berhak mengakses pesanan:
 * 1. Staf dengan role yang diizinkan (CASHIER, ADMIN, BARISTA).
 * 2. ATAU Pelanggan pemilik order dengan orderSecretToken yang sah.
 * Menolak akses ilegal dengan OrderAccessError 403 / 404.
 */
export async function verifyOrderOrStaffAccess(
  orderId: string,
  request?: Request,
  options: OrderAccessOptions = {}
): Promise<VerifiedOrderResult> {
  const {
    allowedRoles = ['CASHIER', 'ADMIN', 'BARISTA'],
    allowCustomer = true,
  } = options

  // 1. Coba periksa apakah request berasal dari staf terautentikasi
  const staff = await getAuthenticatedStaff(request)
  if (staff && staff.role && allowedRoles.includes(staff.role as StaffRole)) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    })

    if (!order) {
      throw new OrderAccessError('NOT_FOUND', 'Pesanan tidak ditemukan.', 404)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { orderSecretTokenHash, capabilityNonce, ...safeOrder } = order
    return {
      order: safeOrder,
      actorType: 'STAFF',
      staffUser: staff,
    }
  }

  // 2. Jika bukan staf atau role tidak cocok, periksa apakah akses pelanggan diizinkan
  if (allowCustomer) {
    const customerToken = await extractOrderSecretToken(orderId, request)
    if (customerToken) {
      const order = await verifyOrderAccess(orderId, customerToken)
      return {
        order,
        actorType: 'CUSTOMER',
        staffUser: null,
      }
    }
  }

  // 3. Jika bukan staf dan token pelanggan tidak ada / salah
  throw new OrderAccessError('FORBIDDEN', 'Akses pesanan tidak diizinkan.', 403)
}


