import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'node:fs';

// Dev only: serve the local (git-ignored) seed snapshot at ./api/snapshot.
const devSnapshot = {
  name: 'dev-snapshot',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (!req.url?.includes('/api/snapshot')) return next();
      res.setHeader('Content-Type', 'application/json');
      res.end(existsSync('seed/seed.json') ? readFileSync('seed/seed.json') : JSON.stringify({ error: 'run npm run seed' }));
    });
  },
};

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version + '+' + new Date().toISOString().slice(0, 10)) },
  plugins: [react(), devSnapshot],
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false, target: 'es2020' },
  server: { host: true, port: 5173 },
});
