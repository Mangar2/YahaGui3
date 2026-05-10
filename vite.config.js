import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/store': {
        target: 'http://192.168.0.183',
        changeOrigin: true,
      },
      '/publish': {
        target: 'http://192.168.0.183',
        changeOrigin: true,
      },
    },
  },
})
