import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(options) {
          try { options.startup() } catch (e) { console.error('startup err', e) }
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            sourcemap: false,
            rollupOptions: {
              external: ['electron', 'sql.js', 'jimp', 'archiver', 'fs', 'path', 'crypto'],
              output: {
                format: 'cjs'
              }
            }
          },
          resolve: {
            mainFields: ['main']
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          try { options.reload() } catch (e) { console.error('reload err', e) }
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
              output: { format: 'cjs' }
            }
          }
        }
      }
    ]),
    renderer({
      resolve: {
        byDeveloperDependencies: true
      }
    }),
    {
      name: 'copy-sqljs-wasm',
      writeBundle() {
        try {
          const wasmSrc = resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm')
          if (fs.existsSync(wasmSrc)) {
            const dest = resolve(__dirname, 'dist-electron/sql-wasm.wasm')
            fs.copyFileSync(wasmSrc, dest)
          }
        } catch (e) { /* noop */ }
      },
      closeBundle() {
        try {
          const wasmSrc = resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm')
          if (fs.existsSync(wasmSrc)) {
            const dest = resolve(__dirname, 'dist-electron/sql-wasm.wasm')
            if (!fs.existsSync(dest)) {
              fs.copyFileSync(wasmSrc, dest)
            }
          }
        } catch (e) { /* noop */ }
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  optimizeDeps: {
    exclude: ['antd']
  },
  server: {
    port: 5173,
    strictPort: false
  },
  define: {
    'process.env': '{}'
  }
})
