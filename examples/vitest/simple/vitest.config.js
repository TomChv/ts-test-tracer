import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    experimental: {
      openTelemetry: {
        enabled: false,
      //   sdkPath: './otel-sdk.js',
      },
    },
  },
})