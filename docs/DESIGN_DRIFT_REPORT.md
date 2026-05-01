# Design Drift Report — Pessy PWA

> Auditoría de las 19 reglas UX vs código live runtime (`routesV2.tsx` → `HomeScreenSimplified.tsx` → `PetHomeView.tsx`).
> Generado: 2026-04-30

---

## 1. Reglas UX: cumplimiento por regla

### ❌ Regla 1 — NO sidebar

| Status | Detalle |
|---|---|
| **INCUMPLE** | `HomeScreenSimplified.tsx:45` importa `openSidebar` de `useAppLayout()` |
| | `HomeScreenSimplified.tsx:68` — `onClick={openSidebar}` en botón hamburger |
| | `AppLayout.tsx` renderiza un `Sidebar` component como overlay |

### ❌ Regla 2 — NO hamburger menu

| Status | Detalle |
|---|---|
| **INCUMPLE** | `HomeScreenSimplified.tsx:64-69` — Botón `≡` (MaterialIcon "menu") fijo en `top-4 left-4 z-40` |

### ✅ Regla 3 — NO porcentaje de salud

| Status | Detalle |
|---|---|
| **CUMPLE** | `grep` no encontró `%.*salud`, `salud.*%`, `healthy`, `sick`, `health.*percent` en componentes live |

### ✅ Regla 4 — NO clasificación healthy/sick

| Status | Detalle |
|---|---|
| **CUMPLE** | No se encontró clasificación automática en Home. `HealthPulse.tsx` muestra datos factuales (vacunas vencidas, medicamentos activos, última visita) sin claim de estado |

### ✅ Regla 5 — NO diagnóstico generado por IA

| Status | Detalle |
|---|---|
| **CUMPLE** | `PessyIntelligenceEngine` genera recomendaciones prácticas (paseo, alimento, rutina), no diagnósticos. ExportReportModal solo muestra `documentedDiagnoses`, no IA |

### ❌ Regla 6 — Bottom nav 4 pillars: Día a Día / Rutinas / Comunidad / Identidad Digital

| Status | Detalle |
|---|---|
| **INCUMPLE** | `BottomNavRouted.tsx` tiene **5 tabs**: Inicio / Identidad / [Agregar] / Rutinas / Servicios |
| | Faltan: **Comunidad** y **Día a Día** |
| | Sobrante: **Servicios** (no en spec), **Inicio** (debería ser "Día a Día") |
| | El botón central `+` ("Agregar") no está en la spec de 4 pillars |

### ❌ Regla 7 — Saludo "Hola {tutor}, ¿cómo está {pet}?"

| Status | Detalle |
|---|---|
| **INCUMPLE** | `PetHomeView.tsx` NO tiene saludo. Abre directo con hero photo + nombre pet |
| | No hay `Hola` ni `¿cómo está` en ningún componente Home live |

### ⚠️ Regla 8 — Tono Plano (NO "historial clínico")

| Status | Detalle |
|---|---|
| **PARCIAL** | `ExportReportModal.tsx:1644,1646` — usa "historial clínico" en disclaimers del PDF |
| | `AppointmentsScreen.tsx:444` — "historial clínico" en un subtitle |
| | El resto de la UI usa "Historial" correctamente |

### ❓ Regla 9 — Español rioplatense (vos, pensá, mirá)

| Status | Detalle |
|---|---|
| **PARCIAL** | `PetHomeView.tsx` usa "Contanos" (✅ rioplatense) |
| | `ExportReportModal.tsx:1667` — "Intentá de nuevo" (✅) |
| | No se auditaron todas las pantallas — probable mix con español neutro |

### ✅ Regla 10 — CTAs únicos por pantalla

| Status | Detalle |
|---|---|
| **CUMPLE** | `PetHomeView` no tiene múltiples botones primarios. Las acciones son cards de acción, no CTAs compitiendo |

### ✅ Regla 11 — Empty states honestos

