// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import prisma from '@/lib/server/db'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { POST as logoutHandler } from '@/app/api/auth/logout/route'
import { GET as meHandler } from '@/app/api/auth/me/route'
import { POST as confirmCashHandler } from '@/app/api/staff/orders/[id]/confirm-cash/route'
import { PATCH as updatePriceHandler } from '@/app/api/staff/menu/[id]/price/route'
import { PATCH as toggleStockHandler } from '@/app/api/staff/menu/[id]/stock/route'
import { signStaffToken, hashCredential, STAFF_COOKIE_NAME } from '@/lib/server/auth'
import { OrderStatus, PaymentStatus, PaymentMethod } from '@prisma/client'

describe('Staff Authentication & RBAC Authorization Suite', () => {
  let testOrderId: string
  let sampleMenuId: string
  let deactivatedStaffToken: string
  let deactivatedStaffId: string

  beforeAll(async () => {
    // 1. Ensure test table and order exist for testing mutations
    const table = await prisma.table.findFirstOrThrow({ where: { tableNumber: '01' } })
    const menu = await prisma.menuItem.findFirstOrThrow({ where: { id: 'menu-kopi-sela' } })
    sampleMenuId = menu.id

    const order = await prisma.order.create({
      data: {
        orderNumber: `AUTH-TEST-ORD-${Date.now()}`,
        orderSecretTokenHash: 'test-secret-hash',
        tableId: table.id,
        subtotalAmount: 28000,
        totalAmount: 28000,
        paymentStatus: PaymentStatus.UNPAID,
        paymentMethod: PaymentMethod.CASH,
        orderStatus: OrderStatus.QUEUED,
      },
    })
    testOrderId = order.id

    // 2. Create a test staff user that will be deactivated
    const deactivatedStaff = await prisma.staffUser.create({
      data: {
        username: `deactivated_${Date.now()}`,
        displayName: 'Mantan Karyawan',
        role: 'CASHIER',
        pinHash: await hashCredential('9999'),
        isActive: false, // Deactivated!
      },
    })
    deactivatedStaffId = deactivatedStaff.id

    // Generate valid JWT token for this deactivated user (simulating old active session)
    deactivatedStaffToken = await signStaffToken({
      sub: deactivatedStaff.id,
      username: deactivatedStaff.username,
      displayName: deactivatedStaff.displayName,
      role: deactivatedStaff.role,
    })
  })

  afterAll(async () => {
    // Clean up
    if (testOrderId) {
      await prisma.order.delete({ where: { id: testOrderId } }).catch(() => {})
    }
    if (deactivatedStaffId) {
      await prisma.staffUser.delete({ where: { id: deactivatedStaffId } }).catch(() => {})
    }
  })

  it('allows valid login for Admin with password and returns HttpOnly cookie', async () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      body: JSON.stringify({
        username: 'admin',
        pinOrPassword: 'adminpassword123',
      }),
    })

    const res = await loginHandler(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.user.username).toBe('admin')
    expect(data.user.role).toBe('ADMIN')

    // Verify Set-Cookie header contains HttpOnly and SameSite=Lax
    const cookieHeader = res.headers.get('set-cookie')
    expect(cookieHeader).toBeDefined()
    expect(cookieHeader).toContain(STAFF_COOKIE_NAME)
    expect(cookieHeader?.toLowerCase()).toContain('httponly')
    expect(cookieHeader?.toLowerCase()).toContain('samesite=lax')
  })

  it('allows valid login for Cashier with PIN "1234"', async () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      body: JSON.stringify({
        username: 'kasir',
        pinOrPassword: '1234',
      }),
    })

    const res = await loginHandler(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.user.role).toBe('CASHIER')
  })

  it('allows valid login for Barista (Kitchen) with PIN "5678"', async () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      body: JSON.stringify({
        username: 'barista',
        pinOrPassword: '5678',
      }),
    })

    const res = await loginHandler(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.user.role).toBe('BARISTA')
  })

  it('rejects invalid PIN or password with 401 Unauthorized', async () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      body: JSON.stringify({
        username: 'kasir',
        pinOrPassword: 'wrongpassword',
      }),
    })

    const res = await loginHandler(req)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('INVALID_CREDENTIALS')
  })

  it('locks out staff account after 5 consecutive failed attempts (429 Too Many Requests)', async () => {
    const testUsername = `lockout_test_${Date.now()}`
    const staff = await prisma.staffUser.create({
      data: {
        username: testUsername,
        displayName: 'Lockout Test Subject',
        role: 'CASHIER',
        pinHash: await hashCredential('1234'),
        isActive: true,
      },
    })

    try {
      // 5 consecutive wrong attempts
      for (let i = 1; i <= 5; i++) {
        const req = new Request('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            origin: 'http://localhost:3000',
            host: 'localhost:3000',
          },
          body: JSON.stringify({
            username: testUsername,
            pinOrPassword: 'wrong_pin_attempt',
          }),
        })
        const res = await loginHandler(req)
        if (i < 5) {
          expect(res.status).toBe(401)
        } else {
          // On the 5th failed attempt, the account is locked!
          expect(res.status).toBe(429)
        }
      }

      // 6th attempt should be immediately rejected with 429
      const req6 = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        },
        body: JSON.stringify({
          username: testUsername,
          pinOrPassword: '1234', // Even with correct PIN, must be blocked!
        }),
      })
      const res6 = await loginHandler(req6)
      expect(res6.status).toBe(429)
      const data6 = await res6.json()
      expect(data6.error).toBe('ACCOUNT_LOCKED')
    } finally {
      await prisma.staffUser.delete({ where: { id: staff.id } }).catch(() => {})
    }
  })

  it('blocks Guest (unauthenticated) from accessing staff mutation endpoints with 401', async () => {
    const req = new Request(`http://localhost:3000/api/staff/orders/${testOrderId}/confirm-cash`, {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
    })

    const res = await confirmCashHandler(req, { params: Promise.resolve({ id: testOrderId }) })
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('UNAUTHORIZED')
  })

  it('blocks deactivated staff from executing mutations even with a valid JWT token (403)', async () => {
    // deactivatedStaffToken is cryptographically valid, but user is marked isActive=false in DB
    const req = new Request(`http://localhost:3000/api/staff/orders/${testOrderId}/confirm-cash`, {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        cookie: `${STAFF_COOKIE_NAME}=${deactivatedStaffToken}`,
      },
    })

    const res = await confirmCashHandler(req, { params: Promise.resolve({ id: testOrderId }) })
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toBe('ACCOUNT_DEACTIVATED')
  })

  it('enforces RBAC: BARISTA (Kitchen) CANNOT confirm cash payments (403 Forbidden)', async () => {
    const barista = await prisma.staffUser.findUniqueOrThrow({ where: { username: 'barista' } })
    const baristaToken = await signStaffToken({
      sub: barista.id,
      username: barista.username,
      displayName: barista.displayName,
      role: barista.role,
    })

    const req = new Request(`http://localhost:3000/api/staff/orders/${testOrderId}/confirm-cash`, {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        cookie: `${STAFF_COOKIE_NAME}=${baristaToken}`,
      },
    })

    const res = await confirmCashHandler(req, { params: Promise.resolve({ id: testOrderId }) })
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toBe('FORBIDDEN')
  })

  it('enforces RBAC: BARISTA and CASHIER CANNOT change menu prices (403 Forbidden)', async () => {
    const kasir = await prisma.staffUser.findUniqueOrThrow({ where: { username: 'kasir' } })
    const kasirToken = await signStaffToken({
      sub: kasir.id,
      username: kasir.username,
      displayName: kasir.displayName,
      role: kasir.role,
    })

    const req = new Request(`http://localhost:3000/api/staff/menu/${sampleMenuId}/price`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        cookie: `${STAFF_COOKIE_NAME}=${kasirToken}`,
      },
      body: JSON.stringify({ price: 99000 }),
    })

    const res = await updatePriceHandler(req, { params: Promise.resolve({ id: sampleMenuId }) })
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toBe('FORBIDDEN')
  })

  it('enforces RBAC: ADMIN is permitted to change menu prices (200 OK)', async () => {
    const admin = await prisma.staffUser.findUniqueOrThrow({ where: { username: 'admin' } })
    const adminToken = await signStaffToken({
      sub: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      role: admin.role,
    })

    const req = new Request(`http://localhost:3000/api/staff/menu/${sampleMenuId}/price`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        cookie: `${STAFF_COOKIE_NAME}=${adminToken}`,
      },
      body: JSON.stringify({ price: 29000 }),
    })

    const res = await updatePriceHandler(req, { params: Promise.resolve({ id: sampleMenuId }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.menuItem.price).toBe(29000)

    // Revert price back to 28000
    await prisma.menuItem.update({
      where: { id: sampleMenuId },
      data: { price: 28000 },
    })
  })

  it('enforces RBAC: CASHIER is permitted to confirm cash payments (200 OK)', async () => {
    const kasir = await prisma.staffUser.findUniqueOrThrow({ where: { username: 'kasir' } })
    const kasirToken = await signStaffToken({
      sub: kasir.id,
      username: kasir.username,
      displayName: kasir.displayName,
      role: kasir.role,
    })

    const req = new Request(`http://localhost:3000/api/staff/orders/${testOrderId}/confirm-cash`, {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        cookie: `${STAFF_COOKIE_NAME}=${kasirToken}`,
      },
    })

    const res = await confirmCashHandler(req, { params: Promise.resolve({ id: testOrderId }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.order.paymentStatus).toBe('PAID')
  })

  it('enforces RBAC: BARISTA is permitted to toggle stock availability (200 OK)', async () => {
    const barista = await prisma.staffUser.findUniqueOrThrow({ where: { username: 'barista' } })
    const baristaToken = await signStaffToken({
      sub: barista.id,
      username: barista.username,
      displayName: barista.displayName,
      role: barista.role,
    })

    const req = new Request(`http://localhost:3000/api/staff/menu/${sampleMenuId}/stock`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        cookie: `${STAFF_COOKIE_NAME}=${baristaToken}`,
      },
      body: JSON.stringify({ isAvailable: false }),
    })

    const res = await toggleStockHandler(req, { params: Promise.resolve({ id: sampleMenuId }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.menuItem.isAvailable).toBe(false)

    // Revert stock back to true
    await prisma.menuItem.update({
      where: { id: sampleMenuId },
      data: { isAvailable: true },
    })
  })

  it('rejects mutating requests with mismatched CSRF Origin (403 Forbidden)', async () => {
    const kasir = await prisma.staffUser.findUniqueOrThrow({ where: { username: 'kasir' } })
    const kasirToken = await signStaffToken({
      sub: kasir.id,
      username: kasir.username,
      displayName: kasir.displayName,
      role: kasir.role,
    })

    const req = new Request(`http://localhost:3000/api/staff/orders/${testOrderId}/confirm-cash`, {
      method: 'POST',
      headers: {
        origin: 'http://malicious-attacker-site.com', // Mismatched Origin!
        host: 'localhost:3000',
        cookie: `${STAFF_COOKIE_NAME}=${kasirToken}`,
      },
    })

    const res = await confirmCashHandler(req, { params: Promise.resolve({ id: testOrderId }) })
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toBe('CSRF_REJECTED')
  })

  it('allows staff logout and invalidates cookie with maxAge=0', async () => {
    const admin = await prisma.staffUser.findUniqueOrThrow({ where: { username: 'admin' } })
    const adminToken = await signStaffToken({
      sub: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      role: admin.role,
    })

    const req = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: `${STAFF_COOKIE_NAME}=${adminToken}`,
      },
    })

    const res = await logoutHandler(req)
    expect(res.status).toBe(200)
    const cookieHeader = res.headers.get('set-cookie')
    expect(cookieHeader).toContain(`${STAFF_COOKIE_NAME}=;`)
    expect(cookieHeader).toContain('Max-Age=0')
  })
})
