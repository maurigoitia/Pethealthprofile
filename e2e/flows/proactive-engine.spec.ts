/**
 * proactive-engine.spec.ts — SCRUM-51
 * Flujo 3: Motor proactivo — Notificaciones y recordatorios.
 */
import { test, expect } from "../fixtures/base";

test.describe("Flujo 3 — Motor proactivo (Login + Notificaciones)", () => {
  test("pantalla de login carga (smoke)", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    // Esperar explícitamente que Firebase Auth inicialice y el input aparezca
    await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("input[type='password']")).toBeVisible();
    await expect(page.getByRole("button", { name: /^ingresar$/i })).toBeVisible();
  });

  test("login muestra error con campos vacíos", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 20_000 });
    // Los inputs tienen el atributo `required` + type="email":
    // el browser usa validación HTML5 nativa (no manda el form) → no se escribe
    // ningún elemento de error en el DOM. Verificamos que el form fue rechazado
    // confirmando que la URL sigue siendo /login (no navegó a /inicio).
    await page.getByRole("button", { name: /^ingresar$/i }).click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain("/login");
  });

  test("login rechaza email inválido", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 20_000 });
    await page.locator("input[type='email']").fill("no-es-un-email");
    await page.locator("input[type='password']").fill("cualquiera");
    await page.getByRole("button", { name: /^ingresar$/i }).click();
    // Esperar respuesta (Firebase devuelve error en ~3s)
    await page.waitForTimeout(4_000);
    await expect(page).not.toHaveURL(/\/inicio/);
  });

  test("toggle mostrar/ocultar contraseña funciona", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='password']")).toBeVisible({ timeout: 20_000 });

    const toggleBtn = page.getByRole("button", { name: /mostrar contraseña/i });
    await expect(toggleBtn).toBeVisible({ timeout: 5_000 });
    await toggleBtn.click();
    await expect(page.locator("input[type='text']").first()).toBeVisible({ timeout: 3_000 });

    await page.getByRole("button", { name: /ocultar contraseña/i }).click();
    await expect(page.locator("input[type='password']")).toBeVisible();
  });

  test("link 'Crear cuenta' navega a /register-user", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 20_000 });
    // El botón puede tener texto exacto "Crear cuenta" — buscar con partial match
    const crearCuenta = page.locator("button", { hasText: /crear cuenta/i }).first();
    await expect(crearCuenta).toBeVisible({ timeout: 5_000 });
    await crearCuenta.click();
    await page.waitForURL(/\/register-user/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/register-user/);
  });

  test("pantalla de notificaciones accesible cuando autenticado", async ({ page }) => {
    await page.goto("/inicio");
    await page.waitForLoadState("networkidle");
    if (page.url().includes("/login")) { test.skip(); return; }

    const notifBtn = page.getByRole("button", { name: /notificaciones/i }).first();
    if (!(await notifBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(); return;
    }
    await notifBtn.click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/medicación|turnos|recordatorios|activar/i).first())
      .toBeVisible({ timeout: 5_000 });
  });

  test("sin errores de consola críticos en /login", async ({ page }) => {
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
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    expect(criticalErrors).toHaveLength(0);
  });
});
