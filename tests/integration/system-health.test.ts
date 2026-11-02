// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { GET as getPublicHealth, HEAD as headPublicHealth } from '../../src/app/api/health/route'
import { GET as getSystemHealth } from '../../src/app/api/staff/admin/system/health/route'
import { prisma } from '../../src/lib/server/db'
import { signStaffToken } from '../../src/lib/server/auth'

describe('System Health & Operational Diagnostics Suite', () => {
  let adminToken: string
  let cashierToken: string

  beforeAll(async () => {
    // 1. Ambil atau buat staff admin & cashier untuk verifikasi role
    const admin = await prisma.staffUser.findFirst({ where: { role: 'ADMIN', isActive: true } })
    if (admin) {
      adminToken = await signStaffToken({
        sub: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        role: admin.role,
      })
    }

    const cashier = await prisma.staffUser.findFirst({ where: { role: 'CASHIER', isActive: true } })
    if (cashier) {
      cashierToken = await signStaffToken({
        sub: cashier.id,
        username: cashier.username,
        displayName: cashier.displayName,
        role: cashier.role,
      })
    }
  })

  it('public health check returns 200 OK with minimal non-sensitive metadata', async () => {
    const res = await getPublicHealth()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.status).toBe('ok')
    expect(data.app).toBeDefined()
    expect(data.version).toBeDefined()
    expect(data.timestamp).toBeDefined()

    // Verifikasi TIDAK ADA rahasia / detail internal yang bocor ke publik
    expect(data.database).toBeUndefined()
    expect(data.dbLatencyMs).toBeUndefined()
    expect(data.memoryUsage).toBeUndefined()
    expect(data.environment).toBeUndefined()
  })

  it('public health HEAD check returns 200 OK with empty body', async () => {
    const res = await headPublicHealth()
    expect(res.status).toBe(200)
  })

  it('rejects unauthenticated request to protected system health endpoint with 401', async () => {
    const req = new Request('http://localhost:3000/api/staff/admin/system/health', {
      method: 'GET',
    })

    const res = await getSystemHealth(req)
    expect(res.status).toBe(401)
  })

  it('rejects CASHIER role from accessing protected system health endpoint with 403', async () => {
    if (!cashierToken) return

    const req = new Request('http://localhost:3000/api/staff/admin/system/health', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
      },
    })

    const res = await getSystemHealth(req)
    expect(res.status).toBe(403)
  })

  it('allows ADMIN role to access deep diagnostics and returns operational metrics', async () => {
    if (!adminToken) return

    const req = new Request('http://localhost:3000/api/staff/admin/system/health', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'x-correlation-id': 'test-audit-corr-id-1234',
      },
    })

    const res = await getSystemHealth(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.diagnostics).toBeDefined()
    expect(body.diagnostics.database.status).toBe('connected')
    expect(typeof body.diagnostics.database.latencyMs).toBe('number')
    expect(body.diagnostics.operations.pendingPaymentsAging15m).toBeGreaterThanOrEqual(0)
    expect(body.diagnostics.operations.staleKitchenQueues30m).toBeGreaterThanOrEqual(0)
    expect(body.diagnostics.system.uptimeSeconds).toBeGreaterThanOrEqual(0)
  })
})
