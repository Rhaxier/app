// Vite builds and serves the app; Vitest (the `test` block) reuses the same config.
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Tailwind is only for shadcn/ui components (src/components/ui); the app's
  // own screens use CSS Modules and the tokens in src/styles/tokens.css.
  plugins: [react(), tailwindcss()],
  resolve: {
    // `@/components/Button` instead of `../../../components/Button`.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
