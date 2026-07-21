import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: false,
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/*.integration.test.ts',
      'src/**/*.contract.test.ts',
      'electron/**/*.test.ts',
      'electron/**/*.contract.test.ts'
    ],
    exclude: ['node_modules', 'out', 'release', 'src/types/prisma/**'],
    // Prefer node for most tests; component suites use happy-dom (lighter than jsdom).
    environmentMatchGlobs: [['src/**/*.test.tsx', 'happy-dom']],
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}', 'electron/**/*.{ts,tsx}', 'server/**/*.ts'],
      exclude: [
        'src/types/prisma/**',
        'src/locales/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.integration.test.ts',
        '**/*.contract.test.ts',
        'src/main.tsx',
        'src/env.d.ts',
        'src/test/**',
        'src/assets/**',
        'src/styles/**'
      ],
      // Progressive gate after handler/domain alignment (raise toward 70% over time).
      // Large *Page.tsx keep overall lines lower; domain/application stay high in practice.
      thresholds: {
        lines: 25,
        functions: 50,
        branches: 50,
        statements: 25
      }
    }
  },
  resolve: {
    alias: {
      '@domain': resolve('src/domain'),
      '@types': resolve('src/types'),
      '@test': resolve('src/test')
    }
  }
})
