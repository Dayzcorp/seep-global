import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/chat': process.env.VITE_API_BASE || 'http://localhost:5000',
      '/usage': process.env.VITE_API_BASE || 'http://localhost:5000'
    }
  }
});
