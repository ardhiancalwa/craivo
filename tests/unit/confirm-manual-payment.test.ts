// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  transaction: vi.fn(),
  requireStaffRole: vi.fn(),
  verifyCsrfOrigin: vi.fn(),
  tx: {
    order: { updateMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    paymentAttempt: { create: vi.fn() },
    menuItem: { update: vi.fn() },
    outboxEvent: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

vi.mock('@/lib/server/db', () => ({
  default: { order: { findUnique: mocks.findUnique }, $transaction: mocks.transaction },
}))
vi.mock('@/lib/server/auth-guard', () => ({
  requireStaffRole: mocks.requireStaffRole,
  AuthError: class extends Error {},
}))
vi.mock('@/lib/server/csrf', () => ({ verifyCsrfOrigin: mocks.verifyCsrfOrigin }))

import { POST } from '@/app/api/staff/orders/[id]/confirm-cash/route'

const order = {
  id: 'order-1', orderNumber: 'SELA-01-001', paymentMethod: 'MANUAL_QRIS',
  paymentStatus: 'WAITING_CASHIER', orderStatus: 'QUEUED', paidAt: null,
  totalAmount: 28000, paymentProofUrl: null,
  items: [{ menuItemId: 'coffee', quantity: 2 }], table: { tableNumber: '01' },
}

const confirm = () => POST(
  new Request('http://localhost:3000/api/staff/orders/order-1/confirm-cash', { method: 'POST' }),
  { params: Promise.resolve({ id: order.id }) }
)

describe('Cashier confirmation of manual payments', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.verifyCsrfOrigin.mockReturnValue(true)
    mocks.requireStaffRole.mockResolvedValue({ id: 'cashier', username: 'kasir', role: 'CASHIER' })
    mocks.findUnique.mockResolvedValue(order)
    mocks.transaction.mockImplementation((callback) => callback(mocks.tx))
    mocks.tx.order.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue({ ...order, paymentStatus: 'PAID' })
    mocks.tx.menuItem.update.mockResolvedValue({})
  })

  it.each([
    ['CASH', 'MANUAL_CASH', null],
    ['MANUAL_QRIS', 'MANUAL_QRIS', null],
    ['MANUAL_QRIS', 'MANUAL_QRIS', '/proof.webp'],
    ['MANUAL_TRANSFER', 'MANUAL_TRANSFER', null],
    ['MANUAL_TRANSFER', 'MANUAL_TRANSFER', '/proof.webp'],
  ])('confirms %s through %s with proof %s', async (paymentMethod, gateway, paymentProofUrl) => {
    const currentOrder = { ...order, paymentMethod, paymentProofUrl }
    mocks.findUnique.mockResolvedValue(currentOrder)
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue({ ...currentOrder, paymentStatus: 'PAID' })

    const res = await confirm()
    expect(res.status).toBe(200)
    expect((await res.json()).idempotent).toBe(false)
    expect(mocks.tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: order.id, paymentMethod, paymentStatus: { not: 'PAID' }, orderStatus: { not: 'CANCELLED' } },
      data: { paymentStatus: 'PAID', orderStatus: 'QUEUED', paidAt: expect.any(Date), version: { increment: 1 } },
    })
    expect(mocks.tx.paymentAttempt.create).toHaveBeenCalledOnce()
    expect(mocks.tx.paymentAttempt.create).toHaveBeenCalledWith({ data: expect.objectContaining({ gateway, grossAmount: 28000, status: 'PAID' }) })
    expect(mocks.tx.outboxEvent.create).toHaveBeenCalledTimes(2)
    const event = mocks.tx.outboxEvent.create.mock.calls[0]![0].data
    expect(event).toMatchObject({ channel: 'KDS', eventType: 'ORDER_PAID' })
    expect(JSON.parse(event.payload).paymentMethod).toBe(paymentMethod)
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: paymentMethod === 'CASH' ? 'CONFIRM_CASH' : 'CONFIRM_MANUAL_PAYMENT',
    }) })
    expect(mocks.tx.menuItem.update).toHaveBeenCalledWith({ where: { id: 'coffee' }, data: { soldCount: { increment: 2 } } })

    mocks.findUnique.mockResolvedValue({ ...currentOrder, paymentStatus: 'PAID' })
    expect((await (await confirm()).json()).idempotent).toBe(true)
    expect(mocks.tx.paymentAttempt.create).toHaveBeenCalledOnce()
    expect(mocks.tx.outboxEvent.create).toHaveBeenCalledTimes(2)
  })

  it('does not duplicate payment history or kitchen events when another request wins', async () => {
    mocks.tx.order.updateMany.mockResolvedValue({ count: 0 })
    mocks.tx.order.findUnique.mockResolvedValue({ ...order, paymentStatus: 'PAID' })
    const res = await confirm()
    expect(res.status).toBe(200)
    expect((await res.json()).idempotent).toBe(true)
    expect(mocks.tx.paymentAttempt.create).not.toHaveBeenCalled()
    expect(mocks.tx.outboxEvent.create).not.toHaveBeenCalled()
    expect(mocks.tx.menuItem.update).not.toHaveBeenCalled()
  })

  it('rejects automatic Midtrans QRIS confirmation', async () => {
    mocks.findUnique.mockResolvedValue({ ...order, paymentMethod: 'QRIS' })
    expect((await confirm()).status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('rejects a cancelled order before starting a transaction', async () => {
    mocks.findUnique.mockResolvedValue({ ...order, orderStatus: 'CANCELLED' })
    expect((await confirm()).status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it.each([
    [null, 404, 'ORDER_NOT_FOUND'],
    [{ ...order, orderStatus: 'CANCELLED' }, 400, 'ORDER_CANCELLED'],
    [{ ...order, paymentMethod: 'QRIS' }, 409, 'ORDER_STATE_CONFLICT'],
  ])('handles a concurrent state change as %s -> %s %s', async (freshOrder, status, error) => {
    mocks.tx.order.updateMany.mockResolvedValue({ count: 0 })
    mocks.tx.order.findUnique.mockResolvedValue(freshOrder)
    const res = await confirm()
    expect(res.status).toBe(status)
    expect((await res.json()).error).toBe(error)
    expect(mocks.tx.paymentAttempt.create).not.toHaveBeenCalled()
    expect(mocks.tx.outboxEvent.create).not.toHaveBeenCalled()
  })

  it('preserves CSRF and staff role checks', async () => {
    mocks.verifyCsrfOrigin.mockReturnValue(false)
    expect((await confirm()).status).toBe(403)
    expect(mocks.findUnique).not.toHaveBeenCalled()
    mocks.verifyCsrfOrigin.mockReturnValue(true)
    mocks.requireStaffRole.mockRejectedValue(new Error('No staff session'))
    expect((await confirm()).status).toBe(401)
    expect(mocks.requireStaffRole).toHaveBeenCalledWith(['CASHIER', 'ADMIN'], expect.any(Request))
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })
})
