import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    // Tests run against core sources so they never require a core build first.
    alias: {
      '@superartillery/core': resolve(import.meta.dirname, '../core/src/index.ts')
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['dist', 'node_modules']
  }
});
