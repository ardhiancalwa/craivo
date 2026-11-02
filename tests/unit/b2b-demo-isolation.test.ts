import { describe, it, expect } from 'vitest'
import {
  DEMO_TAGS,
  DEMO_MENU_ITEMS,
  DEMO_QUIZ_STEPS,
  calculateDemoRecommendation,
} from '@/components/b2b/demo-menu-dataset'
import { computeTimelineFrame } from '@/components/b2b/hero-flow-motion'

describe('B2B Demo Quiz Isolation & Hero Motion Timeline Unit Tests', () => {
  describe('Dataset Integrity & Self-Contained Isolation', () => {
    it('should have self-contained in-memory menu items without database dependence', () => {
      expect(DEMO_MENU_ITEMS).toBeDefined()
      expect(DEMO_MENU_ITEMS.length).toBeGreaterThanOrEqual(6)

      DEMO_MENU_ITEMS.forEach((item) => {
        expect(item.id).toMatch(/^demo-/)
        expect(item.name.length).toBeGreaterThan(0)
        expect(item.description.length).toBeGreaterThan(0)
        expect(Number.isInteger(item.price)).toBe(true)
        expect(item.price).toBeGreaterThan(0)
        expect(['Kopi', 'Non-Kopi', 'Pastry & Kudapan']).toContain(item.category)
        expect(typeof item.isPopular).toBe('boolean')
        expect(item.tags.length).toBeGreaterThan(0)
        expect(item.tagSlugs.length).toBe(item.tags.length)
      })
    })

    it('should enforce 3-step sequence: Suasana -> Rasa -> Format/Suhu', () => {
      expect(DEMO_QUIZ_STEPS).toHaveLength(3)

      const [step1, step2, step3] = DEMO_QUIZ_STEPS
      expect(step1?.dimension).toBe('MOOD')
      expect(step1?.shortName).toBe('Suasana')
      expect(step2?.dimension).toBe('FLAVOR')
      expect(step2?.shortName).toBe('Rasa')
      expect(step3?.dimension).toBe('FORMAT')
      expect(step3?.shortName).toBe('Format/Suhu')

      DEMO_QUIZ_STEPS.forEach((step) => {
        expect(step.options.length).toBeGreaterThanOrEqual(3)
        step.options.forEach((opt) => {
          expect(opt.id).toBeDefined()
          expect(opt.label.trim().length).toBeGreaterThan(0)
          expect(opt.tagSlug).toBeDefined()
          expect(DEMO_TAGS[opt.tagSlug]).toBeDefined()
        })
      })
    })

    it('should verify all demo tags belong to canonical dimensions', () => {
      Object.entries(DEMO_TAGS).forEach(([slug, tag]) => {
        expect(tag.id).toBeDefined()
        expect(tag.name).toBeDefined()
        expect(['MOOD', 'FLAVOR', 'FORMAT']).toContain(tag.dimension)
        expect(slug).toBeDefined()
      })
    })
  })

  describe('Deterministic Recommendation Scoring (Flavor 3pt > Format 2pt > Mood 1pt)', () => {
    it('should prioritize items with matching Flavor (3pt) over Format (2pt) and Mood (1pt)', () => {
      const result = calculateDemoRecommendation('fokus', 'pahit_bold', 'panas')

      expect(result.hero.id).toBe('demo-v60')
      expect(result.matchedTags).toContain('fokus')
      expect(result.matchedTags).toContain('pahit_bold')
      expect(result.matchedTags).toContain('panas')
      expect(result.matchScore).toBe(6)
    })

    it('should recommend French Butter Croissant for cemilan format with creamy flavor', () => {
      const result = calculateDemoRecommendation('santai', 'creamy', 'cemilan')

      expect(result.hero.id).toBe('demo-croissant')
      expect(result.matchedTags).toContain('creamy')
      expect(result.matchedTags).toContain('cemilan')
      expect(result.matchedTags).toContain('santai')
      expect(result.matchScore).toBe(7)
    })

    it('should recommend Strawberry Hibiscus Cooler for segar mood and asam_segar flavor', () => {
      const result = calculateDemoRecommendation('segar', 'asam_segar', 'dingin')

      expect(result.hero.id).toBe('demo-hibiscus')
      expect(result.matchedTags).toContain('asam_segar')
      expect(result.matchedTags).toContain('dingin')
      expect(result.matchedTags).toContain('segar')
      expect(result.matchScore).toBe(6)
    })

    it('should return alternatives list excluding the hero item', () => {
      const result = calculateDemoRecommendation('santai', 'manis', 'dingin')

      expect(result.hero).toBeDefined()
      expect(result.alternatives.length).toBeGreaterThan(0)
      expect(result.alternatives.length).toBeLessThanOrEqual(2)
      result.alternatives.forEach((alt) => {
        expect(alt.id).not.toBe(result.hero.id)
      })
    })

    it('should handle empty or partial selections gracefully', () => {
      const emptyResult = calculateDemoRecommendation()
      expect(emptyResult.hero.isPopular).toBe(true)
      expect(emptyResult.matchedTags).toEqual([])

      const partialResult = calculateDemoRecommendation('fokus', undefined, undefined)
      expect(partialResult.matchedTags).toContain('fokus')
      expect(partialResult.matchScore).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Hero 5-Scene Storyboard Timeline Invariants (12s Cycle)', () => {
    it('maps timestamps accurately to the 5 storyboard scenes', () => {
      expect(computeTimelineFrame(800).scene).toBe(1) // 0–2s: Meja
      expect(computeTimelineFrame(2800).scene).toBe(2) // 2–4s: Pilihan menu
      expect(computeTimelineFrame(5000).scene).toBe(3) // 4–6.5s: Pembayaran
      expect(computeTimelineFrame(7500).scene).toBe(4) // 6.5–9s: Tiket dapur
      expect(computeTimelineFrame(9800).scene).toBe(5) // 9–12s: Hold & reset
    })

    it('sweeps QR scan line once in Scene 1 and never repeats in later scenes', () => {
      const midScan = computeTimelineFrame(900)
      expect(midScan.scanOpacity).toBeGreaterThan(0.9)
      expect(midScan.scanProgress).toBeGreaterThan(0.1)
      expect(midScan.scanProgress).toBeLessThan(0.95)

      // Signal dot moves after scan completes
      const signalToMenu = computeTimelineFrame(1700)
      expect(signalToMenu.scanOpacity).toBe(0)
      expect(signalToMenu.path1Draw).toBeGreaterThan(0.2)
      expect(signalToMenu.dot1Opacity).toBe(1)

      // Scan remains off across Scenes 2–5
      expect(computeTimelineFrame(3000).scanOpacity).toBe(0)
      expect(computeTimelineFrame(5500).scanOpacity).toBe(0)
      expect(computeTimelineFrame(8000).scanOpacity).toBe(0)
      expect(computeTimelineFrame(10000).scanOpacity).toBe(0)
    })

    it('enforces Kitchen Gate: path to kitchen stays inactive until payment verification + checkmark complete', () => {
      // At 4.9s: Menunggu pembayaran -> not verified, checkmark 0, kitchen path 0
      const pending = computeTimelineFrame(4900)
      expect(pending.isPaymentVerified).toBe(false)
      expect(pending.pendingOpacity).toBeGreaterThan(0.9)
      expect(pending.checkMarkStroke).toBe(0)
      expect(pending.kitchenGateOpen).toBe(false)
      expect(pending.path3Draw).toBe(0)
      expect(pending.ticketEnter).toBe(0)

      // At 5.6s: Pembayaran terverifikasi, checkmark drawing, kitchen path STILL locked until checkmark completes
      const drawingCheck = computeTimelineFrame(5600)
      expect(drawingCheck.isPaymentVerified).toBe(true)
      expect(drawingCheck.checkMarkStroke).toBeGreaterThan(0.2)
      expect(drawingCheck.checkMarkStroke).toBeLessThan(1)
      expect(drawingCheck.kitchenGateOpen).toBe(false)
      expect(drawingCheck.path3Draw).toBe(0)

      // At 6.3s: Checkmark finished (1.0), kitchen gate open, path to kitchen actively drawing
      const gateOpened = computeTimelineFrame(6300)
      expect(gateOpened.checkMarkStroke).toBe(1)
      expect(gateOpened.kitchenGateOpen).toBe(true)
      expect(gateOpened.path3Draw).toBeGreaterThan(0.4)

      // At 9.5s (Hold / Reduced Motion snapshot): complete connected diagram
      const holdSnapshot = computeTimelineFrame(9500)
      expect(holdSnapshot.stageOpacity).toBe(1)
      expect(holdSnapshot.path1Draw).toBe(1)
      expect(holdSnapshot.path2Draw).toBe(1)
      expect(holdSnapshot.path3Draw).toBe(1)
      expect(holdSnapshot.ticketOrigin).toBe(1)
    })
  })
})
