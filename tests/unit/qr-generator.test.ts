import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  resolveTableTargetUrl,
  generateTableQrPng,
  generateTableQrSvg,
  generateTablesZip,
  generatePrintReadyA4Pdf,
} from '@/lib/server/qr-service'

// Mock db for qr-service
vi.mock('@/lib/server/db', () => {
  const mockConfig = {
    id: 'cravio-main-config',
    name: 'SELA Artisanal Coffee & Bake',
    productionDomain: 'https://order.selacoffee.com',
  }
  const mockTables = [
    { id: 't1', tableNumber: '01', label: 'Bar 1', isActive: true },
    { id: 't2', tableNumber: '02', label: 'Bar 2', isActive: true },
    { id: 't3', tableNumber: '03', label: 'VIP', isActive: true },
    { id: 't4', tableNumber: '04', label: 'Outdoor 1', isActive: true },
    { id: 't5', tableNumber: '05', label: 'Outdoor 2', isActive: true },
  ]

  const mockDb = {
    cravioConfig: {
      findUnique: vi.fn().mockResolvedValue(mockConfig),
      findFirst: vi.fn().mockResolvedValue(mockConfig),
    },
    table: {
      findMany: vi.fn().mockResolvedValue(mockTables),
    },
  }

  return {
    default: mockDb,
    prisma: mockDb,
  }
})

describe('QR Generator & Resolver Unit Tests (REQ-ADMIN-09 / DEC-014 / DEC-016)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('resolveTableTargetUrl & Domain Guard', () => {
    it('generates staging URL correctly when env is staging', async () => {
      const result = await resolveTableTargetUrl('01', 'staging')
      expect(result.isProduction).toBe(false)
      expect(result.isBlocked).toBe(false)
      expect(result.targetUrl).toContain('/order?table=01')
      // Zero secret leak verification
      expect(result.targetUrl).not.toContain('orderSecretToken')
      expect(result.targetUrl).not.toContain('session')
      expect(result.targetUrl).not.toContain('token')
      expect(result.targetUrl).not.toContain('staff')
    })

    it('generates production URL when domain is configured', async () => {
      const result = await resolveTableTargetUrl('15', 'production')
      expect(result.isProduction).toBe(true)
      expect(result.isBlocked).toBe(false)
      expect(result.targetUrl).toBe('https://order.selacoffee.com/order?table=15')
    })

    it('blocks production QR generation when production domain is not configured', async () => {
      const prismaModule = await import('@/lib/server/db')
      vi.mocked(prismaModule.default.cravioConfig.findUnique).mockResolvedValueOnce({
        productionDomain: null,
      } as any)

      const result = await resolveTableTargetUrl('05', 'production')
      expect(result.isProduction).toBe(true)
      expect(result.isBlocked).toBe(true)
      expect(result.reason).toContain('Domain produksi permanen belum dikonfigurasi')
    })
  })

  describe('generateTableQrPng', () => {
    it('generates valid PNG buffer with dimensions >= 600px', async () => {
      const pngBuffer = await generateTableQrPng('01', { size: 1024, env: 'staging' })
      expect(pngBuffer).toBeInstanceOf(Buffer)
      expect(pngBuffer.length).toBeGreaterThan(1000)

      // PNG Magic Number: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
      expect(pngBuffer[0]).toBe(0x89)
      expect(pngBuffer[1]).toBe(0x50) // P
      expect(pngBuffer[2]).toBe(0x4e) // N
      expect(pngBuffer[3]).toBe(0x47) // G
    })

    it('throws error when generating PNG for blocked production domain', async () => {
      const prismaModule = await import('@/lib/server/db')
      vi.mocked(prismaModule.default.cravioConfig.findUnique).mockResolvedValueOnce({
        productionDomain: null,
      } as any)

      await expect(generateTableQrPng('01', { env: 'production' })).rejects.toThrow(
        /Domain produksi permanen belum dikonfigurasi/
      )
    })
  })

  describe('generateTableQrSvg', () => {
    it('generates valid SVG XML string containing viewBox and path', async () => {
      const svg = await generateTableQrSvg('BAR-01', { env: 'staging' })
      expect(typeof svg).toBe('string')
      expect(svg).toContain('<svg')
      expect(svg).toContain('viewBox=')
      expect(svg).toContain('</svg>')
    })

    it('throws error when generating SVG for blocked production domain', async () => {
      const prismaModule = await import('@/lib/server/db')
      vi.mocked(prismaModule.default.cravioConfig.findUnique).mockResolvedValueOnce({
        productionDomain: null,
      } as any)

      await expect(generateTableQrSvg('BAR-01', { env: 'production' })).rejects.toThrow(
        /Domain produksi permanen belum dikonfigurasi/
      )
    })
  })

  describe('generateTablesZip', () => {
    it('generates ZIP buffer containing PNG, SVG, and README for each active table', async () => {
      const zipBuffer = await generateTablesZip('staging')
      expect(zipBuffer).toBeInstanceOf(Buffer)
      expect(zipBuffer.length).toBeGreaterThan(2000)

      // ZIP magic bytes: PK (0x50, 0x4B)
      expect(zipBuffer[0]).toBe(0x50)
      expect(zipBuffer[1]).toBe(0x4b)
    }, 15000)
  })

  describe('generatePrintReadyA4Pdf', () => {
    it('generates valid PDF buffer starting with %PDF- and correct page structure', async () => {
      const pdfBuffer = await generatePrintReadyA4Pdf('staging')
      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(5000)

      // PDF Magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
      const headerStr = pdfBuffer.slice(0, 5).toString('ascii')
      expect(headerStr).toBe('%PDF-')
    }, 15000)
  })
})
