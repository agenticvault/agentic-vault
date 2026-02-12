import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { config } from 'dotenv';

config({ path: resolve(import.meta.dirname, '.env') });

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    globals: true,
  },
});
