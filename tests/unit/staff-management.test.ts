// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/server/auth-guard', () => ({
  requireStaffRole: vi.fn(),
  AuthError: class AuthError extends Error {
    status: number
    code: string
    constructor(message: string, status = 401, code = 'UNAUTHORIZED') {
      super(message)
      this.name = 'AuthError'
      this.status = status
      this.code = code
    }
  },
}))

vi.mock('@/lib/server/csrf', () => ({
  verifyCsrfOrigin: vi.fn(),
}))

vi.mock('@/lib/server/auth', () => ({
  hashCredential: vi.fn().mockImplementation((cred: string) => Promise.resolve(`hashed_${cred}`)),
}))

vi.mock('@/lib/server/db', () => ({
  default: {
    staffUser: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

import { GET as getStaffList, POST as createStaff } from '@/app/api/staff/admin/users/route'
import { PATCH as updateStaff, DELETE as deleteStaff } from '@/app/api/staff/admin/users/[id]/route'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { hashCredential } from '@/lib/server/auth'
import prisma from '@/lib/server/db'

describe('Staff Management Route Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyCsrfOrigin).mockReturnValue(true)
  })

  describe('GET /api/staff/admin/users', () => {
    it('menolak akses jika bukan role ADMIN', async () => {
      vi.mocked(requireStaffRole).mockRejectedValueOnce(
        new AuthError('Akses ditolak: Hanya ADMIN yang berhak.', 403, 'FORBIDDEN')
      )

      const req = new NextRequest('http://localhost:3000/api/staff/admin/users')
      const res = await getStaffList(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('FORBIDDEN')
    })

    it('mengembalikan daftar staf kasir dan barista untuk admin', async () => {
      vi.mocked(requireStaffRole).mockResolvedValueOnce({
        sub: 'admin-1',
        username: 'hendra_admin',
        role: 'ADMIN',
      } as any)

      vi.mocked(prisma.staffUser.findMany).mockResolvedValueOnce([
        {
          id: 'staff-1',
          username: 'kasir_sore',
          displayName: 'Kasir Sore',
          role: 'CASHIER',
          isActive: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
          createdAt: new Date('2026-11-01'),
          updatedAt: new Date('2026-11-01'),
        },
      ] as any)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/users')
      const res = await getStaffList(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data).toHaveLength(1)
      expect(json.data[0].username).toBe('kasir_sore')
    })
  })

  describe('POST /api/staff/admin/users', () => {
    it('menolak jika CSRF tidak valid', async () => {
      vi.mocked(verifyCsrfOrigin).mockReturnValueOnce(false)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username: 'kasir_baru',
          displayName: 'Kasir Baru',
          role: 'CASHIER',
          pin: '123456',
        }),
      })

      const res = await createStaff(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('CSRF_REJECTED')
    })

    it('menolak validasi jika PIN bukan 4-6 digit angka', async () => {
      vi.mocked(requireStaffRole).mockResolvedValueOnce({
        sub: 'admin-1',
        username: 'hendra_admin',
        role: 'ADMIN',
      } as any)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username: 'kasir_baru',
          displayName: 'Kasir Baru',
          role: 'CASHIER',
          pin: 'abc12', // bukan digit murni
        }),
      })

      const res = await createStaff(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('VALIDATION_ERROR')
    })

    it('berhasil membuat staf baru dengan PIN ter-hash', async () => {
      vi.mocked(requireStaffRole).mockResolvedValueOnce({
        sub: 'admin-1',
        username: 'hendra_admin',
        role: 'ADMIN',
      } as any)

      vi.mocked(prisma.staffUser.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.staffUser.create).mockResolvedValueOnce({
        id: 'staff-new',
        username: 'barista_danang',
        displayName: 'Danang Barista',
        role: 'BARISTA',
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username: 'barista_danang',
          displayName: 'Danang Barista',
          role: 'BARISTA',
          pin: '654321',
        }),
      })

      const res = await createStaff(req)
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.success).toBe(true)
      expect(hashCredential).toHaveBeenCalledWith('654321')
      expect(prisma.staffUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            username: 'barista_danang',
            pinHash: 'hashed_654321',
            role: 'BARISTA',
          }),
        })
      )
    })
  })

  describe('PATCH /api/staff/admin/users/[id]', () => {
    it('dapat membuka kunci akun (unlockLockout) yang terkunci akibat salah PIN', async () => {
      vi.mocked(requireStaffRole).mockResolvedValueOnce({
        sub: 'admin-1',
        username: 'hendra_admin',
        role: 'ADMIN',
      } as any)

      vi.mocked(prisma.staffUser.findUnique).mockResolvedValueOnce({
        id: 'staff-locked',
        username: 'kasir_terkunci',
        displayName: 'Kasir Terkunci',
        role: 'CASHIER',
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 600000),
      } as any)

      vi.mocked(prisma.staffUser.update).mockResolvedValueOnce({
        id: 'staff-locked',
        username: 'kasir_terkunci',
        displayName: 'Kasir Terkunci',
        role: 'CASHIER',
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/users/staff-locked', {
        method: 'PATCH',
        body: JSON.stringify({
          unlockLockout: true,
        }),
      })

      const res = await updateStaff(req, { params: Promise.resolve({ id: 'staff-locked' }) })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(prisma.staffUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'staff-locked' },
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        })
      )
    })

    it('dapat mereset PIN staf dengan PIN baru yang valid', async () => {
      vi.mocked(requireStaffRole).mockResolvedValueOnce({
        sub: 'admin-1',
        username: 'hendra_admin',
        role: 'ADMIN',
      } as any)

      vi.mocked(prisma.staffUser.findUnique).mockResolvedValueOnce({
        id: 'staff-1',
        username: 'kasir_1',
        displayName: 'Kasir 1',
        role: 'CASHIER',
      } as any)

      vi.mocked(prisma.staffUser.update).mockResolvedValueOnce({
        id: 'staff-1',
        username: 'kasir_1',
        displayName: 'Kasir 1',
        role: 'CASHIER',
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/users/staff-1', {
        method: 'PATCH',
        body: JSON.stringify({
          pin: '998877',
        }),
      })

      const res = await updateStaff(req, { params: Promise.resolve({ id: 'staff-1' }) })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(hashCredential).toHaveBeenCalledWith('998877')
      expect(prisma.staffUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'staff-1' },
          data: expect.objectContaining({
            pinHash: 'hashed_998877',
          }),
        })
      )
    })
  })
})