| Status | Detalle |
|---|---|
| **CUMPLE** | `HealthPulse.tsx` cuenta `0` sin fabricar narrativa. No se encontró texto inventado para estados vacíos |

### ⚠️ Regla 12 — Carnet digital separado del Timeline

| Status | Detalle |
|---|---|
| **VERIFICAR** | `VaccinationCardModal.tsx` existe como componente modal separado. Se accede desde perfil. No se mezcla con el Timeline |

### ✅ Regla 13 — Pack ID visible en Carnet

| Status | Detalle |
|---|---|
| **CUMPLE** | `VaccinationCardModal.tsx:203-204` — muestra `Pack ID: {petData.publicId}` en monospace |
| | `PetContext.tsx:237-254` — genera `pet-XXXXXX` con lazy-gen |

### ❌ Regla 14 — "Pasó algo" botón — estilo especificado

| Status | Detalle |
|---|---|
| **INCUMPLE** | Spec dice: `bg-[#FEF2F2]` border `#FCA5A5` text `#B91C1C`, como **card** en Home |
| | Implementado: `bg-red-500 text-white` como **floating button** bottom-right (`HomeScreenSimplified.tsx`) |
| | Debería ser una card dentro del contenido de Home, no un FAB |

### ❌ Regla 15 — Iconos Material Symbols Outlined (no Lucide)

| Status | Detalle |
|---|---|
| **INCUMPLE** | **20 archivos** en `apps/pwa/src/app/components/` usan `lucide-react` |
| | Componentes live afectados: |
| | — `BottomNavRouted.tsx` (Home, Shield, Plus, Heart, Compass) |
| | — `HealthPulse.tsx` (Heart, Syringe, Pill, Calendar, AlertTriangle) |
| | — `RoutineChecklist.tsx` (Sun, Sunset, Moon) |
| | — `QuickActionsV2.tsx` (multiple icons) |
| | — `HomeHeaderV2.tsx` (Bell) |
| | — `IdentidadScreen.tsx`, `CuidadosScreen.tsx`, `TiendaScreen.tsx`, `RutinasHub.tsx`, `RutinasScreen.tsx` |
| | — `OfflineBanner.tsx`, `Header.tsx` |
| | — Vet components: `VetSearchScreen.tsx`, `VetDoctorProfile.tsx`, `NearbyVetsFromMaps.tsx` |
| | — `TreatingVetsList.tsx` |

### ✅ Regla 16 — Animaciones CSS-only (no framer-motion)

| Status | Detalle |
|---|---|
| **CUMPLE** | `framer-motion` no está importado en ningún archivo de la PWA (solo mencionado en comentarios como "NO usar") |

### ⚠️ Regla 17 — PDF Export estructura (10 secciones)

| Status | Detalle |
|---|---|
| **PARCIAL** | `ExportReportModal.tsx` tiene un PDF extenso (~1700 líneas) pero el orden de secciones no coincide exactamente con la spec de 10 secciones. Requiere auditoría detallada por sección |

### ✅ Regla 18 — Login/Register/Reset dentro de Pessy

| Status | Detalle |
|---|---|
| **CUMPLE** | `routesV2.tsx` tiene `/login`, `/register-user`, `/forgot-password`, `/reset-password` — todo inline, sin redirect a Firebase UI |

### ⚠️ Regla 19 — Email reset rebota a pessy.app/reset-password

| Status | Detalle |
|---|---|
| **VERIFICAR** | `authActionLinks.ts:54` construye URL a `/reset-password` con `handleCodeInApp`. Requiere test real para confirmar que Firebase respeta la URL |

---

## 2. Hex colors off-brand (fuera de Plano)

Colores encontrados en componentes live que **no son tokens Plano**:

