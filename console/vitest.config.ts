import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts', 'fixtures/**/*.test.ts'], globals: true } });
