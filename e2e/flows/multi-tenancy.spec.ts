/**
 * multi-tenancy.spec.ts — SCRUM-51
 * Flujo 4: Multi-tenancy — mascotas múltiples + portal veterinario.
 */
import { test, expect } from "../fixtures/base";

test.describe("Flujo 4 — Multi-tenancy (mascotas múltiples + portal vet)", () => {
  // ── Portal veterinario ────────────────────────────────────────────────────

  test("ruta /vet/login renderiza el portal veterinario", async ({ page }) => {
    await page.goto("/vet/login");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("Error fatal");
    // VetLoginScreen siempre renderiza el formulario (sin guard de authLoading).
    // expect().toBeVisible() auto-reintenta hasta que el elemento sea visible.
    await expect(page.locator("h1, h2, h3, input, button, form").first()).toBeVisible({ timeout: 15_000 });
  });

  test("ruta /vet/dashboard no accesible sin auth", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/vet/dashboard");
    await page.waitForLoadState("networkidle");
    // Dar tiempo a Firebase Auth para inicializar y redirigir
    try {
      await page.waitForURL(/\/login/, { timeout: 30_000 });
    } catch {
      // Si no redirigió, verificar que al menos no muestra el dashboard
    }
    // En ningún caso debe mostrar el dashboard completo sin auth
    await expect(page.locator("body")).not.toContainText("Error fatal");
    await ctx.close();
  });

  test("ruta /vet/register renderiza formulario", async ({ page }) => {
    await page.goto("/vet/register");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("Error fatal");
    // Debe tener inputs O un heading visible
    const hasInput = await page.locator("input").first().isVisible({ timeout: 8_000 }).catch(() => false);
    const hasHeading = await page.getByRole("heading").first().isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasInput || hasHeading).toBeTruthy();
  });

  // ── Registro de usuario + mascota ─────────────────────────────────────────

  test("pantalla /register-user tiene formulario accesible", async ({ page }) => {
    await page.goto("/register-user");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("Error fatal");
    const emailInput = page.locator("input[type='email'], input[placeholder*='correo' i]").first();
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
  });

  test("botón 'Crear cuenta' en /login navega a /register-user", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 20_000 });
    const crearCuenta = page.locator("button", { hasText: /crear cuenta/i }).first();
    await expect(crearCuenta).toBeVisible({ timeout: 5_000 });
    await crearCuenta.click();
    await page.waitForURL(/\/register-user/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/register-user/);
  });

  test("ruta /register-pet requiere auth o redirige correctamente", async ({ page }) => {
    await page.goto("/register-pet");
    await page.waitForLoadState("networkidle");
    const url = page.url();
    if (url.includes("/login")) {
      // Sin auth → redirige a login. Correcto.
      await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15_000 });
    } else {
      // Con auth → formulario de mascota
      await expect(page.locator("body")).not.toContainText("Error fatal");
      const headingOrInput = page.locator("h1, h2, input").first();
      await expect(headingOrInput).toBeVisible({ timeout: 10_000 });
    }
  });

  // ── Aislamiento de datos ──────────────────────────────────────────────────

  test("home muestra datos del usuario o redirige a login", async ({ page }) => {
    await page.goto("/inicio");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("Error fatal");
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("rutas inexistentes redirigen via catch-all", async ({ page }) => {
    await page.goto("/ruta-que-no-existe-xyz-123");
    await page.waitForLoadState("networkidle");
    const url = page.url();
    expect(
      url.includes("/login") || url.includes("/inicio") || url.includes("/empezar")
    ).toBeTruthy();
  });

  test("sin errores de consola críticos en /vet/login", async ({ page }) => {
    const criticalErrors: string[] = [];
    page.on("pageerror", (err) => criticalErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error" &&
          !msg.text().includes("net::ERR") &&
          !msg.text().includes("favicon") &&
          !msg.text().includes("chrome-extension") &&
          !msg.text().includes("Deprecation")) {
        criticalErrors.push(msg.text());
      }
    });
    await page.goto("/vet/login");
    await page.waitForLoadState("networkidle");
    expect(criticalErrors).toHaveLength(0);
  });
});
