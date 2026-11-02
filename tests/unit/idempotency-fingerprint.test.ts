import { describe, it, expect, beforeEach } from 'vitest'
import { computePayloadFingerprint } from '@/lib/server/idempotency'
import {
  computeClientFingerprint,
  getOrCreateCheckoutIntent,
  clearCheckoutIntent,
  saveOrderCapabilityToken,
  getOrderCapabilityToken,
} from '@/lib/checkout-intent'

describe('Unit: Idempotency Payload Fingerprint & Intent Stabilizer', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  describe('Server Payload Fingerprint', () => {
    const basePayload = {
      tableNumber: '07',
      paymentMethod: 'QRIS',
      customerNotes: 'Less ice please',
      quoteToken: 'jwt.token.here',
      items: [
        {
          menuItemId: 'item-1',
          selectedModifierOptionIds: ['opt-sugar-low', 'opt-ice-normal'],
          quantity: 2,
          notes: 'Untuk anak',
        },
        {
          menuItemId: 'item-2',
          selectedModifierOptionIds: ['opt-oat-milk'],
          quantity: 1,
          notes: '',
        },
      ],
    }

    it('menghasilkan hash yang identik meski urutan item terbalik', () => {
      const reversedPayload = {
        ...basePayload,
        items: [basePayload.items[1]!, basePayload.items[0]!],
      }

      const hash1 = computePayloadFingerprint(basePayload)
      const hash2 = computePayloadFingerprint(reversedPayload)

      expect(hash1).toBe(hash2)
    })

    it('menghasilkan hash yang identik meski urutan opsi modifier terbalik', () => {
      const shuffledOptionsPayload = {
        ...basePayload,
        items: [
          {
            menuItemId: 'item-1',
            selectedModifierOptionIds: ['opt-ice-normal', 'opt-sugar-low'], // urutan terbalik
            quantity: 2,
            notes: 'Untuk anak',
          },
          basePayload.items[1]!,
        ],
      }

      const hash1 = computePayloadFingerprint(basePayload)
      const hash2 = computePayloadFingerprint(shuffledOptionsPayload)

      expect(hash1).toBe(hash2)
    })

    it('menghasilkan hash berbeda jika kuantitas diubah', () => {
      const modifiedPayload = {
        ...basePayload,
        items: [
          {
            ...basePayload.items[0]!,
            quantity: 3,
          },
          basePayload.items[1]!,
        ],
      }

      expect(computePayloadFingerprint(basePayload)).not.toBe(
        computePayloadFingerprint(modifiedPayload)
      )
    })

    it('menghasilkan hash berbeda jika metode pembayaran diubah', () => {
      const modifiedPayload = {
        ...basePayload,
        paymentMethod: 'CASH',
      }

      expect(computePayloadFingerprint(basePayload)).not.toBe(
        computePayloadFingerprint(modifiedPayload)
      )
    })

    it('menghasilkan hash berbeda jika nomor meja berbeda', () => {
      const modifiedPayload = {
        ...basePayload,
        tableNumber: '08',
      }

      expect(computePayloadFingerprint(basePayload)).not.toBe(
        computePayloadFingerprint(modifiedPayload)
      )
    })
  })

  describe('Client Intent Stabilizer (localStorage)', () => {
    it('mengembalikan key yang sama persis untuk fingerprint yang sama', () => {
      const fp = 'fp_test_deterministic_fingerprint'
      const key1 = getOrCreateCheckoutIntent(fp)
      const key2 = getOrCreateCheckoutIntent(fp)

      expect(key1).toBeDefined()
      expect(key1).toHaveLength(36) // UUID format length
      expect(key1).toBe(key2)
    })

    it('menerbitkan key baru jika fingerprint berubah', () => {
      const key1 = getOrCreateCheckoutIntent('fp_a')
      const key2 = getOrCreateCheckoutIntent('fp_b')

      expect(key1).not.toBe(key2)
    })

    it('membersihkan intent saat clearCheckoutIntent dipanggil', () => {
      const key1 = getOrCreateCheckoutIntent('fp_a')
      clearCheckoutIntent()
      const key2 = getOrCreateCheckoutIntent('fp_a')

      expect(key1).not.toBe(key2)
    })

    it('menyimpan dan membaca kembali token kapabilitas pesanan', () => {
      saveOrderCapabilityToken('ord_100', 'SELA-261029-001', 'sec_cap_token_value')
      const token = getOrderCapabilityToken('ord_100')

      expect(token).toBe('sec_cap_token_value')
      expect(getOrderCapabilityToken('ord_unknown')).toBeNull()
    })
  })
})
