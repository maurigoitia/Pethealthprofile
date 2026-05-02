# Riesgos pendientes post-Antigravity (verificados sobre `origin/develop` el 2026-04-30)

> Auditoría de los commits recientes de Antigravity en `origin/develop`. Lo que está bien, lo que está mal, y lo que necesita acción antes de promocionar a `main`.

## ✅ Lo que Antigravity SÍ hizo bien

| Item | Verificado |
|---|---|
| `ios/` removido del root | `git ls-tree origin/develop -- ios` → empty |
| `src/` removido del root | empty |
| `app.html` movido a `apps/pwa/app.html` | sí |
| `vite.config.ts:192` → `apps/pwa/app.html` | sí |
| `QuickActions.tsx` legacy borrado | sí, solo queda `QuickActionsV2.tsx` |
| Lucide → MaterialIcon en 5 archivos: LandingSocialPage, LandingEcosystemPreviewPage, LegalPage, AdoptionFeed, VetDoctorProfile | 0 imports lucide-react en cada uno |
| **Regla 1+2** sidebar+hamburger removidos de `HomeScreenSimplified` | sí |
| **Regla 6** BottomNavRouted ahora 4 pillars (Día a Día / Rutinas / Comunidad / Identidad) | sí, `grid-cols-4` |
| **Regla 7** saludo "Hola {tutor}, ¿cómo está {pet} hoy?" | sí, en `PetHomeView` |
| **Regla 14** "Pasó algo" como card con tokens Plano (`bg-[#FEF2F2]` border `#FCA5A5` text `#B91C1C`) | sí |
| 24 URLs del sitemap responden 200 con contenido real (no SPA shell) | verificado contra prod |
| GSC HTML verification file `/google95347e30e9162e5f.html` responde 200 | sí |

---

## 🔴 Riesgos críticos — necesitan fix antes de promover

### 1. `.gitignore` con conflict markers SIN RESOLVER en develop

**Severidad:** alta — archivo crítico de Git inválido.

El commit `0ddd127` (Antigravity, "surgical monorepo cleanup") dejó esto en `.gitignore`:

```
<<<<<<< HEAD
!apps/web/*.png
.indexnow-key
=======
!apps/website/*.png
>>>>>>> origin/main
```

Cualquier `git status`, build, o linter que parsee `.gitignore` puede tener comportamiento indefinido. Es bug de un merge mal cerrado que se pusheó.

