import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@vorion/basis': path.resolve(__dirname, './src/basis'),
      '@vorion/cognigate': path.resolve(__dirname, './src/cognigate'),
      '@vorion/enforce': path.resolve(__dirname, './src/enforce'),
      '@vorion/intent': path.resolve(__dirname, './src/intent'),
      '@vorion/proof': path.resolve(__dirname, './src/proof'),
      '@vorion/trust-engine': path.resolve(__dirname, './src/trust-engine'),
      '@vorion/api': path.resolve(__dirname, './src/api'),
      '@vorion/common': path.resolve(__dirname, './src/common'),
    },
  },
});
