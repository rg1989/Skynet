import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, backend runs on 3001, Vite runs on 3000
// In production, backend serves everything on 3000
const BACKEND_PORT = 3001;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Single port for development - same as production
    strictPort: true, // Fail if port 3000 is taken
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: false,
    },
    proxy: {
      // Proxy API requests to backend
      '/api': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
      },
      // Proxy WebSocket connections to backend
      '/ws': {
        target: `ws://localhost:${BACKEND_PORT}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
