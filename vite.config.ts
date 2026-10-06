import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const api = process.env.WASICHAI_API_URL ?? 'http://localhost:8091'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5181, strictPort: true, proxy: { '/api': api } },
  preview: { port: 5181, strictPort: true, proxy: { '/api': api } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // a test of plain logic is a .ts: both kinds run
    include: ['src/**/*.test.{ts,tsx}'],
    // under load (CI, several suites at once) a test of a whole screen goes past vitest's 5 s with nothing wrong: 15 s
    // keeps that from failing, and a real failure still says why first (asyncUtilTimeout in src/test/setup.ts is 5 s)
    testTimeout: 15000,
    hookTimeout: 15000
  }
})
