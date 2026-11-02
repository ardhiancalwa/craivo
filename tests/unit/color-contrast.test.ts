import { describe, it, expect } from 'vitest'

/**
 * Calculates relative luminance according to WCAG 2.1 definitions.
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  return [r, g, b]
}

function channelLuminance(channel: number): number {
  const s = channel / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  const rL = channelLuminance(r)
  const gL = channelLuminance(g)
  const bL = channelLuminance(b)
  return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL
}

export function calculateContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const lum1 = relativeLuminance(foregroundHex)
  const lum2 = relativeLuminance(backgroundHex)
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  return (brightest + 0.05) / (darkest + 0.05)
}

describe('SELA Design Tokens - Actual WCAG 2.1 AA Contrast Ratio Verification', () => {
  // WCAG 2.1 AA Requirements:
  // - Normal text (< 18px or < 14px bold): >= 4.5:1
  // - Large text (>= 18px or >= 14px bold) & UI components: >= 3.0:1

  it('verifies actual contrast of #1B1C1A (Espresso text) on #FBF9F5 (Warm Canvas) exceeds 4.5:1 (actual ~16.27:1)', () => {
    const ratio = calculateContrastRatio('#1B1C1A', '#FBF9F5')
    expect(ratio).toBeGreaterThanOrEqual(4.5)
    expect(ratio).toBeCloseTo(16.27, 1)
  })

  it('verifies actual contrast of #1B1C1A (Espresso text) on #FFFFFF (Card Surface) exceeds 4.5:1 (actual ~17.11:1)', () => {
    const ratio = calculateContrastRatio('#1B1C1A', '#FFFFFF')
    expect(ratio).toBeGreaterThanOrEqual(4.5)
    expect(ratio).toBeCloseTo(17.11, 1)
  })

  it('verifies actual contrast of #924805 (Terracotta primary) on #FFFFFF exceeds 4.5:1 (actual ~6.66:1)', () => {
    const ratio = calculateContrastRatio('#924805', '#FFFFFF')
    expect(ratio).toBeGreaterThanOrEqual(4.5)
    expect(ratio).toBeCloseTo(6.66, 1)
  })

  it('verifies actual contrast of #924805 (Terracotta primary) on #FBF9F5 (Warm Canvas) exceeds 4.5:1 (actual ~6.34:1)', () => {
    const ratio = calculateContrastRatio('#924805', '#FBF9F5')
    expect(ratio).toBeGreaterThanOrEqual(4.5)
    expect(ratio).toBeCloseTo(6.34, 1)
  })

  it('verifies actual contrast of #FFFFFF (White text) on #924805 (Terracotta Button) exceeds 4.5:1 (actual ~6.66:1)', () => {
    const ratio = calculateContrastRatio('#FFFFFF', '#924805')
    expect(ratio).toBeGreaterThanOrEqual(4.5)
    expect(ratio).toBeCloseTo(6.66, 1)
  })

  it('verifies actual contrast of #544339 (Muted brown secondary) on #FBF9F5 exceeds 4.5:1 (actual ~8.92:1)', () => {
    const ratio = calculateContrastRatio('#544339', '#FBF9F5')
    expect(ratio).toBeGreaterThanOrEqual(4.5)
    expect(ratio).toBeCloseTo(8.92, 1)
  })

  it('verifies actual contrast of #FBF9F5 (Light text) on #241E1B (Dark Roast Dock) exceeds 4.5:1 (actual ~15.64:1)', () => {
    const ratio = calculateContrastRatio('#FBF9F5', '#241E1B')
    expect(ratio).toBeGreaterThanOrEqual(4.5)
    expect(ratio).toBeCloseTo(15.64, 1)
  })

  it('verifies actual contrast of #1E7E34 (Status Paid Green) on #FFFFFF exceeds 4.5:1 (actual ~5.14:1)', () => {
    const ratio = calculateContrastRatio('#1E7E34', '#FFFFFF')
    expect(ratio).toBeGreaterThanOrEqual(4.5)
    expect(ratio).toBeCloseTo(5.14, 1)
  })

  it('verifies actual contrast of #BA1A1A (Status Error Red) on #FFFFFF exceeds 4.5:1 (actual ~6.46:1)', () => {
    const ratio = calculateContrastRatio('#BA1A1A', '#FFFFFF')
    expect(ratio).toBeGreaterThanOrEqual(4.5)
    expect(ratio).toBeCloseTo(6.46, 1)
  })

  it('verifies actual contrast of #D97706 (Status Cooking Amber) meets WCAG Large/UI requirement >= 3.0:1 (actual ~3.19:1)', () => {
    const ratio = calculateContrastRatio('#D97706', '#FFFFFF')
    expect(ratio).toBeGreaterThanOrEqual(3.0)
    expect(ratio).toBeCloseTo(3.19, 1)
  })

  it('verifies actual contrast of #92400E on #FEF3C7 (Cooking Note Pill) exceeds 4.5:1 (actual ~6.37:1)', () => {
    const ratio = calculateContrastRatio('#92400E', '#FEF3C7')
    expect(ratio).toBeGreaterThanOrEqual(4.5)
    expect(ratio).toBeCloseTo(6.37, 1)
  })
})
