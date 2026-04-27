import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function healthJsonPlugin(): Plugin {
  return {
    name: 'health-json',
    generateBundle() {
      const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'))
      this.emitFile({
        type: 'asset',
        fileName: 'health.json',
        source: JSON.stringify({ version: pkg.version }),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), healthJsonPlugin()],
})