| Color | Archivos | ¿Qué es? |
|---|---|---|
| `#6B7280` | HealthPulse, ProfileNudge, QuickActions, QuickActionsV2, PessyTip, PetHomeView | Tailwind `gray-500` — usado como texto secundario. Debería ser `#3d5a50` (tx2) o `#6b8a7e` (tx3) |
| `#9CA3AF` | HealthPulse, PetHomeView, QuickActions, PessyTip, RoutineChecklist | Tailwind `gray-400` — subtexto. Debería ser `#6b8a7e` (tx3) |
| `#E5E7EB` | PetHomeView, PetHomeView pills | Tailwind `gray-200` — bordes. Debería ser `#c8d9d2` (border2) |
| `#F59E0B` `#D97706` `#92400E` `#B45309` `#FEF3C7` | QuickActionsV2, ProfileNudge, PessyTip | Tailwind amber palette — alertas. No hay token amber en Plano |
| `#EDE9FE` `#F0F0FF` | QuickActionsV2 | Tailwind violet light — close to `#e3dfff` (purplebg) pero no exacto |
| `#EF4444` `#991B1B` `#FEE2E2` | PessyTip | Tailwind red — alertas. Plano define `#B91C1C` / `#FCA5A5` / `#FEF2F2` para emergencias |
| `#eef8f3` | PetHomeView WeatherPill | Custom mint — close to `#E0F2F1` pero no exacto |

---

## 3. Iconos lucide-react en PWA (debería ser Material)

**20 archivos** usan `lucide-react`. Los más críticos (en runtime live) son:

1. `BottomNavRouted.tsx` — toda la nav usa Lucide
2. `HealthPulse.tsx` — Heart, Syringe, Pill, Calendar, AlertTriangle
3. `RoutineChecklist.tsx` — Sun, Sunset, Moon
4. `QuickActionsV2.tsx` — múltiples iconos
5. `HomeHeaderV2.tsx` — Bell

---

## 4. Preview pages: ¿están gateadas?

| Archivo | Producción segura? |
|---|---|
| `LandingEcosystemPreviewPage.tsx` | ✅ Gateado por `previewRoutesEnabled` (only DEV or env flag) |
| `LandingSocialPage.tsx` | ✅ No rendido en `routesV2.tsx` |
| `VaccinationCardPreviewPage.tsx` | ✅ Gateado por `previewRoutesEnabled` |
| `WellbeingMasterBookPreviewPage.tsx` | ✅ Gateado |
| `WellbeingProductPreviewPage.tsx` | ✅ Gateado |

⚠️ **NOTA:** `LandingEcosystemPreviewPage` SÍ se usa en `RootRoute()` para hosts que no son `app.pessy.app`, `localhost`, ni native — pero esto es intencional (la landing pública en `pessy.app` renderiza el ecosistema).

---

## 5. Resumen de drift por prioridad

### 🔴 Alto impacto (afectan la experiencia core)

| # | Drift | Fix estimado |
|---|---|---|
| 1 | Hamburger + Sidebar (Reglas 1-2) | Remover botón `≡` de HomeScreenSimplified, remover `openSidebar` |
| 2 | Saludo ausente (Regla 7) | Agregar "Hola {tutor}, ¿cómo está {pet}?" antes del hero |
| 3 | Bottom nav 5 tabs vs 4 pillars (Regla 6) | Reestructurar tabs. Decisión de producto requerida |
| 4 | "Pasó algo" estilo (Regla 14) | Cambiar de FAB rojo a card con tokens Plano |

### 🟡 Medio impacto (inconsistencia visual)

| # | Drift | Fix estimado |
|---|---|---|
| 5 | Lucide en BottomNav + componentes Home (Regla 15) | Migrar a MaterialIcon — ~20 archivos |
| 6 | Hex off-brand gray/amber/red (tokens) | Reemplazar por tokens Plano — ~10 archivos |
| 7 | "historial clínico" en texto (Regla 8) | 3 ocurrencias a corregir |

### 🟢 Bajo impacto / verificar

| # | Drift | Nota |
|---|---|---|
| 8 | PDF orden de secciones (Regla 17) | Requiere auditoría dedicada del ExportReportModal |
| 9 | Email reset URL (Regla 19) | Requiere test real |
| 10 | Español rioplatense (Regla 9) | Auditoría global de strings |
