import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TableNumberSchema, validateTableServer } from '@/lib/server/table-service'

vi.mock('@/lib/server/db', () => ({
  prisma: {
    table: {
      findUnique: vi.fn(),
    },
  },
  default: {
    table: {
      findUnique: vi.fn(),
    },
  },
}))

describe('Table Management & Validation Unit Tests (REQ-ADMIN-09 / DEC-014)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('TableNumberSchema Validation', () => {
    it('accepts valid table numbers', () => {
      expect(TableNumberSchema.safeParse('01').success).toBe(true)
      expect(TableNumberSchema.safeParse('12').success).toBe(true)
      expect(TableNumberSchema.safeParse('BAR-01').success).toBe(true)
      expect(TableNumberSchema.safeParse('VIP_02').success).toBe(true)
      expect(TableNumberSchema.safeParse('A1').success).toBe(true)
    })

    it('rejects empty or whitespace table numbers', () => {
      expect(TableNumberSchema.safeParse('').success).toBe(false)
      expect(TableNumberSchema.safeParse('   ').success).toBe(false)
    })

    it('rejects table numbers exceeding 10 characters', () => {
      expect(TableNumberSchema.safeParse('12345678901').success).toBe(false)
    })

    it('rejects invalid characters (spaces, special symbols)', () => {
      expect(TableNumberSchema.safeParse('Meja 01').success).toBe(false)
      expect(TableNumberSchema.safeParse('01@#').success).toBe(false)
      expect(TableNumberSchema.safeParse('01/A').success).toBe(false)
      expect(TableNumberSchema.safeParse('01?table=1').success).toBe(false)
    })
  })

  describe('validateTableServer Logic', () => {
    it('returns MISSING when tableNumber is null or undefined', async () => {
      const resNull = await validateTableServer(null)
      expect(resNull.status).toBe('MISSING')
      expect(resNull.table).toBeNull()

      const resUndef = await validateTableServer(undefined)
      expect(resUndef.status).toBe('MISSING')

      const resEmpty = await validateTableServer('  ')
      expect(resEmpty.status).toBe('MISSING')
    })

    it('returns INVALID_FORMAT when tableNumber contains illegal characters', async () => {
      const res = await validateTableServer('01$invalid')
      expect(res.status).toBe('INVALID_FORMAT')
      expect(res.table).toBeNull()
    })

    it('returns NOT_FOUND when table is not found in database', async () => {
      const { prisma } = await import('@/lib/server/db')
      vi.mocked(prisma.table.findUnique).mockResolvedValueOnce(null)

      const res = await validateTableServer('99')
      expect(res.status).toBe('NOT_FOUND')
      expect(res.table).toBeNull()
      expect(res.message).toContain('tidak terdaftar')
    })

    it('returns INACTIVE when table exists but isActive is false', async () => {
      const { prisma } = await import('@/lib/server/db')
      vi.mocked(prisma.table.findUnique).mockResolvedValueOnce({
        id: 'tbl-inactive',
        tableNumber: '02',
        qrSlug: 'slug-02',
        isActive: false,
      } as any)

      const res = await validateTableServer('02')
      expect(res.status).toBe('INACTIVE')
      expect(res.table?.isActive).toBe(false)
      expect(res.message).toContain('tutup atau nonaktif')
    })

    it('returns VALID when table exists and isActive is true', async () => {
      const { prisma } = await import('@/lib/server/db')
      vi.mocked(prisma.table.findUnique).mockResolvedValueOnce({
        id: 'tbl-active',
        tableNumber: '01',
        qrSlug: 'slug-01',
        isActive: true,
      } as any)

      const res = await validateTableServer('01')
      expect(res.status).toBe('VALID')
      expect(res.table?.isActive).toBe(true)
      expect(res.tableNumber).toBe('01')
    })
  })
})

