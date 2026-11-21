import { defineConfig } from 'vitest/config';
export default defineConfig({ resolve: { alias: { 'cbiz-assets': new URL('./src/worker/assets.empty.ts', import.meta.url).pathname } }, test: { include: ['tests/**/*.test.ts', 'fixtures/**/*.test.ts'], globals: true } });
