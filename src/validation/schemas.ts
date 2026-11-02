import { z } from 'zod'

export const OrderModifierInputSchema = z.object({
  modifierOptionId: z.string().min(1, 'modifierOptionId is required'),
})

export const OrderItemInputSchema = z.object({
  menuItemId: z.string().min(1, 'menuItemId is required'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  modifiers: z.array(OrderModifierInputSchema).default([]),
})

export const OrderCheckoutInputSchema = z.object({
  tableNumber: z.string().min(1, 'Table number is required'),
  items: z.array(OrderItemInputSchema).min(1, 'Cart cannot be empty'),
  customerNotes: z
    .string()
    .max(120, 'Catatan pelanggan maksimal 120 karakter')
    .optional(),
  paymentMethod: z.enum(['QRIS', 'CASH']),
})

export const QuizSubmitInputSchema = z.object({
  mood: z.enum(['santai', 'fokus', 'segar']),
  flavor: z.enum(['manis', 'pahit_bold', 'asam_segar', 'creamy']),
  format: z.enum(['dingin', 'panas', 'cemilan']),
})

export const ConfirmCashInputSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  receivedAmount: z.number().int().positive('Amount must be positive'),
})

export const UpdateOrderStatusInputSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  nextStatus: z.enum(['COOKING', 'READY', 'COMPLETED', 'CANCELLED']),
})

export const StaffLoginInputSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  pinOrPassword: z.string().min(4, 'PIN/Password minimum 4 characters'),
})

