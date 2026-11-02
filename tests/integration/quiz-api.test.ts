// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as getQuizQuestionsRoute } from '@/app/api/quiz/questions/route'
import { POST as postQuizRecommendRoute } from '@/app/api/quiz/recommend/route'
import { POST as postRecommendationsRoute } from '@/app/api/recommendations/route'

describe('Quiz & Recommendation API Endpoints Integration Suite (Live DB)', () => {
  describe('GET /api/quiz/questions', () => {
    it('returns 200 OK with 3-step questions ordered by stepNumber', async () => {
      const res = await getQuizQuestionsRoute()

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.questions).toBeDefined()
      expect(body.data.questions.length).toBe(3)

      const [q1, q2, q3] = body.data.questions

      // Step 1: Mood
      expect(q1.stepNumber).toBe(1)
      expect(q1.dimension).toBe('MOOD')
      expect(q1.options.length).toBeGreaterThanOrEqual(3)

      // Step 2: Flavor
      expect(q2.stepNumber).toBe(2)
      expect(q2.dimension).toBe('FLAVOR')
      expect(q2.options.length).toBeGreaterThanOrEqual(3)

      // Step 3: Format
      expect(q3.stepNumber).toBe(3)
      expect(q3.dimension).toBe('FORMAT')
      expect(q3.options.length).toBeGreaterThanOrEqual(3)

      // Verify options structure
      for (const opt of q1.options) {
        expect(opt.id).toBeDefined()
        expect(opt.label).toBeDefined()
        expect(opt.description).toBeDefined()
        expect(opt.sortOrder).toBeTypeOf('number')
      }
    })
  })

  describe('POST /api/quiz/recommend', () => {
    it('returns 200 OK with Hero and Alternatives for valid selections', async () => {
      // 1. Fetch questions first to get real option IDs from DB
      const qRes = await getQuizQuestionsRoute()
      const qBody = await qRes.json()
      const [q1, q2, q3] = qBody.data.questions

      const selectedOptionIds = [
        q1.options[0].id, // Mood option
        q2.options[0].id, // Flavor option
        q3.options[0].id, // Format option
      ]

      const req = new NextRequest('http://localhost:3000/api/quiz/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedOptionIds,
          tableNumber: '07',
        }),
      })

      const res = await postQuizRecommendRoute(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data).toBeDefined()
      expect(body.data.hero).not.toBeNull()
      expect(body.data.hero.menuItem).toBeDefined()
      expect(body.data.hero.menuItem.price).toBeTypeOf('number')
      expect(Number.isInteger(body.data.hero.menuItem.price)).toBe(true)
      expect(body.data.hero.matchReason).toBeTypeOf('string')
      expect(body.data.hero.score).toBeGreaterThanOrEqual(1)

      // Disclaimer check
      expect(body.data.disclaimer).toBe(
        'Rekomendasi disajikan berdasarkan preferensi rasa yang Anda pilih. Harap konfirmasikan alergi bahan pangan ke staf kafe kami.'
      )

      // Execution latency check (< 100ms)
      expect(body.data.executionDurationMs).toBeLessThan(100)
    })

    it('returns 200 OK with fallback when empty option IDs provided (skip)', async () => {
      const req = new NextRequest('http://localhost:3000/api/quiz/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedOptionIds: [],
          tableNumber: '07',
        }),
      })

      const res = await postQuizRecommendRoute(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.isFallback).toBe(true)
      expect(body.data.hero).not.toBeNull()
      expect(body.data.fallbackReason).toBeDefined()
    })

    it('returns 400 VALIDATION_FAILED for malformed JSON body', async () => {
      const req = new NextRequest('http://localhost:3000/api/quiz/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json-{',
      })

      const res = await postQuizRecommendRoute(req)
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('VALIDATION_FAILED')
    })

    it('returns 400 VALIDATION_FAILED when selectedOptionIds is not an array', async () => {
      const req = new NextRequest('http://localhost:3000/api/quiz/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedOptionIds: 'not-an-array',
        }),
      })

      const res = await postQuizRecommendRoute(req)
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('VALIDATION_FAILED')
    })
  })

  describe('POST /api/recommendations (Spec Compatibility)', () => {
    it('accepts legacy mood/flavor/format tags and returns recommendations', async () => {
      const req = new NextRequest('http://localhost:3000/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: 'santai',
          flavor: 'manis',
          format: 'dingin',
        }),
      })

      const res = await postRecommendationsRoute(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.hero).not.toBeNull()
    })
  })
})

