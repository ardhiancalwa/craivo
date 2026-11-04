// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateCartItems } from '@/lib/server/quote-service'
import { prisma } from '@/lib/server/db'

vi.mock('@/lib/server/db', () => ({
  prisma: {
    menuItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
    cravioConfig: {
      findUnique: vi.fn().mockResolvedValue({
        taxPercentage: 10,
        servicePercentage: 5,
        isTaxInclusive: false,
      }),
    },
  },
}))

describe('Menu Custom Option Pricing (Per-Menu Override)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses standard modifier price when no override is present', async () => {
    const mockDbItem = {
      id: 'menu-americano',
      name: 'Americano',
      price: 18000,
      isAvailable: true,
      isArchived: false,
      modifierPriceOverrides: null, // No overrides
      modifierGroups: [
        {
          group: {
            id: 'grp-size',
            name: 'Ukuran Cup',
            isRequired: true,
            minSelect: 1,
            maxSelect: 1,
            options: [
              { id: 'opt-med', name: 'Medium', price: 0, isAvailable: true },
              { id: 'opt-large', name: 'Large', price: 5000, isAvailable: true },
            ],
          },
        },
      ],
    }

    vi.mocked(prisma.menuItem.findUnique).mockResolvedValueOnce(mockDbItem as any)

    const result = await calculateCartItems([
      {
        menuItemId: 'menu-americano',
        quantity: 1,
        selectedModifierOptionIds: ['opt-large'],
      },
    ])

    // Expected: 18000 (base) + 5000 (standard large) = 23000
    expect(result.subtotalAmount).toBe(23000)
    expect(result.calculatedItems[0]!.modifiers[0]!.price).toBe(5000)
  })

  it('uses custom size price override specifically defined for that menu', async () => {
    const mockDbItem = {
      id: 'menu-americano-discounted-upsize',
      name: 'Americano Hemat',
      price: 18000,
      isAvailable: true,
      isArchived: false,
      // Cafe customised Large to be +3000 instead of default +5000 for Americano!
      modifierPriceOverrides: {
        'opt-large': 3000,
      },
      modifierGroups: [
        {
          group: {
            id: 'grp-size',
            name: 'Ukuran Cup',
            isRequired: true,
            minSelect: 1,
            maxSelect: 1,
            options: [
              { id: 'opt-med', name: 'Medium', price: 0, isAvailable: true },
              { id: 'opt-large', name: 'Large', price: 5000, isAvailable: true },
            ],
          },
        },
      ],
    }

    vi.mocked(prisma.menuItem.findUnique).mockResolvedValueOnce(mockDbItem as any)

    const result = await calculateCartItems([
      {
        menuItemId: 'menu-americano-discounted-upsize',
        quantity: 2,
        selectedModifierOptionIds: ['opt-large'],
      },
    ])

    // Expected per unit: 18000 (base) + 3000 (custom large) = 21000
    // Total for 2 units: 42000
    expect(result.calculatedItems[0]!.modifiers[0]!.price).toBe(3000)
    expect(result.calculatedItems[0]!.unitPrice).toBe(21000)
    expect(result.subtotalAmount).toBe(42000)
  })

  it('correctly applies custom prices for both size variant and additional racikan', async () => {
    const mockDbItem = {
      id: 'menu-matcha-latte',
      name: 'Kyoto Matcha Latte',
      price: 28000,
      isAvailable: true,
      isArchived: false,
      // Cafe customised Large to +6000 and Oat Milk to +10000 specifically for this premium item
      modifierPriceOverrides: {
        'opt-large': 6000,
        'opt-oatmilk': 10000,
      },
      modifierGroups: [
        {
          group: {
            id: 'grp-size',
            name: 'Pilihan Ukuran',
            isRequired: true,
            minSelect: 1,
            maxSelect: 1,
            options: [
              { id: 'opt-med', name: 'Medium', price: 0, isAvailable: true },
              { id: 'opt-large', name: 'Large', price: 5000, isAvailable: true }, // Default is 5000
            ],
          },
        },
        {
          group: {
            id: 'grp-milk',
            name: 'Pilihan Susu',
            isRequired: false,
            minSelect: 0,
            maxSelect: 1,
            options: [
              { id: 'opt-freshmilk', name: 'Fresh Milk', price: 0, isAvailable: true },
              { id: 'opt-oatmilk', name: 'Oat Milk', price: 8000, isAvailable: true }, // Default is 8000
            ],
          },
        },
      ],
    }

    vi.mocked(prisma.menuItem.findUnique).mockResolvedValueOnce(mockDbItem as any)

    const result = await calculateCartItems([
      {
        menuItemId: 'menu-matcha-latte',
        quantity: 1,
        selectedModifierOptionIds: ['opt-large', 'opt-oatmilk'],
      },
    ])

    // Expected per unit: 28000 (base) + 6000 (custom size) + 10000 (custom oatmilk) = 44000
    expect(result.subtotalAmount).toBe(44000)
    expect(result.calculatedItems[0]!.unitPrice).toBe(44000)
    expect(result.calculatedItems[0]!.modifiers).toHaveLength(2)

    const sizeMod = result.calculatedItems[0]!.modifiers.find((m) => m.optionId === 'opt-large')
    const milkMod = result.calculatedItems[0]!.modifiers.find((m) => m.optionId === 'opt-oatmilk')

    expect(sizeMod?.price).toBe(6000)
    expect(milkMod?.price).toBe(10000)
  })

  it('keeps standard price for options in the same group that were not customized', async () => {
    const mockDbItem = {
      id: 'menu-kopi-sela',
      name: 'Es Kopi Susu Sela',
      price: 20000,
      isAvailable: true,
      isArchived: false,
      // Only Jumbo was overridden to 12000; Regular remains 0
      modifierPriceOverrides: {
        'opt-portion-jumbo': 12000,
      },
      modifierGroups: [
        {
          group: {
            id: 'grp-portion',
            name: 'Pilihan Porsi',
            isRequired: true,
            minSelect: 1,
            maxSelect: 1,
            options: [
              { id: 'opt-portion-reg', name: 'Reguler', price: 0, isAvailable: true },
              { id: 'opt-portion-jumbo', name: 'Jumbo', price: 8000, isAvailable: true },
            ],
          },
        },
      ],
    }

    vi.mocked(prisma.menuItem.findUnique).mockResolvedValueOnce(mockDbItem as any)

    const result = await calculateCartItems([
      {
        menuItemId: 'menu-kopi-sela',
        quantity: 1,
        selectedModifierOptionIds: ['opt-portion-reg'],
      },
    ])

    // Regular option should be 0 IDR
    expect(result.subtotalAmount).toBe(20000)
    expect(result.calculatedItems[0]!.modifiers[0]!.price).toBe(0)
  })
})
