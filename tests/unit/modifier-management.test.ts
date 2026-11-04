// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/server/db', () => ({
  default: {
    modifierGroup: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    modifierOption: {
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => {
      if (typeof cb === 'function') {
        const tx = {
          modifierGroup: {
            create: vi.fn().mockResolvedValue({ id: 'mod-group-custom', name: 'Ukuran Cup (Medium & Large)', isRequired: true }),
            findUnique: vi.fn().mockResolvedValue({
              id: 'mod-group-custom',
              name: 'Ukuran Cup (Medium & Large)',
              isRequired: true,
              options: [
                { id: 'opt-med', name: 'Medium', price: 0 },
                { id: 'opt-lrg', name: 'Large', price: 5000 },
              ],
            }),
          },
          modifierOption: {
            createMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
          auditLog: {
            create: vi.fn(),
          },
        }
        return cb(tx)
      }
      return cb
    }),
  },
}))

vi.mock('@/lib/server/auth-guard', () => ({
  requireStaffRole: vi.fn().mockResolvedValue({
    id: 'staff-admin-uuid',
    username: 'admin',
    role: 'ADMIN',
  }),
  AuthError: class extends Error {
    code = 'UNAUTHORIZED'
    status = 401
  },
}))

vi.mock('@/lib/server/realtime-bus', () => ({
  publishEvent: vi.fn(),
}))

import prisma from '@/lib/server/db'
import { POST as createGroupPost } from '@/app/api/staff/admin/modifiers/route'
import { PUT as updateGroupPut, DELETE as deleteGroupDelete } from '@/app/api/staff/admin/modifiers/[id]/route'
import { PUT as updateOptionPut, DELETE as deleteOptionDelete } from '@/app/api/staff/admin/modifiers/options/[optionId]/route'

describe('Modifier & Custom Size Management API Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/staff/admin/modifiers', () => {
    it('creates modifier group with custom options and custom pricing defined by cafe', async () => {
      const payload = {
        name: 'Ukuran Cup (Medium & Large)',
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { name: 'Medium', price: 0 },
          { name: 'Large', price: 5000 },
        ],
      }

      const req = new NextRequest('http://localhost:3000/api/staff/admin/modifiers', {
        method: 'POST',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
        body: JSON.stringify(payload),
      })

      const res = await createGroupPost(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.name).toBe('Ukuran Cup (Medium & Large)')
      expect(json.data.options).toHaveLength(2)
      expect(json.data.options[1].price).toBe(5000)
    })
  })

  describe('PUT /api/staff/admin/modifiers/[id]', () => {
    it('updates modifier group rules and name', async () => {
      vi.mocked(prisma.modifierGroup.findUnique).mockResolvedValueOnce({
        id: 'group-uuid-1',
        name: 'Ukuran Cup',
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
      } as any)

      vi.mocked(prisma.modifierGroup.update).mockResolvedValueOnce({
        id: 'group-uuid-1',
        name: 'Ukuran Cup & Gelas',
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
        options: [],
      } as any)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/modifiers/group-uuid-1', {
        method: 'PUT',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
        body: JSON.stringify({
          name: 'Ukuran Cup & Gelas',
          isRequired: true,
          minSelect: 1,
          maxSelect: 1,
        }),
      })

      const res = await updateGroupPut(req, {
        params: Promise.resolve({ id: 'group-uuid-1' }),
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.data.name).toBe('Ukuran Cup & Gelas')
      expect(prisma.modifierGroup.update).toHaveBeenCalled()
    })
  })

  describe('DELETE /api/staff/admin/modifiers/[id]', () => {
    it('deletes modifier group and cascade relations', async () => {
      vi.mocked(prisma.modifierGroup.findUnique).mockResolvedValueOnce({
        id: 'group-uuid-1',
        name: 'Ukuran Kuno',
        _count: { menuItemMap: 0 },
      } as any)

      vi.mocked(prisma.modifierGroup.delete).mockResolvedValueOnce({} as any)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/modifiers/group-uuid-1', {
        method: 'DELETE',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      })

      const res = await deleteGroupDelete(req, {
        params: Promise.resolve({ id: 'group-uuid-1' }),
      })

      expect(res.status).toBe(200)
      expect(prisma.modifierGroup.delete).toHaveBeenCalledWith({
        where: { id: 'group-uuid-1' },
      })
    })
  })

  describe('PUT /api/staff/admin/modifiers/options/[optionId]', () => {
    it('updates custom option name and cafe-determined delta price', async () => {
      vi.mocked(prisma.modifierOption.findUnique).mockResolvedValueOnce({
        id: 'opt-uuid-1',
        name: 'Large',
        price: 5000,
      } as any)

      vi.mocked(prisma.modifierOption.update).mockResolvedValueOnce({
        id: 'opt-uuid-1',
        name: 'Large (22oz)',
        price: 7000,
        isAvailable: true,
      } as any)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/modifiers/options/opt-uuid-1', {
        method: 'PUT',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
        body: JSON.stringify({
          name: 'Large (22oz)',
          price: 7000,
        }),
      })

      const res = await updateOptionPut(req, {
        params: Promise.resolve({ optionId: 'opt-uuid-1' }),
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.data.name).toBe('Large (22oz)')
      expect(json.data.price).toBe(7000)
    })
  })

  describe('DELETE /api/staff/admin/modifiers/options/[optionId]', () => {
    it('deletes modifier option', async () => {
      vi.mocked(prisma.modifierOption.findUnique).mockResolvedValueOnce({
        id: 'opt-uuid-1',
        name: 'Option To Delete',
        groupId: 'group-1',
      } as any)

      vi.mocked(prisma.modifierOption.delete).mockResolvedValueOnce({} as any)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/modifiers/options/opt-uuid-1', {
        method: 'DELETE',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      })

      const res = await deleteOptionDelete(req, {
        params: Promise.resolve({ optionId: 'opt-uuid-1' }),
      })

      expect(res.status).toBe(200)
      expect(prisma.modifierOption.delete).toHaveBeenCalledWith({
        where: { id: 'opt-uuid-1' },
      })
    })
  })
})

