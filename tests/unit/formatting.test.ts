import { describe, it, expect } from 'vitest'
import { formatIDR, formatOrderNumber, cn } from '@/lib/utils'

describe('Formatting Utilities (SELA Standard)', () => {
  it('formats integer IDR without decimals and with thousand separators', () => {
    expect(formatIDR(28000)).toBe('Rp28.000')
    expect(formatIDR(24000)).toBe('Rp24.000')
    expect(formatIDR(150000)).toBe('Rp150.000')
    expect(formatIDR(0)).toBe('Rp0')
  })

  it('rounds floating point inputs to nearest integer rupiah', () => {
    expect(formatIDR(28000.4)).toBe('Rp28.000')
    expect(formatIDR(28000.6)).toBe('Rp28.001')
  })

  it('generates standardized order number with date prefix', () => {
    const fixedDate = new Date(2026, 9, 28) // 28 Oktober 2026
    const orderNum = formatOrderNumber(fixedDate, 7)
    expect(orderNum).toBe('ORD-20261028-007')
  })

  it('merges tailwind classes cleanly without collisions', () => {
    const merged = cn('px-4 py-2 bg-red-500', 'px-6 bg-blue-500')
    expect(merged).toContain('px-6')
    expect(merged).toContain('bg-blue-500')
    expect(merged).not.toContain('px-4')
    expect(merged).not.toContain('bg-red-500')
  })
})

