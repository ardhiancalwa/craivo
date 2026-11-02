// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock table-service & guest-session
vi.mock('@/lib/server/table-service', () => ({
  validateTableServer: vi.fn(),
}))

vi.mock('@/lib/server/guest-session', () => ({
  createGuestSession: vi.fn(),
}))

import { GET } from '@/app/(customer)/order/route'
import { validateTableServer } from '@/lib/server/table-service'
import { createGuestSession } from '@/lib/server/guest-session'

describe('Order Table Resolver Route Handler (GET /order?table=...)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /quiz and sets cravio_guest & cravio_table cookies when table is VALID', async () => {
    vi.mocked(validateTableServer).mockResolvedValueOnce({
      status: 'VALID',
      tableNumber: '01',
      table: {
        id: 'table-uuid-01',
        tableNumber: '01',
        qrSlug: 'slug-01',
        isActive: true,
      },
      message: 'Meja valid',
    })

    vi.mocked(createGuestSession).mockResolvedValueOnce({
      id: 'sess-uuid-01',
      token: 'jwt-guest-token-12345',
      guestSessionId: 'sess-uuid-01',
      rawSessionToken: 'raw-token',
      tableNumber: '01',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12),
    })

    const request = new NextRequest('http://localhost:3000/order?table=01')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/quiz?table=01')

    const guestCookie = response.cookies.get('cravio_guest')
    expect(guestCookie).toBeDefined()
    expect(guestCookie?.value).toBe('jwt-guest-token-12345')
    expect(guestCookie?.httpOnly).toBe(true)

    const tableCookie = response.cookies.get('cravio_table')
    expect(tableCookie).toBeDefined()
    expect(tableCookie?.value).toBe('01')
    expect(tableCookie?.httpOnly).toBe(false)
  })

  it('redirects to /order/status with code when table is NOT_FOUND', async () => {
    vi.mocked(validateTableServer).mockResolvedValueOnce({
      status: 'NOT_FOUND',
      tableNumber: '99',
      table: null,
      message: 'Nomor meja tidak ditemukan.',
    })

    const request = new NextRequest('http://localhost:3000/order?table=99')
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location') || ''
    expect(location).toContain('/order/status')
    expect(location).toContain('status=NOT_FOUND')
    expect(location).toContain('table=99')

    expect(response.cookies.get('cravio_guest')).toBeUndefined()
  })

  it('redirects to /order/status with code when table parameter is MISSING', async () => {
    vi.mocked(validateTableServer).mockResolvedValueOnce({
      status: 'MISSING',
      tableNumber: null,
      table: null,
      message: 'Silakan pindai ulang QR meja resmi.',
    })

    const request = new NextRequest('http://localhost:3000/order')
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location') || ''
    expect(location).toContain('/order/status')
    expect(location).toContain('status=MISSING')
  })
})
