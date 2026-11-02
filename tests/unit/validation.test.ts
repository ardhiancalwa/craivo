import { describe, it, expect } from 'vitest'
import {
  OrderCheckoutInputSchema,
  QuizSubmitInputSchema,
  ConfirmCashInputSchema,
} from '@/validation/schemas'

describe('Zod Validation Contracts', () => {
  it('validates a correct checkout payload with QRIS', () => {
    const validPayload = {
      tableNumber: '07',
      items: [
        {
          menuItemId: 'menu-kopi-sela',
          quantity: 2,
          modifiers: [{ modifierOptionId: 'mod-opt-less-sugar' }],
        },
      ],
      customerNotes: 'Tolong jangan terlalu manis',
      paymentMethod: 'QRIS',
    }

    const result = OrderCheckoutInputSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('rejects an empty checkout items array', () => {
    const invalidPayload = {
      tableNumber: '07',
      items: [],
      paymentMethod: 'CASH',
    }

    const result = OrderCheckoutInputSchema.safeParse(invalidPayload)
    expect(result.success).toBe(false)
  })

  it('enforces customer notes maximum 120 characters', () => {
    const longNotes = 'a'.repeat(121)
    const payload = {
      tableNumber: '07',
      items: [{ menuItemId: 'menu-americano', quantity: 1, modifiers: [] }],
      customerNotes: longNotes,
      paymentMethod: 'CASH',
    }

    const result = OrderCheckoutInputSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('validates 3-step quiz submission with valid enums', () => {
    const validQuiz = {
      mood: 'santai',
      flavor: 'creamy',
      format: 'dingin',
    }

    const result = QuizSubmitInputSchema.safeParse(validQuiz)
    expect(result.success).toBe(true)
  })

  it('rejects invalid quiz mood enum value', () => {
    const invalidQuiz = {
      mood: 'marah',
      flavor: 'creamy',
      format: 'dingin',
    }

    const result = QuizSubmitInputSchema.safeParse(invalidQuiz)
    expect(result.success).toBe(false)
  })

  it('validates cash confirmation input', () => {
    const validCash = {
      orderId: 'ord-12345',
      receivedAmount: 50000,
    }

    const result = ConfirmCashInputSchema.safeParse(validCash)
    expect(result.success).toBe(true)
  })
})

