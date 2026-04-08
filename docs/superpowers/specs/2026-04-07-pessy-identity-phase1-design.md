# Pessy Identity & Emotional Feedback — Phase 1 Design

**Date:** 2026-04-07
**Status:** Approved
**Scope:** Identity manifesto, emotional feedback layer, copy neutralization (es-latam)

---

## 1. Problem Statement

Pessy has solid visual design (tokens, animations, colors) and a clear product map (4 pillars). But the app feels like a medical dashboard with emojis. The personality exists in the Home screen and onboarding, but disappears when the user takes action. Registering a medication, scheduling an appointment, exporting a report — all feel like CRUD forms with no emotional closure.

**Inspiration:** Doola took something boring (LLC formation) and made it feel like launching a dream. Pessy should take something anxiety-inducing (pet care) and make it feel effortless — like having a friend who knows everything about pets and keeps the chaos under control.

---

## 2. Identity Manifesto

### Tagline (internal)

> "Pessy is for tutors who keep the chaos under control."

### Tagline (user-facing, es-latam)

> "Pessy. Tu mejor amigo para cuidar a tu mejor amigo."

### Who is Pessy

- Pessy is a companion, not a tool
- Pessy knows about pets but is never condescending
- Pessy talks like a friend who works at a vet clinic — knows a lot but says it simply
- Pessy never makes you feel like you're doing something wrong. Pessy makes you feel like you're already doing the right thing

### Voice Rules

| Yes | No |
|-----|----|
| "¡Listo! Todo en orden." | "Registro guardado exitosamente." |
| "Te recuerdo mañana" | "Se ha programado una notificación" |
| "Luna necesita su refuerzo pronto" | "Vacuna próxima a vencer" |
| "Info lista para compartir." | "Reporte generado" |

### Tone

Warm, direct, trustworthy. Never clinical, never childish, never generic.

### Language: Neutral Latin American Spanish

- Always "tu", never "vos" or "usted"
- No regional slang: no "chido", no "genial", no "copado", no "bacano"
- Universal words: "turno" (not "cita"), "mascota" (not "animalito"), "veterinario" (not "vet" in user-facing copy)
- "turno" preference applies to user-facing UI strings only; internal regex/classification patterns (e.g., in MedicalContext) keep both "turno" and "cita" for document matching accuracy
- Avoid gendered adjectives when referring to pets — use neutral phrasing (e.g., "tiene protección al día" instead of "está protegido/a")
- Emojis yes, but with moderation — they reinforce, never replace
- Portuguese (Brazilian) planned for a future phase, not in scope

---

## 3. PessyReact Component

### What it is

A personality-driven feedback toast that appears after every meaningful user action. Replaces silent confirmations and generic toasts.

### Behavior

- Appears from bottom, lasts 3-4 seconds, fades out automatically
- White background with subtle border in the pillar's color
- Small Pessy icon + message text
- CSS animation only (reuse existing `pessy-fade-up`), no framer-motion
- Non-blocking — does not interrupt the user flow
- Tappable to dismiss early

### Architecture

**New file:** `src/app/components/shared/PessyReact.tsx`

Props:
- `action: string` — key identifying the action (e.g., "medication_registered")
- `petName: string` — pet's name for personalization
- `points?: number` — optional points earned
- `pillar?: 'diaDia' | 'rutinas' | 'comunidad' | 'identidad'` — for border color

**New file:** `src/app/constants/pessyVoice.ts`

Contains message pools per action key. Each action has 2-3 variants to avoid repetition. The component randomly selects one, never repeating the last used variant.

### Mounting & State Management

A single `<PessyReact />` instance is mounted in `App.tsx` (or the main layout wrapper). Screens trigger it via a shared context (`usePessyReact()` hook). The `lastUsedVariant` map is held in a `useRef` inside the context provider, surviving across navigations within a session.

### Coexistence with Sonner

The project already uses `sonner` for toasts. The relationship:
- **PessyReact** handles personality feedback (action confirmations, emotional closure)
- **Sonner** remains for system-level messages (auth errors, network errors, technical confirmations)
- They should not appear simultaneously. If both fire on the same action, PessyReact takes visual priority and Sonner is suppressed
- Over time (Phase 2+), Sonner usage can be migrated to PessyReact where appropriate

### Accessibility

- Container uses `role="status"` and `aria-live="polite"` so screen readers announce the message without interrupting the user
- Dismiss button (if tapped) is focusable with appropriate `aria-label`

### Reaction Map

#### Rutinas Pillar

