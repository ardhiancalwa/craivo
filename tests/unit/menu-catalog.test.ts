import { describe, it, expect } from 'vitest'
import { generateCartItemId, type SelectedModifier } from '@/lib/cart-context'
import { formatIDR } from '@/lib/utils'

describe('Menu Catalog & Cart Modifier Integrity', () => {
  const sampleMenuId = 'item-kopi-susu-aren'

  const modSweetLess: SelectedModifier = {
    groupId: 'group-sweet',
    groupName: 'Tingkat Manis',
    optionId: 'opt-sweet-70',
    optionName: 'Less Sweet (70%)',
    price: 0,
  }

  const modSweetNormal: SelectedModifier = {
    groupId: 'group-sweet',
    groupName: 'Tingkat Manis',
    optionId: 'opt-sweet-100',
    optionName: 'Normal Sweet (100%)',
    price: 0,
  }

  const modOatmilk: SelectedModifier = {
    groupId: 'group-milk',
    groupName: 'Pilihan Susu',
    optionId: 'opt-milk-oat',
    optionName: 'Oat Milk',
    price: 8000,
  }

  it('generates distinct cartItemId for different modifier configurations', () => {
    // Config A: Less Sweet + Oatmilk
    const idConfigA = generateCartItemId(sampleMenuId, [modSweetLess, modOatmilk])

    // Config B: Normal Sweet + Oatmilk
    const idConfigB = generateCartItemId(sampleMenuId, [modSweetNormal, modOatmilk])

    // Config C: No modifiers
    const idConfigC = generateCartItemId(sampleMenuId, [])

    expect(idConfigA).not.toEqual(idConfigB)
    expect(idConfigA).not.toEqual(idConfigC)
    expect(idConfigB).not.toEqual(idConfigC)
  })

  it('generates identical cartItemId regardless of modifier array order', () => {
    // Array passed in different order
    const id1 = generateCartItemId(sampleMenuId, [modSweetLess, modOatmilk])
    const id2 = generateCartItemId(sampleMenuId, [modOatmilk, modSweetLess])

    expect(id1).toEqual(id2)
  })

  it('enforces integer IDR formatting without decimals', () => {
    expect(formatIDR(28000)).toBe('Rp28.000')
    expect(formatIDR(36000)).toBe('Rp36.000')
    expect(formatIDR(0)).toBe('Rp0')
    // No decimal cents suffix like ,00
    expect(formatIDR(28000)).not.toContain(',00')
    expect(formatIDR(28000)).not.toContain(',-')
    expect(formatIDR(28000)).toBe('Rp28.000')
  })
})
