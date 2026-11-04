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
  verifyCredential: vi.fn(),
  hashCredential: vi.fn().mockImplementation((cred: string) => Promise.resolve(`hashed_${cred}`)),
}))

vi.mock('@/lib/server/db', () => ({
  default: {
    staffUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (fns) => {
      if (Array.isArray(fns)) {
        return Promise.all(fns)
      }
      return fns
    }),
  },
}))

import { POST as changeAdminPassword } from '@/app/api/staff/admin/password/route'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { verifyCredential, hashCredential } from '@/lib/server/auth'
import prisma from '@/lib/server/db'

describe('Unit: Admin Change Password Route Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyCsrfOrigin).mockReturnValue(true)
  })

  it('menolak akses jika verifikasi CSRF origin gagal', async () => {
    vi.mocked(verifyCsrfOrigin).mockReturnValue(false)

    const req = new NextRequest('http://localhost:3000/api/staff/admin/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123',
        confirmNewPassword: 'newpassword123',
      }),
    })

    const res = await changeAdminPassword(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('CSRF_REJECTED')
  })

  it('menolak akses jika caller bukan role ADMIN', async () => {
    vi.mocked(requireStaffRole).mockRejectedValueOnce(
      new AuthError('Akses ditolak: Hanya ADMIN yang diizinkan.', 403, 'FORBIDDEN')
    )

    const req = new NextRequest('http://localhost:3000/api/staff/admin/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123',
        confirmNewPassword: 'newpassword123',
      }),
    })

    const res = await changeAdminPassword(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('FORBIDDEN')
  })

  it('menolak jika password baru kurang dari 8 karakter', async () => {
    vi.mocked(requireStaffRole).mockResolvedValueOnce({
      id: 'admin-1',
      username: 'admin',
      displayName: 'Owner Kafe',
      role: 'ADMIN',
    } as any)

    const req = new NextRequest('http://localhost:3000/api/staff/admin/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: 'oldpassword123',
        newPassword: 'short',
        confirmNewPassword: 'short',
      }),
    })

    const res = await changeAdminPassword(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.message).toContain('Password baru minimal 8 karakter')
  })

  it('menolak jika konfirmasi password baru tidak cocok', async () => {
    vi.mocked(requireStaffRole).mockResolvedValueOnce({
      id: 'admin-1',
      username: 'admin',
      displayName: 'Owner Kafe',
      role: 'ADMIN',
    } as any)

    const req = new NextRequest('http://localhost:3000/api/staff/admin/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: 'oldpassword123',
        newPassword: 'validPassword123',
        confirmNewPassword: 'differentPassword456',
      }),
    })

    const res = await changeAdminPassword(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.message).toContain('Konfirmasi password baru tidak cocok')
  })

  it('menolak jika password saat ini salah', async () => {
    vi.mocked(requireStaffRole).mockResolvedValueOnce({
      id: 'admin-1',
      username: 'admin',
      displayName: 'Owner Kafe',
      role: 'ADMIN',
    } as any)

    vi.mocked(prisma.staffUser.findUnique).mockResolvedValueOnce({
      id: 'admin-1',
      username: 'admin',
      displayName: 'Owner Kafe',
      role: 'ADMIN',
      passwordHash: 'hashed_oldpassword123',
      pinHash: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    vi.mocked(verifyCredential).mockResolvedValueOnce(false)

    const req = new NextRequest('http://localhost:3000/api/staff/admin/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: 'wrongPassword',
        newPassword: 'brandNewPassword123',
        confirmNewPassword: 'brandNewPassword123',
      }),
    })

    const res = await changeAdminPassword(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('INCORRECT_PASSWORD')
    expect(json.message).toContain('Password saat ini yang Anda masukkan salah')
  })

  it('berhasil mengganti password jika password saat ini benar', async () => {
    vi.mocked(requireStaffRole).mockResolvedValueOnce({
      id: 'admin-1',
      username: 'admin',
      displayName: 'Owner Kafe',
      role: 'ADMIN',
    } as any)

    vi.mocked(prisma.staffUser.findUnique).mockResolvedValueOnce({
      id: 'admin-1',
      username: 'admin',
      displayName: 'Owner Kafe',
      role: 'ADMIN',
      passwordHash: 'hashed_oldpassword123',
      pinHash: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    vi.mocked(verifyCredential).mockResolvedValueOnce(true)

    const req = new NextRequest('http://localhost:3000/api/staff/admin/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: 'correctOldPassword',
        newPassword: 'brandNewPassword123',
        confirmNewPassword: 'brandNewPassword123',
      }),
    })

    const res = await changeAdminPassword(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.message).toContain('Password akun Admin berhasil diperbarui')

    expect(hashCredential).toHaveBeenCalledWith('brandNewPassword123')
    expect(prisma.staffUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'admin-1' },
        data: expect.objectContaining({
          passwordHash: 'hashed_brandNewPassword123',
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      })
    )
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          staffUserId: 'admin-1',
          action: 'ADMIN_PASSWORD_CHANGED',
        }),
      })
    )
  })
})

