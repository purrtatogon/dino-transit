import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // keeps it on the same port CRA used
    open: true,
  },
  build: {
    outDir: 'build', // matches CRA's output folder name
  }
});