**Fix sugerido:** quedarse con `apps/web/*.png` (ya que el rename `apps/website → apps/web` se completó en PR #92). Sacar los markers, dejar:
```
!apps/web/*.png
.indexnow-key
```

**Quién:** Antigravity en su propia branch (más rápido) o vos en GitHub UI editando el archivo.

---

### 2. Vite output path: posible mismatch con Firebase rewrite

**Severidad:** alta — puede romper SPA fallback en prod después del próximo deploy.

En `vite.config.ts:192`:
```ts
input: path.resolve(__dirname, 'apps/pwa/app.html'),
```

No hay un `root: 'apps/pwa'` declarado. Vite por defecto usa `process.cwd()` como root. Eso significa que el output buildeado puede ir a `dist/apps/pwa/app.html` en lugar de `dist/app.html`.

`firebase.json` tiene la rewrite:
```json
{ "source": "**", "destination": "/app.html" }
```

Si la build genera `dist/apps/pwa/app.html` en lugar de `dist/app.html`, **toda navegación SPA en prod cae a 404** (o algo peor, depende del catch-all).

**Cómo verificarlo:**
```bash
npm run build:pwa
ls -la dist/app.html dist/apps/pwa/app.html
```

Debería existir `dist/app.html`. Si no existe ahí, el deploy de prod va a romperse.

**Fix sugerido (uno de los dos):**
- Agregar `root: 'apps/pwa'` al config de vite y ajustar paths de input
- O dejar la build como está y cambiar `firebase.json` para que apunte a `/apps/pwa/app.html`

**Quién:** Antigravity puede correr el build local en 30 segundos y ver. Decisión técnica que no quiero tocar a ciegas.

---

### 3. `appit` hosting target NO removido (claim falso)

**Severidad:** media — config crítica.

Antigravity dijo: "Se eliminaron los targets de hosting obsoletos appit y appfocusqa". **Solo `appfocusqa` fue removido.** `appit` sigue en `firebase.json` (con su public dir, redirects, headers, rewrites, todo el bloque).

**Cómo verificar:**
```bash
git show origin/develop:firebase.json | grep '"target":'
# →  "target": "app",
# →  "target": "appqa",
# →  "target": "appit",         ← este sigue
# →  "target": "appsubdomain",
```

**Decisión necesaria:**
- Si `appit` se sigue usando para el environment IT (per `CLAUDE.md`), NO tocar.
- Si está abandonado, removerlo en otro PR chico.

**No es bloqueante** para promoción a main, pero el walkthrough de Antigravity no es preciso.

---

## 🟡 Riesgos medios — deuda visible

### 4. Lucide-react sigue importado en 2 archivos

**Severidad:** baja — inconsistencia visual leve.

Antigravity dijo "all icons migrated". Quedaron:

```
apps/pwa/src/app/components/community/AdopterProfileSetup.tsx → 1 lucide import
apps/pwa/src/app/components/shared/AppMockups.tsx              → 1 lucide import
```

**Fix:** mismo patrón que los otros archivos — reemplazar por `MaterialIcon`. ~20 minutos.

---

### 5. Hex colors off-brand en 4 archivos críticos del Home

**Severidad:** media — drift visual contra Plano.

`docs/DESIGN_DRIFT_REPORT.md` (creado por Antigravity en `06f1d49`) listó esto pero NO lo fixeó en `06f1d49` ni después:

| Archivo | hex off-brand encontrados |
|---|---|
| `apps/pwa/src/app/components/home/HealthPulse.tsx` | 1 hit |
| `apps/pwa/src/app/components/home/PessyTip.tsx` | 4 hits |
| `apps/pwa/src/app/components/home/ProfileNudge.tsx` | 2 hits |
| `apps/pwa/src/app/components/pet/PetHomeView.tsx` | 6 hits |

Buscados: `#6B7280`, `#9CA3AF`, `#E5E7EB`, `#F59E0B`, `#EF4444` (Tailwind grays / amber / red).

Reemplazar por tokens Plano: `#3d5a50` (tx2), `#6b8a7e` (tx3), `#c8d9d2` (border2), o los rojos Pessy `#B91C1C` / `#FCA5A5` / `#FEF2F2`.

**Fix:** ~30 minutos de bulk find-and-replace con review.

---

### 6. Meta tag `google-site-verification` sigue como placeholder en HTML live

**Severidad:** baja — bloquea método "meta tag" en GSC pero el método "HTML file" YA está activo.

Verificación en `https://pessy.app/`:
```
curl -s https://pessy.app/ | grep google-site-verification
→ (vacío)
```

El archivo HTML de verificación (`/google95347e30e9162e5f.html`) responde 200, así que **el método HTML file funciona**. El meta tag es redundante para la verificación pero el placeholder en código es confuso.

**Fix:** opcional. Ya verificás GSC con el archivo HTML hoy mismo.

---

## 🟢 Lo que NO requiere acción ahora

- **Drift en Reglas 8 (tono "historial clínico")**, 9 (rioplatense), 17 (orden 10 secciones PDF), 19 (email reset URL): el reporte de Antigravity los marcó "PARCIAL" o "VERIFICAR". No bloqueantes.
- **20 archivos lucide totales**: 5 los hizo Antigravity, 2 quedan (item 4). El restante (~13) son componentes secundarios — backlog.
- **Preview pages gateadas**: ya están bien (Antigravity verificó que no se exponen en prod).
- **Pack ID**: implementado y verificado en backend + frontend.

---

## Acción recomendada

### Antes de PR develop → main

1. **Fix #1 (`.gitignore`)** — bloqueante. Sea Antigravity o vos en UI.
2. **Verificar #2 (vite output)** — un `npm run build:pwa && ls dist/app.html` decide si necesitamos fix o no.

### Después del release a main (no urgente)

3. Decidir si `appit` queda o se va (#3).
4. Migrar los 2 lucide restantes (#4).
5. Reemplazar hex off-brand en HealthPulse / PessyTip / ProfileNudge / PetHomeView (#5).
6. Remover placeholder GSC meta tag (#6).

### Lo que YO puedo hacer si me das OK

- #4 (lucide migration de los 2 archivos)
- #5 (hex tokens fix)
- #6 (remover placeholder)

### Lo que solo Antigravity / vos pueden hacer

- #1 (`.gitignore`) — un humano tiene que decidir cuál side del conflict queda
- #2 (vite output) — requiere correr build local y ver
- #3 (`appit`) — decisión de producto: ¿se usa o no?

---

## Ground truth check rápido

Si querés verificar todo esto vos mismo en 1 minuto:

```bash
git fetch origin develop
git ls-tree origin/develop -- ios src                    # debe estar vacío
git show origin/develop:.gitignore | grep "<<<<<<<\|>>>>>>>"   # debe estar vacío (si no, item #1 vivo)
git show origin/develop:vite.config.ts | grep -E "input|root"   # ver paths
git show origin/develop:firebase.json | grep '"target":'        # ver targets
```
