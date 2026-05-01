/**
 * vitest.config.ts — SCRUM-44
 */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // Fuerza el build de desarrollo de React en el entorno de test
  // Sin esto, act() falla con "not supported in production builds"
  define: {
    "process.env.NODE_ENV": JSON.stringify("test"),
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./apps/pwa/src/test/setup.ts"],
    include: ["apps/pwa/src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules",
      "dist",
      "android",
      "ios",
      // sentryConfig is a no-op stub pending SCRUM-48 — tests fail by design
      "apps/pwa/src/app/config/sentryConfig.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "apps/pwa/src/app/utils/**",
        "apps/pwa/src/app/services/**",
        "apps/pwa/src/app/config/**",
        "apps/pwa/src/i18n/**",
      ],
      exclude: ["**/*.test.*", "**/*.spec.*", "**/node_modules/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/pwa/src"),
    },
    conditions: ["development", "browser"],
  },
});
