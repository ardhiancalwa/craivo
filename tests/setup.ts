import '@testing-library/jest-dom'
import { vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Mock server-only so server modules can be tested in Vitest test runner
vi.mock('server-only', () => ({}))

// Load environment from .env if present
try {
  const envPath = path.resolve(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const equalIdx = trimmed.indexOf('=')
        if (equalIdx > 0) {
          const key = trimmed.slice(0, equalIdx).trim()
          let val = trimmed.slice(equalIdx + 1).trim()
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1)
          }
          if (!process.env[key]) {
            process.env[key] = val
          }
        }
      }
    }
  }
} catch {
  // Ignore env read failure
}

// Prioritaskan DATABASE_URL_TEST jika tersedia untuk isolasi database pengujian
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
}

// Fallback dummy environment variables for unit test execution if not in .env
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://cravio_user:dummy_password@localhost:5432/cravio_db'
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test_jwt_secret_key_minimum_32_characters_long_for_cravio'
process.env.MIDTRANS_SERVER_KEY =
  process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-test-key-cravio'
process.env.MIDTRANS_CLIENT_KEY =
  process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-test-key-cravio'

// Mock IntersectionObserver & matchMedia for jsdom tests (framer-motion & responsive UI)
if (typeof window !== 'undefined') {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null
    readonly rootMargin: string = ''
    readonly thresholds: ReadonlyArray<number> = []

    constructor(
      public callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit
    ) {
      if (options?.root) this.root = options.root
      if (options?.rootMargin) this.rootMargin = options.rootMargin
      if (options?.threshold) {
        this.thresholds = Array.isArray(options.threshold)
          ? options.threshold
          : [options.threshold]
      }
    }

    observe = vi.fn((target: Element) => {
      this.callback(
        [
          {
            boundingClientRect: target.getBoundingClientRect(),
            intersectionRatio: 1,
            intersectionRect: target.getBoundingClientRect(),
            isIntersecting: true,
            rootBounds: null,
            target,
            time: Date.now(),
          },
        ],
        this
      )
    })
    unobserve = vi.fn()
    disconnect = vi.fn()
    takeRecords = vi.fn(() => [])
  }

  window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

  const matchMediaMock = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
  window.matchMedia = matchMediaMock as unknown as typeof window.matchMedia
  global.matchMedia = matchMediaMock as unknown as typeof window.matchMedia
}