| Action | Variants |
|--------|----------|
| Register medication | 1. "Anotado. {nombre} tiene su medicación al día." 2. "Listo. Pessy se acuerda por ti." 3. "Medicamento registrado. {nombre} tiene cobertura." |
| Schedule appointment | 1. "Turno agendado. Te aviso antes para que no se te pase." 2. "Listo. Pessy te recuerda cuando se acerque." 3. "Agendado. {nombre} tiene su turno reservado." |
| Complete vaccine | 1. "{nombre} tiene una vacuna menos de qué preocuparse." 2. "Vacuna registrada. {nombre} tiene protección al día." 3. "Hecho. Una preocupación menos para ti." |
| Mark deworming | 1. "Hecho. Pessy lleva la cuenta por ti." 2. "Desparasitación registrada. {nombre} está al día." 3. "Anotado. Te aviso cuando toque la próxima." |
| Create reminder | 1. "Recordatorio creado. Pessy te avisa cuando sea hora." 2. "Listo. No se te va a pasar." 3. "Anotado. Pessy se encarga de recordarte." |

#### Día a Día Pillar

| Action | Variants |
|--------|----------|
| Complete daily routine | 1. "Día completo para {nombre}. Todo bajo control." 2. "Rutina lista. {nombre} tuvo un gran día." 3. "Todo hecho. Así se cuida a {nombre}." |
| Complete daily hook | 1. "¡Bien! +{puntos} puntos para ti." 2. "Actividad completada. +{puntos} puntos." 3. "¡Hecho! Sumaste {puntos} puntos hoy." |

#### Identidad Digital Pillar

| Action | Variants |
|--------|----------|
| Export report | 1. "Info lista para compartir." 2. "Reporte listo. Comparte cuando quieras." 3. "Todo preparado. Solo elige con quién compartirlo." |
| Scan document | 1. "Documento procesado. Ya está en el historial de {nombre}." 2. "Escaneado. Pessy lo organizó por ti." 3. "Listo. {nombre} tiene un registro más." |
| Update profile | 1. "Perfil actualizado. Pessy conoce mejor a {nombre}." 2. "Guardado. {nombre} tiene su info al día." 3. "Actualizado. Pessy toma nota." |

#### Comunidad Pillar

| Action | Variants |
|--------|----------|
| Report lost pet | 1. "Publicado. Ojalá vuelva pronto a casa." 2. "Alerta activa. Pessy ayuda a difundir." 3. "Listo. Muchos ojos buscando ahora." |
| Contact vet | 1. "Conectando. {nombre} está en buenas manos." 2. "Listo. El veterinario tiene la info de {nombre}." 3. "Contacto enviado. Pessy está pendiente." |

#### Error State

| Variants |
|----------|
| 1. "Algo falló. Intenta de nuevo — Pessy no va a perder nada." |
| 2. "No se pudo completar. Intenta otra vez." |
| 3. "Hubo un problema. Tu info está segura, intenta de nuevo." |

### Rules

- Always use the pet's name, never "tu mascota"
- Maximum 2 lines
- Maximum 1 exclamation per message
- Never repeat the same variant consecutively (track last used)
- Pool of 2-3 variants per action

---

## 4. Copy Neutralization (De-argentinization)

### Systematic Rules

All imperative verbs in voseo (-a, -e endings) convert to tu form. All "vos" becomes "tu". All "sos" becomes "eres".

### Screen-by-screen Changes

#### RegisterUserScreen
- **Before:** "Su historia comienza aquí. Pessy lo maneja. Vos lo disfrutás. Empezá gratis."
- **After:** "Su historia comienza aquí. Pessy lo maneja. Tú lo disfrutas. Empieza gratis."
- Highlights: "Identidad digital", "Rutinas", "Co-tutores" (no change)
- Country question: "¿De dónde sos?" → "¿De dónde eres?"

#### RegisterPetStep1
- **Before:** "Porque quererlo ya es suficiente trabajo. Contanos quién es. Pessy se encarga del resto."
- **After:** "Porque quererlo ya es suficiente trabajo. Cuéntanos quién es. Pessy se encarga del resto."

#### RegisterPetStep2
- **Before:** "Con esto, Pessy organiza sus documentos, recordatorios y cuidados solo. Vos solo disfrutás."
- **After:** "Con esto, Pessy organiza sus documentos, recordatorios y cuidados. Tú solo disfruta."

#### HomeScreen / ProfileNudge
- **Before:** "Woof! Completa el perfil de {nombre}" (check if voseo)
- **After:** Verify all imperatives use tu form

#### RoutineChecklist
- Verify all labels use tu form
- "{nombre} ya descansa. Manana seguimos." — no change (neutral)

#### All Other Screens
- Grep for: vos, sos, -a (voseo imperative endings)
- Replace systematically

### What Does NOT Change
- "Pessy lo maneja" — universal
- "Ya casi" — neutral
- "Mañana seguimos" — neutral
- "Hola, {nombre}" — neutral
- Section names ("Día a Día", "Rutinas", etc.) — neutral

---

## 5. Empty States with Pessy Voice

Current empty states are generic. Phase 1 gives them Pessy's voice.

