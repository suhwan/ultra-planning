import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['references/**/*', 'node_modules/**/*'],
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/**/types.ts',
        'src/**/index.ts',
        'src/**/__mocks__/**',
      ],
      // Current coverage baseline (as of Phase 22-04):
      // - Statements: 28.24%
      // - Branches: 78.01%
      // - Functions: 71.64%
      // - Lines: 28.24%
      // Set thresholds slightly below current to allow for minor fluctuations
      // TODO: Increase thresholds as coverage improves
      thresholds: {
        global: {
          statements: 25,
          branches: 70,
          functions: 65,
          lines: 25,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
