import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Custom Prisma Client lives outside node_modules (src/types/prisma).
// It must stay external: CJS + native query engine cannot be rolled up.
const prismaClientExternal = /(?:^|[\\/])src[\\/]types[\\/]prisma(?:[\\/].*)?$/

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('electron/main/index.ts')
        },
        external: [prismaClientExternal]
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('electron/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: resolve('index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve('src'),
        '@application': resolve('src/application'),
        '@domain': resolve('src/domain'),
        '@infrastructure': resolve('src/infrastructure'),
        '@presentation': resolve('src/presentation'),
        '@types': resolve('src/types'),
        '@lib': resolve('src/lib')
      }
    },
    plugins: [
      react(),
      {
        name: 'idm-dev-csp',
        transformIndexHtml(html) {
          if (process.env.NODE_ENV === 'production') return html
          // Vite injects an inline React Refresh preamble; Electron's
          // script-src 'self' blocks it and the renderer stays blank.
          return html.replace(
            "default-src 'self'; script-src 'self';",
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' ws: wss: http://127.0.0.1:* http://localhost:*;"
          )
        }
      }
    ]
  }
})
