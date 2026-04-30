/**
 * playwright.config.ts — SCRUM-51
 * E2E testing para los 4 flujos core de Pessy.
 *
 * Credenciales de test: configura PESSY_TEST_EMAIL y PESSY_TEST_PASSWORD
 * en un archivo .env.test (ver e2e/README.md).
 */
import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// ESM-compatible __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cargar .env.test si existe (no commitear)
dotenv.config({ path: path.resolve(__dirname, ".env.test") });

// Puerto dedicado para E2E — evita colisionar con otros servidores Vite
// corriendo en 5173/5174. Cambiable con PLAYWRIGHT_BASE_URL.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5176";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false, // secuencial para no pisar Firebase state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Simular viewport de mobile (app es mobile-first)
    viewport: { width: 390, height: 844 },
  },

  projects: [
    // ── 1. Setup global: autenticación ────────────────────────────────────────
    {
      name: "setup",
      testMatch: "**/setup/auth.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },

    // ── 2. Flujos core (usan auth guardado) ───────────────────────────────────
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: "**/setup/**",
    },

    // ── 3. Mobile Safari (crítico para App Store) ─────────────────────────────
    {
      name: "mobile-safari",
      use: {
        ...devices["iPhone 14"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: "**/setup/**",
    },
  ],

  // Arrancar dev server en puerto 5176 (dedicado a E2E).
  // reuseExistingServer: false garantiza que siempre usa el codebase correcto
  // con las variables de entorno del .env.local de Pethealthprofile.
  webServer: {
    command: "npm run dev -- --port 5176",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
