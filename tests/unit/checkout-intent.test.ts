import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createUuid } from '@/lib/utils'
import { getOrCreateCheckoutIntent } from '@/lib/checkout-intent'

const getRandomValues = crypto.getRandomValues.bind(crypto)
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('Checkout UUID browser compatibility', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses native randomUUID when available', () => {
    const randomUUID = vi.fn(() => '90cbddbd-17de-41d6-baf1-d10820b528ce')
    vi.stubGlobal('crypto', { randomUUID })
    expect(createUuid()).toBe('90cbddbd-17de-41d6-baf1-d10820b528ce')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('creates secure UUID v4 keys when Safari has no randomUUID', () => {
    const randomValues = vi.fn(getRandomValues)
    vi.stubGlobal('crypto', { getRandomValues: randomValues })
    const first = createUuid()
    const second = createUuid()
    expect(first).toMatch(uuidV4)
    expect(second).toMatch(uuidV4)
    expect(second).not.toBe(first)
    expect(randomValues).toHaveBeenCalledWith(expect.any(Uint8Array))
  })

  it('reuses the checkout key for retries and changes it for a new payload without randomUUID', () => {
    vi.stubGlobal('crypto', { getRandomValues })
    const first = getOrCreateCheckoutIntent('cart-1')
    expect(first).toMatch(uuidV4)
    expect(getOrCreateCheckoutIntent('cart-1')).toBe(first)
    expect(getOrCreateCheckoutIntent('cart-2')).not.toBe(first)
  })

  it('still creates a valid checkout key when browser storage is blocked', () => {
    vi.stubGlobal('crypto', { getRandomValues })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked') })
    expect(getOrCreateCheckoutIntent('cart-1')).toMatch(uuidV4)
  })
})
