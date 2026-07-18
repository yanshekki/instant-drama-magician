/// <reference types="vite/client" />

declare module '*.json' {
  const value: Record<string, unknown>
  export default value
}

declare module '*.svg' {
  const src: string
  export default src
}
