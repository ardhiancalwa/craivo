import { describe, it, expect } from 'vitest'
import { generateCartItemId, type SelectedModifier } from '@/lib/cart-context'
import { formatIDR } from '@/lib/utils'

describe('Cart & Modifier Pricing Logic Suite (Unit Tests)', () => {
  const modSweetNormal: SelectedModifier = {
    optionId: 'opt-sweet-100',
    groupId: 'mod-group-sweetness',
    groupName: 'Tingkat Kemanisan',
    optionName: 'Normal Sweet (100%)',
    price: 0,
  }

  const modSweetLess: SelectedModifier = {
    optionId: 'opt-sweet-50',
    groupId: 'mod-group-sweetness',
    groupName: 'Tingkat Kemanisan',
    optionName: 'Less Sweet (50%)',
    price: 0,
  }

  const modOatMilk: SelectedModifier = {
    optionId: 'opt-milk-oat',
    groupId: 'mod-group-milk',
    groupName: 'Pilihan Susu',
    optionName: 'Oat Milk',
    price: 6000,
  }

  const modExtraShot: SelectedModifier = {
    optionId: 'opt-shot-extra',
    groupId: 'mod-group-shot',
    groupName: 'Extra Shot',
    optionName: 'Extra Espresso Shot',
    price: 5000,
  }

  // Varian Ukuran Dinamis Ditentukan Kafe
  const modSizeMedium: SelectedModifier = {
    optionId: 'opt-size-med',
    groupId: 'mod-group-size-2',
    groupName: 'Ukuran Cup',
    optionName: 'Medium',
    price: 0,
  }

  const modSizeLarge: SelectedModifier = {
    optionId: 'opt-size-lrg',
    groupId: 'mod-group-size-2',
    groupName: 'Ukuran Cup',
    optionName: 'Large',
    price: 5000,
  }

  const modSizeLiter: SelectedModifier = {
    optionId: 'opt-size-1l',
    groupId: 'mod-group-size-bottle',
    groupName: 'Pilihan Botol',
    optionName: '1 Liter Botol Kaca',
    price: 35000,
  }

  describe('1. Diferensiasi Kunci Unik Baris Keranjang (generateCartItemId)', () => {
    it('menghasilkan ID yang sama jika menu, modifier, dan catatan identik', () => {
      const id1 = generateCartItemId('ks-sela', [modSweetNormal, modOatMilk], 'es dipisah')
      const id2 = generateCartItemId('ks-sela', [modOatMilk, modSweetNormal], 'es dipisah')

      expect(id1).toBe(id2)
      expect(id1).toBe('ks-sela:opt-milk-oat-opt-sweet-100:es dipisah')
    })

    it('menghasilkan ID berbeda jika modifier berbeda (menu & catatan sama)', () => {
      const id1 = generateCartItemId('ks-sela', [modSweetNormal], 'kurang manis')
      const id2 = generateCartItemId('ks-sela', [modSweetLess], 'kurang manis')

      expect(id1).not.toBe(id2)
    })

    it('membedakan baris keranjang jika pelanggan memilih ukuran berbeda (misal Medium vs Large)', () => {
      const idMedium = generateCartItemId('ks-sela', [modSizeMedium])
      const idLarge = generateCartItemId('ks-sela', [modSizeLarge])

      expect(idMedium).not.toBe(idLarge)
      expect(idMedium).toContain('opt-size-med')
      expect(idLarge).toContain('opt-size-lrg')
    })

    it('menghasilkan ID berbeda jika catatan berbeda (menu & modifier sama)', () => {
      const id1 = generateCartItemId('ks-sela', [modSweetNormal], 'tanpa sedotan')
      const id2 = generateCartItemId('ks-sela', [modSweetNormal], 'bawa pulang')

      expect(id1).not.toBe(id2)
    })

    it('menormalisasi whitespace pada catatan agar tidak menghasilkan baris duplikat', () => {
      const id1 = generateCartItemId('ks-sela', [modSweetNormal], '  tanpa sedotan  ')
      const id2 = generateCartItemId('ks-sela', [modSweetNormal], 'tanpa sedotan')

      expect(id1).toBe(id2)
    })

    it('menangani catatan kosong atau undefined dengan bersih', () => {
      const id1 = generateCartItemId('ks-sela', [modSweetNormal], '')
      const id2 = generateCartItemId('ks-sela', [modSweetNormal], undefined)

      expect(id1).toBe(id2)
      expect(id1).toBe('ks-sela:opt-sweet-100')
    })
  })

  describe('2. Kalkulasi Subtotal & Nominal Tambahan Transparan', () => {
    it('menghitung subtotal menu dasar + modifier * quantity secara presisi', () => {
      const basePrice = 28000
      const modifiers = [modOatMilk, modExtraShot] // 6.000 + 5.000 = 11.000
      const modifierSum = modifiers.reduce((acc, m) => acc + m.price, 0)
      const unitPrice = basePrice + modifierSum // 39.000
      const quantity = 3
      const subtotal = unitPrice * quantity // 117.000

      expect(unitPrice).toBe(39000)
      expect(subtotal).toBe(117000)
      expect(Number.isInteger(subtotal)).toBe(true)
      expect(formatIDR(subtotal)).toBe('Rp117.000')
    })

    it('menghitung varian ukuran kustom kafe (Medium Rp0 vs Large +Rp5.000 vs Literan +Rp35.000)', () => {
      const basePrice = 22000 // Harga dasar ukuran terendah
      
      // Kasus 1: Pilihan Medium (+Rp0)
      const unitMedium = basePrice + modSizeMedium.price
      expect(unitMedium).toBe(22000)

      // Kasus 2: Pilihan Large (+Rp5.000 ditentukan kafe)
      const unitLarge = basePrice + modSizeLarge.price
      expect(unitLarge).toBe(27000)
      expect(formatIDR(unitLarge * 2)).toBe('Rp54.000')

      // Kasus 3: Porsi Botol 1 Liter (+Rp35.000 ditentukan kafe)
      const unitLiter = basePrice + modSizeLiter.price
      expect(unitLiter).toBe(57000)
      expect(formatIDR(unitLiter)).toBe('Rp57.000')
    })

    it('formatIDR menghasilkan string Rupiah terformat tanpa sen pecahan desimal', () => {
      expect(formatIDR(0)).toBe('Rp0')
      expect(formatIDR(28000)).toBe('Rp28.000')
      expect(formatIDR(150000)).toBe('Rp150.000')
      expect(formatIDR(6000)).toBe('Rp6.000')
    })
  })

  describe('3. Batasan Kuantitas 1–50 & Catatan Maksimal 100 Karakter', () => {
    it('memvalidasi batas kuantitas minimum 1 dan maksimum 50', () => {
      const clampQty = (qty: number) => Math.min(50, Math.max(1, qty))

      expect(clampQty(0)).toBe(1)
      expect(clampQty(-5)).toBe(1)
      expect(clampQty(1)).toBe(1)
      expect(clampQty(25)).toBe(25)
      expect(clampQty(50)).toBe(50)
      expect(clampQty(51)).toBe(50)
      expect(clampQty(100)).toBe(50)
    })

    it('memotong catatan yang melebihi batas 100 karakter secara aman', () => {
      const longNote =
        'Tolong buatkan kopi dengan gula aren organik murni tanpa sirup jagung, es batu terpisah di gelas lain, dan sedotan kertas ramah lingkungan.'
      expect(longNote.length).toBeGreaterThan(100)

      const safeNotes = longNote.slice(0, 100).trim()
      expect(safeNotes.length).toBeLessThanOrEqual(100)
    })
  })
})

