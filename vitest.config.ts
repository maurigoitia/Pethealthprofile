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
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", "android", "ios"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/app/utils/**",
        "src/app/services/**",
        "src/app/config/**",
        "src/i18n/**",
      ],
      exclude: ["**/*.test.*", "**/*.spec.*", "**/node_modules/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    conditions: ["development", "browser"],
  },
});
