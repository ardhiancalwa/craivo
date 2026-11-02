import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 25000,
    hookTimeout: 25000,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

