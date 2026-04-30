/**
 * auth.setup.ts — SCRUM-51
 * Setup global de Playwright: autentica una vez y guarda el
 * storageState (IndexedDB + cookies de Firebase) para reutilizar
 * en todos los tests sin volver a hacer login.
 *
 * Requiere:
 *   PESSY_TEST_EMAIL    → email de usuario de test en Firebase
 *   PESSY_TEST_PASSWORD → contraseña
 */
import { test as setup, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, "../../playwright/.auth/user.json");

const EMAIL = process.env.PESSY_TEST_EMAIL;
const PASSWORD = process.env.PESSY_TEST_PASSWORD;

setup("autenticar usuario de test", async ({ page }) => {
  if (!EMAIL || !PASSWORD) {
    console.warn(
      "⚠️  PESSY_TEST_EMAIL / PESSY_TEST_PASSWORD no definidos. " +
        "Los tests autenticados se saltarán. Crea un .env.test con esas variables."
    );
    // Guardar estado vacío para que Playwright no falle
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /pessy/i }).or(
    page.locator("input[type='email']")
  )).toBeVisible({ timeout: 15_000 });

  // Rellenar credenciales
  await page.locator("input[type='email']").fill(EMAIL);
  await page.locator("input[type='password']").fill(PASSWORD);
  await page.getByRole("button", { name: /ingresar/i }).click();

  // Esperar a que Firebase Auth complete y rediriga a /inicio
  await page.waitForURL(/\/inicio|\/home/, { timeout: 20_000 });

  // Guardar storageState (incluye IndexedDB donde Firebase guarda tokens)
  await page.context().storageState({ path: AUTH_FILE });
  console.log("✅ Auth guardado en", AUTH_FILE);
});
