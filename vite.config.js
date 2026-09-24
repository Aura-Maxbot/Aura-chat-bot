import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'mini-app',
  base: '/Aura-chat-bot/',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
});