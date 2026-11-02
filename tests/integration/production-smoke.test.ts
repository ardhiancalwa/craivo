// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { GET as healthGet, HEAD as healthHead } from '@/app/api/health/route'
import { GET as systemHealthGet } from '@/app/api/staff/admin/system/health/route'
import { POST as cronReconcilePost } from '@/app/api/cron/reconcile-payments/route'
import { GET as quizQuestionsGet } from '@/app/api/quiz/questions/route'
import { GET as menuGet } from '@/app/api/menu/route'
import { prisma } from '@/lib/server/db'
import { signStaffToken } from '@/lib/server/auth'

describe('Production Release Candidate Smoke Test Suite (Nir-Uang Nyata)', () => {
  let adminToken: string
  let cashierToken: string

  beforeAll(async () => {
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

  it('1. Smoke: Public Health Check (GET & HEAD) returns 200 OK', async () => {
    const resGet = await healthGet()
    expect(resGet.status).toBe(200)

    const data = await resGet.json()
    expect(data.status).toBe('ok')
    expect(data.version).toBeDefined()
    expect(data.timestamp).toBeDefined()

    const resHead = await healthHead()
    expect(resHead.status).toBe(200)
  })

  it('2. Smoke: Public Menu Catalog API returns available items and categories', async () => {
    const req = new Request('http://localhost:3000/api/menu?table=01')
    const res = await menuGet(req as any)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data.categories)).toBe(true)
    expect(body.data.categories.length).toBeGreaterThanOrEqual(1)
  })

  it('3. Smoke: Public Preference Quiz API returns 3 curated questions', async () => {
    const res = await quizQuestionsGet()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data.questions)).toBe(true)
    expect(body.data.questions.length).toBeGreaterThanOrEqual(3)
  })

  it('4. Smoke: Protected System Health endpoint enforces role boundaries', async () => {
    // A. Unauthenticated -> 401
    const unauthReq = new Request('http://localhost:3000/api/staff/admin/system/health')
    const unauthRes = await systemHealthGet(unauthReq)
    expect(unauthRes.status).toBe(401)

    // B. Cashier role -> 403 Forbidden
    if (cashierToken) {
      const cashierReq = new Request('http://localhost:3000/api/staff/admin/system/health', {
        headers: { Authorization: `Bearer ${cashierToken}` },
      })
      const cashierRes = await systemHealthGet(cashierReq)
      expect(cashierRes.status).toBe(403)
    }

    // C. Admin role -> 200 OK with real DB metrics
    if (adminToken) {
      const adminReq = new Request('http://localhost:3000/api/staff/admin/system/health', {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-correlation-id': 'smoke-test-correlation-001',
        },
      })
      const adminRes = await systemHealthGet(adminReq)
      expect(adminRes.status).toBe(200)

      const body = await adminRes.json()
      expect(body.success).toBe(true)
      expect(body.diagnostics.database.status).toBe('connected')
      expect(body.diagnostics.database.latencyMs).toBeLessThan(3000)
    }
  })

  it('5. Smoke: Scheduled Cron Reconcile Job enforces CRON_SECRET authorization', async () => {
    // A. Unauthorized request -> 401
    const unauthCronReq = new Request('http://localhost:3000/api/cron/reconcile-payments', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid_secret' },
    })
    const unauthCronRes = await cronReconcilePost(unauthCronReq as any)
    expect(unauthCronRes.status).toBe(401)

    // B. Authorized request with valid CRON_SECRET -> 200 OK
    const cronSecret = process.env.CRON_SECRET || 'sela_cron_reconcile_secret_2026_secure'
    const authCronReq = new Request('http://localhost:3000/api/cron/reconcile-payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'x-correlation-id': 'smoke-cron-reconcile-002',
      },
    })
    const authCronRes = await cronReconcilePost(authCronReq as any)
    expect(authCronRes.status).toBe(200)

    const body = await authCronRes.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeDefined()
    expect(typeof body.data.totalScanned).toBe('number')
  })
})
