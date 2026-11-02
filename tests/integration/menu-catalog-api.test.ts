// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as getTableRoute } from '@/app/api/tables/[tableNumber]/route'
import { GET as getMenuRoute } from '@/app/api/menu/route'

describe('Menu Catalog & Table API Endpoints Integration Suite', () => {
  describe('GET /api/tables/[tableNumber]', () => {
    it('returns 200 OK for valid active Table 07', async () => {
      const req = new NextRequest('http://localhost:3000/api/tables/07')
      const res = await getTableRoute(req, {
        params: Promise.resolve({ tableNumber: '07' }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.table.tableNumber).toBe('07')
      expect(data.data.table.isActive).toBe(true)
    })

    it('returns 404 Not Found for non-existent Table 99', async () => {
      const req = new NextRequest('http://localhost:3000/api/tables/99')
      const res = await getTableRoute(req, {
        params: Promise.resolve({ tableNumber: '99' }),
      })

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('TABLE_NOT_FOUND')
    })
  })

  describe('GET /api/menu', () => {
    it('returns 200 OK with categories and seeded menu items', async () => {
      const req = new NextRequest('http://localhost:3000/api/menu')
      const res = await getMenuRoute(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.categories).toBeDefined()
      expect(data.data.items).toBeDefined()

      // Virtual "Semua" tab is at index 0
      expect(data.data.categories[0].slug).toBe('semua')
      expect(data.data.categories[0].name).toBe('Semua')

      // Real categories follow
      const slugs = data.data.categories.map((c: { slug: string }) => c.slug)
      expect(slugs).toContain('kopi')
      expect(slugs).toContain('non-kopi')
      expect(slugs).toContain('makanan')

      // Items length >= 18 (from seeder)
      expect(data.data.items.length).toBeGreaterThanOrEqual(18)

      // Ensure every item has integer price and no decimal
      for (const item of data.data.items) {
        expect(Number.isInteger(item.price)).toBe(true)
        expect(item.price).toBeGreaterThan(0)
      }
    })

    it('filters catalog by category "kopi"', async () => {
      const req = new NextRequest('http://localhost:3000/api/menu?category=kopi')
      const res = await getMenuRoute(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.items.length).toBeGreaterThan(0)

      for (const item of data.data.items) {
        expect(item.categorySlug).toBe('kopi')
      }
    })

    it('filters catalog by search keyword "aren"', async () => {
      const req = new NextRequest('http://localhost:3000/api/menu?search=aren')
      const res = await getMenuRoute(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.items.length).toBeGreaterThan(0)

      for (const item of data.data.items) {
        const matches =
          item.name.toLowerCase().includes('aren') ||
          item.description.toLowerCase().includes('aren')
        expect(matches).toBe(true)
      }
    })
  })
})

