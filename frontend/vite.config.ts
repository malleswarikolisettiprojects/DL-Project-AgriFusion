import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'https://dl-project-agrifusion-backend.onrender.com',
          changeOrigin: true,
          secure: true,
        },
        '/health': {
          target: 'https://dl-project-agrifusion-backend.onrender.com',
          changeOrigin: true,
          secure: true,
        },
        '/openapi.json': {
          target: 'https://dl-project-agrifusion-backend.onrender.com',
          changeOrigin: true,
          secure: true,
        },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
