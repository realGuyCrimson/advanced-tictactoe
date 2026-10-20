import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const serverPort = process.env.SERVER_PORT ?? '3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // The pure game engine and wire protocol are shared with the server.
      '@shared': fileURLToPath(new URL('../server/src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': { target: `http://localhost:${serverPort}`, ws: true, changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      '/socket.io': { target: `http://localhost:${serverPort}`, ws: true, changeOrigin: true },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
