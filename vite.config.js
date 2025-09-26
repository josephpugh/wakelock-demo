import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: '127.0.0.1',
    https: false,
    allowedHosts: true
  },
  test: {
    environment: 'jsdom',
    setupFiles: './setupTests.ts',
    css: true,
    restoreMocks: true,
  }
})
