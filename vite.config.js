import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  envDir: './env',
  server: { host: true, watch: { ignored: ['**/.*', '**/secrets', '**/tools/**'] } },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: { input: { main: 'index.html' } },
  },
});
