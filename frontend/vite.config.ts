import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
// The dev server listens on localhost. To share it through a tunnel (cloudflared/ngrok),
// only the tunnel domains below are accepted as Host headers; add others with
// VITE_ALLOWED_HOSTS=host1,host2. Production is served as a static build, never via a tunnel.
const tunnelHosts = ['.trycloudflare.com', '.devtunnels.ms', '.ngrok-free.dev', '.ngrok-free.app'];
const extraHosts = (process.env.VITE_ALLOWED_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts: [...tunnelHosts, ...extraHosts],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: false,
      },
    },
  },
});
