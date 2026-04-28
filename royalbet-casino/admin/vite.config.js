import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[Admin Proxy Error]', err.message);
          });
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('[Admin Proxy]', req.method, req.url);
          });
        },
      },
    },
  },
});


