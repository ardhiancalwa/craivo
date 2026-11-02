import { describe, it, expect, vi } from 'vitest'
import { TableNumberSchema } from '@/lib/server/table-service'

describe('Table Validation Logic & Edge Cases', () => {
  it('validates correct alphanumeric table numbers', () => {
    expect(TableNumberSchema.safeParse('07').success).toBe(true)
    expect(TableNumberSchema.safeParse('01').success).toBe(true)
    expect(TableNumberSchema.safeParse('BAR-1').success).toBe(true)
    expect(TableNumberSchema.safeParse('T10').success).toBe(true)
  })

  it('rejects empty or whitespace-only table parameter', () => {
    const emptyResult = TableNumberSchema.safeParse('')
    expect(emptyResult.success).toBe(false)

    const spaceResult = TableNumberSchema.safeParse('   ')
    expect(spaceResult.success).toBe(false)
  })

  it('rejects malicious or invalid characters in table number', () => {
    expect(TableNumberSchema.safeParse('07; DROP TABLE').success).toBe(false)
    expect(TableNumberSchema.safeParse('<script>').success).toBe(false)
    expect(TableNumberSchema.safeParse('07/../../etc').success).toBe(false)
    expect(TableNumberSchema.safeParse('VERYLONGTABLENAME123').success).toBe(false) // max 10
  })

  it('proves no silent default table exists in validation schema', () => {
    // When input is undefined or null, safeParse fails and NEVER substitutes a default like '07'
    const undefinedResult = TableNumberSchema.safeParse(undefined)
    expect(undefinedResult.success).toBe(false)

    const nullResult = TableNumberSchema.safeParse(null)
    expect(nullResult.success).toBe(false)
  })
})