| Screen | Current | Phase 1 |
|--------|---------|---------|
| Timeline empty | "Aún no hay eventos médicos registrados" | "Todavía no hay nada aquí. Escanea un documento o agrega algo manual — Pessy lo organiza." |
| Routines empty | "No tienes tareas pendientes" | "Todo limpio. {nombre} no tiene pendientes hoy." |
| Medications empty | (generic) | "Sin medicamentos activos. Cuando haya, Pessy te recuerda cada dosis." |
| Appointments empty | (generic) | "{nombre} no tiene turnos agendados. Cuando haya uno, Pessy te avisa antes." |
| Documents empty | (generic) | "Sin documentos todavía. Escanea o sube uno — Pessy lo guarda y organiza." |
| Reminders empty | "No tenés recordatorios pendientes. Agregá uno" | "Sin recordatorios activos. Cuando crees uno, Pessy te avisa a tiempo." |

---

## 6. Files Affected

### New Files
| File | Purpose |
|------|---------|
| `src/app/components/shared/PessyReact.tsx` | Feedback toast component |
| `src/app/constants/pessyVoice.ts` | Message pools per action |

### Files to Edit — User-facing UI copy (neutralization + PessyReact integration)
| File | Changes |
|------|---------|
| `src/app/components/auth/RegisterUserScreen.tsx` | Neutralize voseo copy |
| `src/app/components/auth/EmailLinkSignInScreen.tsx` | Neutralize "Ya sos co-tutor" |
| `src/app/components/pet/PetProfileModal.tsx` | Neutralize + add PessyReact |
| `src/app/components/home/HomeScreen.tsx` | Neutralize copy |
| `src/app/components/home/QuickActions.tsx` | Neutralize copy |
| `src/app/components/medical/MedicationsScreen.tsx` | Neutralize + add PessyReact + empty state |
| `src/app/components/medical/Timeline.tsx` | Empty state update |
| `src/app/components/medical/ActionTray.tsx` | Add PessyReact |
| `src/app/components/medical/ExportReportModal.tsx` | Add PessyReact |
| `src/app/components/medical/DocumentScannerModal.tsx` | Neutralize copy + add PessyReact |
| `src/app/components/pet/PetHomeView.tsx` | Neutralize copy |
| `src/app/components/reminders/RemindersScreen.tsx` | Neutralize + empty state + add PessyReact |
| `src/app/components/settings/StorageUsageWidget.tsx` | Neutralize "no podes subir más" etc. |
| `src/app/components/nearby/NearbyVetsScreen.tsx` | Neutralize copy |
| `src/app/components/shared/BottomNav.tsx` | Verify copy |
| `src/app/components/shared/Header.tsx` | Verify copy |
| `src/app/components/settings/PrivacySecurityScreen.tsx` | Verify copy |
| `src/app/components/settings/AppearanceScreen.tsx` | Verify copy |
| `src/app/components/vet/VetDashboard.tsx` | Verify copy |
| `src/app/components/vet/VetConsultationView.tsx` | Verify copy |
| `src/app/components/ConsentManager.tsx` | Neutralize "por vos antes de confirmarse" |

### Files to Edit — Contexts & services (user-facing strings only)
| File | Changes |
|------|---------|
| `src/app/contexts/PetContext.tsx` | Neutralize "No podes invitarte a vos mismo", "Ya sos tutor principal" |
| `src/app/contexts/MedicalContext.tsx` | Neutralize user-facing strings only; keep internal regex patterns unchanged |

### Files to Edit — Landing pages (public-facing, high visibility)
| File | Changes |
|------|---------|
| `src/app/pages/EmpezarLandingPage.tsx` | Neutralize "Empezá", "Contanos", "No te acordás" |
| `src/app/pages/LandingEcosystemPreviewPage.tsx` | Neutralize "Empezá a ordenar", "Contanos" |
| `src/app/pages/LandingSocialPage.tsx` | Neutralize copy |

### Files to Edit — Empty states
| File | Changes |
|------|---------|
| `src/app/components/reminders/RemindersScreen.tsx` | "No tenés recordatorios..." → Pessy voice |

Approximate count: ~27 files to edit, 2 new files.

---

## 7. What is NOT in Scope

- No flow changes or new screens
- No conversational/chat-style interactions (Phase 2)
- No gamification/reward system changes (Phase 3)
- No navigation or pillar changes
- No Portuguese language (future phase)
- No design token changes (colors, fonts, spacing)
- No new dependencies

---

## 8. Phase Roadmap (Reference)

| Phase | What | When |
|-------|------|------|
| **Phase 1** (this spec) | Identity manifesto + PessyReact + copy neutralization + empty states | Now |
| **Phase 2** | Pessy as guide within flows (before/during actions) | After Phase 1 validated |
| **Phase 3** | Reward system connected to identity | After Phase 2 validated |

---

## 9. Success Criteria

- All user-facing copy uses neutral latam Spanish ("tu" form)
- Zero voseo remaining in the codebase
- Every meaningful user action triggers a PessyReact feedback
- Empty states have Pessy's voice, not generic text
- No structural, navigation, or design token changes
- App feels like a companion, not a medical dashboard
