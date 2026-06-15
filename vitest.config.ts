import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // `server-only` throws when imported outside an RSC bundle; stub it so
      // server-only helpers (e.g. lib/server/seasonChange) are unit-testable.
      'server-only': path.resolve(__dirname, 'test/stubs/server-only.ts'),
    },
  },
});
