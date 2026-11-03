import { describe, it, expect } from 'vitest'
import {
  calculateRecommendations,
  CandidateMenuItem,
  SelectedOptionWeight,
  ALLERGY_DISCLAIMER,
  DEFAULT_FALLBACK_REASON,
  EMPTY_CATALOG_REASON,
  buildMatchReason,
} from '@/lib/recommendation-engine'

describe('Recommendation Engine (Unit Tests)', () => {
  // Mock dataset menu items
  const mockMenuItems: CandidateMenuItem[] = [
    {
      id: 'item-ks-sela',
      name: 'Kopi Susu SELA',
      description: 'Espresso blend spesial dengan gula aren organik dan susu segar.',
      price: 28000,
      image: '/images/kopi-susu.webp',
      categoryId: 'cat-kopi',
      categoryName: 'Kopi',
      categorySlug: 'kopi',
      isAvailable: true,
      isPopular: true,
      soldCount: 150,
      isArchived: false,
      tags: [
        { id: 'tag-santai', slug: 'santai', name: 'Santai', dimension: 'MOOD' },
        { id: 'tag-manis', slug: 'manis', name: 'Manis', dimension: 'FLAVOR' },
        { id: 'tag-dingin', slug: 'dingin', name: 'Dingin & Segar', dimension: 'FORMAT' },
      ],
    },
    {
      id: 'item-americano',
      name: 'Americano Double Shot',
      description: 'Espresso murni arabika tanpa pemanis.',
      price: 24000,
      image: '/images/americano.webp',
      categoryId: 'cat-kopi',
      categoryName: 'Kopi',
      categorySlug: 'kopi',
      isAvailable: true,
      isPopular: false,
      soldCount: 80,
      isArchived: false,
      tags: [
        { id: 'tag-fokus', slug: 'fokus', name: 'Fokus', dimension: 'MOOD' },
        { id: 'tag-pahit', slug: 'pahit_bold', name: 'Pahit & Bold', dimension: 'FLAVOR' },
        { id: 'tag-dingin', slug: 'dingin', name: 'Dingin & Segar', dimension: 'FORMAT' },
      ],
    },
    {
      id: 'item-croissant',
      name: 'Butter Croissant',
      description: 'Pastry renyah dengan butter Prancis aromatik.',
      price: 22000,
      image: '/images/croissant.webp',
      categoryId: 'cat-makanan',
      categoryName: 'Makanan',
      categorySlug: 'makanan',
      isAvailable: true,
      isPopular: false,
      soldCount: 95,
      isArchived: false,
      tags: [
        { id: 'tag-santai', slug: 'santai', name: 'Santai', dimension: 'MOOD' },
        { id: 'tag-creamy', slug: 'creamy', name: 'Creamy Gurih', dimension: 'FLAVOR' },
        { id: 'tag-cemilan', slug: 'cemilan', name: 'Cemilan Pastry', dimension: 'FORMAT' },
      ],
    },
    {
      id: 'item-matcha',
      name: 'Matcha Oat Latte',
      description: 'Matcha Uji Jepang berpadu oat milk gurih.',
      price: 32000,
      image: '/images/matcha.webp',
      categoryId: 'cat-non-kopi',
      categoryName: 'Non-Kopi',
      categorySlug: 'non-kopi',
      isAvailable: true,
      isPopular: true,
      soldCount: 110,
      isArchived: false,
      tags: [
        { id: 'tag-santai', slug: 'santai', name: 'Santai', dimension: 'MOOD' },
        { id: 'tag-creamy', slug: 'creamy', name: 'Creamy Gurih', dimension: 'FLAVOR' },
        { id: 'tag-dingin', slug: 'dingin', name: 'Dingin & Segar', dimension: 'FORMAT' },
      ],
    },
  ]

  // Standard user selection: Santai (Mood=1), Manis (Flavor=3), Dingin (Format=2)
  const standardWeights: SelectedOptionWeight[] = [
    {
      optionId: 'opt-mood-santai',
      tagId: 'tag-santai',
      tagSlug: 'santai',
      tagName: 'Santai',
      dimension: 'MOOD',
      weight: 1,
    },
    {
      optionId: 'opt-flavor-manis',
      tagId: 'tag-manis',
      tagSlug: 'manis',
      tagName: 'Manis',
      dimension: 'FLAVOR',
      weight: 3,
    },
    {
      optionId: 'opt-format-dingin',
      tagId: 'tag-dingin',
      tagSlug: 'dingin',
      tagName: 'Dingin & Segar',
      dimension: 'FORMAT',
      weight: 2,
    },
  ]

  it('1. Verifikasi kalkulasi bobot skor (Flavor=3, Format=2, Mood=1, isPopular=+1)', () => {
    const result = calculateRecommendations({
      menuItems: mockMenuItems,
      selectedOptionWeights: standardWeights,
    })

    expect(result.hero).not.toBeNull()
    // Kopi Susu SELA matches:
    // Mood Santai (1) + Flavor Manis (3) + Format Dingin (2) + isPopular (1) = 7
    expect(result.hero?.menuItem.id).toBe('item-ks-sela')
    expect(result.hero?.score).toBe(7)
    expect(result.hero?.dimensionMatchCount).toBe(3)
    expect(result.hero?.matchedTags).toHaveLength(3)
    expect(result.isFallback).toBe(false)
  })

  it('2. Verifikasi determinisme mutlak (100x run menghasilkan urutan dan skor identik)', () => {
    const firstRun = calculateRecommendations({
      menuItems: mockMenuItems,
      selectedOptionWeights: standardWeights,
    })

    for (let i = 0; i < 100; i++) {
      const currentRun = calculateRecommendations({
        menuItems: mockMenuItems,
        selectedOptionWeights: standardWeights,
      })

      expect(currentRun.hero?.menuItem.id).toBe(firstRun.hero?.menuItem.id)
      expect(currentRun.hero?.score).toBe(firstRun.hero?.score)
      expect(currentRun.alternatives.map((a) => a.menuItem.id)).toEqual(
        firstRun.alternatives.map((a) => a.menuItem.id)
      )
      expect(currentRun.alternatives.map((a) => a.score)).toEqual(
        firstRun.alternatives.map((a) => a.score)
      )
    }
  })

  describe('3. Verifikasi 5-Tingkat Tie-Breaker Deterministik', () => {
    it('Level 1: Skor lebih tinggi menang', () => {
      const items: CandidateMenuItem[] = [
        {
          id: 'item-a',
          name: 'Item A',
          description: '',
          price: 25000,
          image: null,
          categoryId: 'c1',
          categoryName: 'Kopi',
          categorySlug: 'kopi',
          isAvailable: true,
          isPopular: false,
          soldCount: 50,
          isArchived: false,
          tags: [{ id: 'tag-manis', slug: 'manis', name: 'Manis', dimension: 'FLAVOR' }], // +3
        },
        {
          id: 'item-b',
          name: 'Item B',
          description: '',
          price: 20000,
          image: null,
          categoryId: 'c1',
          categoryName: 'Kopi',
          categorySlug: 'kopi',
          isAvailable: true,
          isPopular: false,
          soldCount: 100,
          isArchived: false,
          tags: [
            { id: 'tag-manis', slug: 'manis', name: 'Manis', dimension: 'FLAVOR' }, // +3
            { id: 'tag-dingin', slug: 'dingin', name: 'Dingin', dimension: 'FORMAT' }, // +2 -> total 5
          ],
        },
      ]

      const result = calculateRecommendations({
        menuItems: items,
        selectedOptionWeights: standardWeights,
      })

      expect(result.hero?.menuItem.id).toBe('item-b')
      expect(result.hero?.score).toBe(5)
    })

    it('Level 2: Skor seri -> Dimension match count lebih banyak menang', () => {
      const items: CandidateMenuItem[] = [
        {
          id: 'item-single-dim',
          name: 'Item Single Dimensi',
          description: '',
          price: 25000,
          image: null,
          categoryId: 'c1',
          categoryName: 'Kopi',
          categorySlug: 'kopi',
          isAvailable: true,
          isPopular: false,
          soldCount: 50,
          isArchived: false,
          tags: [
            // Flavor weight 3 -> total score 3, 1 dimension
            { id: 'tag-manis', slug: 'manis', name: 'Manis', dimension: 'FLAVOR' },
          ],
        },
        {
          id: 'item-multi-dim',
          name: 'Item Multi Dimensi',
          description: '',
          price: 25000,
          image: null,
          categoryId: 'c1',
          categoryName: 'Kopi',
          categorySlug: 'kopi',
          isAvailable: true,
          isPopular: false,
          soldCount: 50,
          isArchived: false,
          tags: [
            // Format 2 + Mood 1 -> total score 3, 2 dimensions
            { id: 'tag-dingin', slug: 'dingin', name: 'Dingin', dimension: 'FORMAT' },
            { id: 'tag-santai', slug: 'santai', name: 'Santai', dimension: 'MOOD' },
          ],
        },
      ]

      const result = calculateRecommendations({
        menuItems: items,
        selectedOptionWeights: standardWeights,
      })

      // Multi-dimensi (2 dimensi) menang atas single-dimensi (1 dimensi)
      expect(result.hero?.menuItem.id).toBe('item-multi-dim')
      expect(result.hero?.dimensionMatchCount).toBe(2)
      expect(result.topRecommendations[1]?.menuItem.id).toBe('item-single-dim')
    })

    it('Level 3: Skor & dimensi seri -> isPopular=true menang', () => {
      const items: CandidateMenuItem[] = [
        {
          id: 'item-regular',
          name: 'Item Regular',
          description: '',
          price: 25000,
          image: null,
          categoryId: 'c1',
          categoryName: 'Kopi',
          categorySlug: 'kopi',
          isAvailable: true,
          isPopular: false,
          soldCount: 200,
          isArchived: false,
          tags: [
            { id: 'tag-manis', slug: 'manis', name: 'Manis', dimension: 'FLAVOR' }, // +3
            { id: 'tag-santai', slug: 'santai', name: 'Santai', dimension: 'MOOD' }, // +1 -> total 4
          ],
        },
        {
          id: 'item-popular',
          name: 'Item Populer',
          description: '',
          price: 25000,
          image: null,
          categoryId: 'c1',
          categoryName: 'Kopi',
          categorySlug: 'kopi',
          isAvailable: true,
          isPopular: true, // +1 bonus
          soldCount: 10,
          isArchived: false,
          tags: [
            // Flavor only +3 + isPopular bonus +1 -> total 4, 1 dimension
            // Wait, let's make dimensions identical:
            { id: 'tag-dingin', slug: 'dingin', name: 'Dingin', dimension: 'FORMAT' }, // +2
            { id: 'tag-santai', slug: 'santai', name: 'Santai', dimension: 'MOOD' }, // +1
            // total tag score: 3. isPopular bonus: +1. total score: 4. dimensions: 2.
          ],
        },
      ]

      const result = calculateRecommendations({
        menuItems: items,
        selectedOptionWeights: standardWeights,
      })

      // Both have score 4, both have 2 dimensions, item-popular wins because isPopular=true
      expect(result.hero?.menuItem.id).toBe('item-popular')
      expect(result.hero?.menuItem.isPopular).toBe(true)
    })

    it('Level 4: Skor, dimensi, & popularitas seri -> soldCount lebih tinggi menang', () => {
      const items: CandidateMenuItem[] = [
        {
          id: 'item-low-sales',
          name: 'Item Low Sales',
          description: '',
          price: 25000,
          image: null,
          categoryId: 'c1',
          categoryName: 'Kopi',
          categorySlug: 'kopi',
          isAvailable: true,
          isPopular: false,
          soldCount: 10,
          isArchived: false,
          tags: [{ id: 'tag-manis', slug: 'manis', name: 'Manis', dimension: 'FLAVOR' }],
        },
        {
          id: 'item-high-sales',
          name: 'Item High Sales',
          description: '',
          price: 25000,
          image: null,
          categoryId: 'c1',
          categoryName: 'Kopi',
          categorySlug: 'kopi',
          isAvailable: true,
          isPopular: false,
          soldCount: 250,
          isArchived: false,
          tags: [{ id: 'tag-manis', slug: 'manis', name: 'Manis', dimension: 'FLAVOR' }],
        },
      ]

      const result = calculateRecommendations({
        menuItems: items,
        selectedOptionWeights: standardWeights,
      })

      expect(result.hero?.menuItem.id).toBe('item-high-sales')
      expect(result.hero?.menuItem.soldCount).toBe(250)
    })

    it('Level 5: Seluruh metrik seri -> ID ascending sebagai stable final key', () => {
      const items: CandidateMenuItem[] = [
        {
          id: 'z-item-last',
          name: 'Item Z',
          description: '',
          price: 25000,
          image: null,
          categoryId: 'c1',
          categoryName: 'Kopi',
          categorySlug: 'kopi',
          isAvailable: true,
          isPopular: false,
          soldCount: 50,
          isArchived: false,
          tags: [{ id: 'tag-manis', slug: 'manis', name: 'Manis', dimension: 'FLAVOR' }],
        },
        {
          id: 'a-item-first',
          name: 'Item A',
          description: '',
          price: 25000,
          image: null,
          categoryId: 'c1',
          categoryName: 'Kopi',
          categorySlug: 'kopi',
          isAvailable: true,
          isPopular: false,
          soldCount: 50,
          isArchived: false,
          tags: [{ id: 'tag-manis', slug: 'manis', name: 'Manis', dimension: 'FLAVOR' }],
        },
      ]

      const result = calculateRecommendations({
        menuItems: items,
        selectedOptionWeights: standardWeights,
      })

      expect(result.hero?.menuItem.id).toBe('a-item-first')
      expect(result.topRecommendations[1]?.menuItem.id).toBe('z-item-last')
    })
  })

  it('4. Sold-out Guard: Menu habis (isAvailable: false) tidak pernah direkomendasikan', () => {
    const itemsWithSoldOut: CandidateMenuItem[] = mockMenuItems.map((item) =>
      item.id === 'item-ks-sela' ? { ...item, isAvailable: false } : item
    )

    const result = calculateRecommendations({
      menuItems: itemsWithSoldOut,
      selectedOptionWeights: standardWeights,
    })

    // Kopi Susu SELA has the highest score but is sold out, so it must be excluded
    expect(result.hero?.menuItem.id).not.toBe('item-ks-sela')
    expect(result.alternatives.some((a) => a.menuItem.id === 'item-ks-sela')).toBe(false)
  })

  it('5. Archived Guard: Menu terarsip (isArchived: true) diabaikan dari evaluasi', () => {
    const itemsWithArchived: CandidateMenuItem[] = mockMenuItems.map((item) =>
      item.id === 'item-ks-sela' ? { ...item, isArchived: true } : item
    )

    const result = calculateRecommendations({
      menuItems: itemsWithArchived,
      selectedOptionWeights: standardWeights,
    })

    expect(result.hero?.menuItem.id).not.toBe('item-ks-sela')
  })

  it('6. Dynamic Fallback: Jika tidak ada menu dengan score >= 3, fallback ke menu populer yang tersedia', () => {
    // Selection for tags that don't match any items well
    const rareWeights: SelectedOptionWeight[] = [
      {
        optionId: 'opt-exotic',
        tagId: 'tag-nonexistent',
        tagSlug: 'nonexistent',
        tagName: 'Rasa Langka',
        dimension: 'FLAVOR',
        weight: 3,
      },
    ]

    const result = calculateRecommendations({
      menuItems: mockMenuItems,
      selectedOptionWeights: rareWeights,
    })

    expect(result.isFallback).toBe(true)
    expect(result.fallbackReason).toBe(DEFAULT_FALLBACK_REASON)
    expect(result.hero).not.toBeNull()
    // In fallback mode, top popular available item is picked
    expect(result.hero?.menuItem.isPopular).toBe(true)
  })

  it('7. Skip / Empty Input: Menerima array bobot kosong dan fallback ke menu favorit', () => {
    const result = calculateRecommendations({
      menuItems: mockMenuItems,
      selectedOptionWeights: [],
    })

    expect(result.isFallback).toBe(true)
    expect(result.hero).not.toBeNull()
    expect(result.alternatives.length).toBeGreaterThan(0)
    expect(result.disclaimer).toBe(ALLERGY_DISCLAIMER)
  })

  it('8. Entire Catalog Sold Out: Menangani kasus seluruh menu habis secara graceful tanpa crash', () => {
    const allSoldOut: CandidateMenuItem[] = mockMenuItems.map((m) => ({
      ...m,
      isAvailable: false,
    }))

    const result = calculateRecommendations({
      menuItems: allSoldOut,
      selectedOptionWeights: standardWeights,
    })

    expect(result.hero).toBeNull()
    expect(result.alternatives).toEqual([])
    expect(result.isFallback).toBe(true)
    expect(result.fallbackReason).toBe(EMPTY_CATALOG_REASON)
    expect(result.totalEvaluated).toBe(0)
  })

  it('9. Kepatuhan konfigurasi dinamis: Perubahan bobot tag langsung tercermin pada ranking', () => {
    // Normal: Flavor=3, Format=2
    // If we alter weights so Format=5 and Flavor=1, an item matching format Dingin wins over flavor Manis
    const alteredWeights: SelectedOptionWeight[] = [
      {
        optionId: 'opt-flavor-manis',
        tagId: 'tag-manis',
        tagSlug: 'manis',
        tagName: 'Manis',
        dimension: 'FLAVOR',
        weight: 1, // lowered to 1
      },
      {
        optionId: 'opt-format-cemilan',
        tagId: 'tag-cemilan',
        tagSlug: 'cemilan',
        tagName: 'Cemilan Pastry',
        dimension: 'FORMAT',
        weight: 10, // increased to 10
      },
    ]

    const result = calculateRecommendations({
      menuItems: mockMenuItems,
      selectedOptionWeights: alteredWeights,
    })

    // Butter Croissant matches tag-cemilan (+10) -> score 10
    expect(result.hero?.menuItem.id).toBe('item-croissant')
    expect(result.hero?.score).toBe(10)
  })

  it('10. Benchmark Kinerja: Latensi kalkulasi terukur jauh di bawah ambang batas < 100 ms', () => {
    // Replicate candidate pool to 100 items to stress-test
    const largeCatalog: CandidateMenuItem[] = []
    for (let i = 0; i < 25; i++) {
      for (const item of mockMenuItems) {
        largeCatalog.push({
          ...item,
          id: `${item.id}-${i}`,
          soldCount: item.soldCount + i,
        })
      }
    }
    expect(largeCatalog.length).toBe(100)

    const start = performance.now()
    const result = calculateRecommendations({
      menuItems: largeCatalog,
      selectedOptionWeights: standardWeights,
    })
    const totalDuration = performance.now() - start

    // Target ADR-0006 is < 10ms, user prompt specifies < 100ms
    expect(totalDuration).toBeLessThan(100)
    expect(result.executionDurationMs).toBeLessThan(100)
    // In pure TS in-memory, this is typically under 2ms!
  })

  it('11. Disclaimer Alergi Makanan & Build Match Reason', () => {
    const result = calculateRecommendations({
      menuItems: mockMenuItems,
      selectedOptionWeights: standardWeights,
    })

    expect(result.disclaimer).toBe(
      'Rekomendasi disajikan berdasarkan preferensi rasa yang Anda pilih. Harap konfirmasikan alergi bahan pangan ke staf kafe kami.'
    )

    const customReason = buildMatchReason([
      { id: '1', slug: 'manis', name: 'Manis Lembut', dimension: 'FLAVOR' },
      { id: '2', slug: 'dingin', name: 'Dingin & Segar', dimension: 'FORMAT' },
    ])
    expect(customReason).toContain('Manis Lembut')
    expect(customReason).toContain('Dingin & Segar')
  })

  it('12. Multi-Select Preference Scoring: Akumulasi bobot saat memilih lebih dari 1 opsi', () => {
    // Pengguna memilih 2 opsi rasa: Manis (weight 3) DAN Creamy (weight 3)
    const multiSelectWeights: SelectedOptionWeight[] = [
      {
        optionId: 'opt-flavor-manis',
        tagId: 'tag-manis',
        tagSlug: 'manis',
        tagName: 'Manis',
        dimension: 'FLAVOR',
        weight: 3,
      },
      {
        optionId: 'opt-flavor-creamy',
        tagId: 'tag-creamy',
        tagSlug: 'creamy',
        tagName: 'Creamy Gurih',
        dimension: 'FLAVOR',
        weight: 3,
      },
      {
        optionId: 'opt-format-dingin',
        tagId: 'tag-dingin',
        tagSlug: 'dingin',
        tagName: 'Dingin & Segar',
        dimension: 'FORMAT',
        weight: 2,
      },
    ]

    const result = calculateRecommendations({
      menuItems: mockMenuItems,
      selectedOptionWeights: multiSelectWeights,
    })

    expect(result.topRecommendations.length).toBeGreaterThanOrEqual(1)
    // Matcha Oat Latte memiliki tag creamy + dingin + isPopular (3 + 2 + 1 = 6)
    // Kopi Susu SELA memiliki tag manis + dingin + isPopular (3 + 2 + 1 = 6)
    const topIds = result.topRecommendations.map((r) => r.menuItem.id)
    expect(topIds).toContain('item-ks-sela')
    expect(topIds).toContain('item-matcha')
  })

  it('13. Alokasi 3 Menu Rekomendasi Utama (topRecommendations) + 2 Alternatif (alternatives)', () => {
    const catalog6Items: CandidateMenuItem[] = [
      {
        id: 'menu-1',
        name: 'Menu 1',
        description: '',
        price: 20000,
        image: null,
        categoryId: 'c1',
        categoryName: 'Kopi',
        categorySlug: 'kopi',
        isAvailable: true,
        isPopular: true,
        soldCount: 100,
        isArchived: false,
        tags: [{ id: 'tag-manis', slug: 'manis', name: 'Manis', dimension: 'FLAVOR' }],
      },
      {
        id: 'menu-2',
        name: 'Menu 2',
        description: '',
        price: 20000,
        image: null,
        categoryId: 'c1',
        categoryName: 'Kopi',
        categorySlug: 'kopi',
        isAvailable: true,
        isPopular: true,
        soldCount: 90,
        isArchived: false,
        tags: [{ id: 'tag-manis', slug: 'manis', name: 'Manis', dimension: 'FLAVOR' }],
      },
      {
        id: 'menu-3',
        name: 'Menu 3',
        description: '',
        price: 20000,
        image: null,
        categoryId: 'c1',
        categoryName: 'Kopi',
        categorySlug: 'kopi',
        isAvailable: true,
        isPopular: true,
        soldCount: 80,
        isArchived: false,
        tags: [{ id: 'tag-manis', slug: 'manis', name: 'Manis', dimension: 'FLAVOR' }],
      },
      {
        id: 'menu-4',
        name: 'Menu 4',
        description: '',
        price: 20000,
        image: null,
        categoryId: 'c1',
        categoryName: 'Kopi',
        categorySlug: 'kopi',
        isAvailable: true,
        isPopular: true,
        soldCount: 70,
        isArchived: false,
        tags: [{ id: 'tag-manis', slug: 'manis', name: 'Manis', dimension: 'FLAVOR' }],
      },
      {
        id: 'menu-5',
        name: 'Menu 5',
        description: '',
        price: 20000,
        image: null,
        categoryId: 'c1',
        categoryName: 'Kopi',
        categorySlug: 'kopi',
        isAvailable: true,
        isPopular: true,
        soldCount: 60,
        isArchived: false,
        tags: [{ id: 'tag-manis', slug: 'manis', name: 'Manis', dimension: 'FLAVOR' }],
      },
      {
        id: 'menu-6',
        name: 'Menu 6',
        description: '',
        price: 20000,
        image: null,
        categoryId: 'c1',
        categoryName: 'Kopi',
        categorySlug: 'kopi',
        isAvailable: true,
        isPopular: true,
        soldCount: 50,
        isArchived: false,
        tags: [{ id: 'tag-manis', slug: 'manis', name: 'Manis', dimension: 'FLAVOR' }],
      },
    ]

    const result = calculateRecommendations({
      menuItems: catalog6Items,
      selectedOptionWeights: [
        {
          optionId: 'opt-1',
          tagId: 'tag-manis',
          tagSlug: 'manis',
          tagName: 'Manis',
          dimension: 'FLAVOR',
          weight: 3,
        },
      ],
    })

    // 3 Menu Rekomendasi Utama
    expect(result.topRecommendations).toHaveLength(3)
    expect(result.topRecommendations.map((r) => r.menuItem.id)).toEqual(['menu-1', 'menu-2', 'menu-3'])
    expect(result.hero?.menuItem.id).toBe('menu-1')

    // 2 Opsi Alternatif Serupa
    expect(result.alternatives).toHaveLength(2)
    expect(result.alternatives.map((r) => r.menuItem.id)).toEqual(['menu-4', 'menu-5'])
  })
})

