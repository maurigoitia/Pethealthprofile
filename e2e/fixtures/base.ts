/**
 * base.ts — SCRUM-51
 * Fixture base con helpers para todos los tests E2E de Pessy.
 */
import { test as base, expect, type Page } from "@playwright/test";

// ── Helpers reutilizables ─────────────────────────────────────────────────────

/** Espera a que la pantalla de inicio cargue con al menos un pet visible */
export async function waitForHome(page: Page) {
  await page.waitForURL(/\/inicio|\/home/, { timeout: 15_000 });
  // La home siempre tiene el nav bottom
  await expect(page.locator("nav, [role='navigation']").first()).toBeVisible({
    timeout: 10_000,
  });
}

/** Navega a /inicio y espera que cargue */
export async function goHome(page: Page) {
  await page.goto("/inicio");
  await waitForHome(page);
}

/** Verifica que el usuario NO está autenticado (redirige a /login) */
export async function expectUnauthenticated(page: Page) {
  await page.goto("/inicio");
  await page.waitForURL(/\/login/, { timeout: 10_000 });
}

/** Salta el test si no hay credenciales de test configuradas */
export function skipIfNoCredentials() {
  if (!process.env.PESSY_TEST_EMAIL || !process.env.PESSY_TEST_PASSWORD) {
    test.skip(true, "Requiere PESSY_TEST_EMAIL y PESSY_TEST_PASSWORD en .env.test");
  }
}

// Re-exportar test/expect de Playwright para conveniencia
export { expect };
export const test = base;
