# PESSY Codebase Pruning Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce codebase bloat through safe, incremental pruning — dead code removal, helper extraction, dedup fix, modal extraction — without touching auth, Firebase config, or Gemini interfaces.

**Architecture:** 4 sprints ordered by risk. Sprint 1 is pure deletion/cleanup (zero behavioral change). Sprint 2 extracts helpers from MedicalContext without changing its public API. Sprint 3 decomposes MedicationsScreen modals. Sprint 4 (future) addresses analysisService — deferred until tests exist.

**Tech Stack:** React 18, TypeScript, Vite, Firebase (Firestore), Capacitor

**Guardrails (DO NOT TOUCH):**
- `src/lib/firebase.ts` — auth config
- `src/app/contexts/AuthContext.tsx` — login/register flow
- `src/app/services/analysisService.ts` — Gemini/AI interface (Sprint 4 only, with tests)
- `capacitor.config.ts` — native wrapper config
- Any `.env` or Firebase credential files

---

## Sprint 1: Safe Cleanup (zero behavioral change)

### Task 1: Delete `clinicalRouting.ts`

**Context:** This file has 0 imports across the entire codebase. It's referenced in `vite.config.ts` as a bundle chunk hint, but since nothing imports it, Vite tree-shakes it anyway. The Cloud Functions have their own mirror copy (`functions/src/clinical/projectionLayer.ts`), so the backend is unaffected.

**Files:**
- Delete: `src/app/utils/clinicalRouting.ts`
- Modify: `vite.config.ts:192-197` (remove from chunk list)

- [ ] **Step 1: Verify zero imports one more time**

Run: `grep -r "clinicalRouting" src/ --include="*.ts" --include="*.tsx"`
Expected: 0 matches

- [ ] **Step 2: Delete the file**

```bash
rm src/app/utils/clinicalRouting.ts
```

- [ ] **Step 3: Remove from vite chunk config**

In `vite.config.ts`, change lines 192-197 from:

```typescript
          'app-utils': [
            './src/app/utils/clinicalBrain',
            './src/app/utils/clinicalRouting',
            './src/app/utils/medicalRulesEngine',
            './src/app/utils/deduplication',
          ],
```

to:

```typescript
          'app-utils': [
            './src/app/utils/clinicalBrain',
            './src/app/utils/medicalRulesEngine',
            './src/app/utils/deduplication',
          ],
```

- [ ] **Step 4: Build to verify nothing breaks**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "chore: delete dead clinicalRouting.ts (0 imports)"
```

---

### Task 2: Fix `buildEventDedupKey` duplication

**Context:** `buildEventDedupKey` is defined in `src/app/utils/deduplication.ts:45` and also used internally there at line 96. `MedicalContext.tsx:20` imports it from `deduplication.ts`. The `clinicalBrain.ts` file does NOT define it — earlier analysis was wrong. However, `MedicalContext.tsx:40` imports 9 functions from `clinicalBrain.ts`, and both modules share some naming patterns. The actual fix is to confirm single source of truth and document it.

**Files:**
- Read: `src/app/utils/deduplication.ts:45` (canonical definition)
- Read: `src/app/utils/clinicalBrain.ts` (verify no duplicate)

- [ ] **Step 1: Verify no duplicate exists**

Run: `grep -n "buildEventDedupKey" src/app/utils/clinicalBrain.ts`
Expected: 0 matches (it's only in deduplication.ts)

If matches found: the function must be removed from clinicalBrain.ts and all imports updated to point to deduplication.ts.

- [ ] **Step 2: Verify all imports point to deduplication.ts**

Run: `grep -rn "buildEventDedupKey" src/ --include="*.ts" --include="*.tsx"`
Expected: All imports reference `deduplication` path

- [ ] **Step 3: If no changes needed, skip commit. If changes made, commit:**

```bash
git add -u
git commit -m "fix: consolidate buildEventDedupKey to single source (deduplication.ts)"
```

---

### Task 3: Remove unused raw state exports from MedicalContextType

**Context:** The `MedicalContextType` interface exports 9 raw state arrays. Verified consumer analysis:
- `events` — used by `UserProfileScreen.tsx:35` (1 consumer)
- `activeMedications` — used by `MedicationsScreen.tsx:248` (1 consumer)
- `pendingActions` — 0 direct consumers (HealthReportModal uses getter, not raw)
- `appointments` — 0 direct consumers
- `clinicalConditions` — 0 direct consumers
- `clinicalAlerts` — 0 direct consumers
- `consolidatedTreatments` — 0 direct consumers
- `clinicalEpisodes` — 0 direct consumers
- `clinicalProfileSnapshot` — 0 direct consumers

**Decision:** Keep `events` and `activeMedications` (they have consumers). Remove the other 7 from the interface and the value object. This is safe because all access goes through `getXByPetId()` getters.

**Files:**
- Modify: `src/app/contexts/MedicalContext.tsx:271-325` (interface)
- Modify: `src/app/contexts/MedicalContext.tsx:1803-1822` (value object)

- [ ] **Step 1: Update the interface — remove 7 unused raw exports**

In `src/app/contexts/MedicalContext.tsx`, change the interface from:

```typescript
interface MedicalContextType {
  events: MedicalEvent[];
  addEvent: (event: MedicalEvent) => Promise<boolean>;
  updateEvent: (id: string, updates: Partial<MedicalEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  confirmEvent: (id: string, overrides?: Partial<MedicalEvent>) => Promise<void>;
  getEventsByPetId: (petId: string) => MedicalEvent[];

  pendingActions: PendingAction[];
  addPendingAction: (action: PendingAction) => Promise<void>;
  completePendingAction: (id: string) => Promise<void>;
  deletePendingAction: (id: string) => Promise<void>;
  getPendingActionsByPetId: (petId: string) => PendingAction[];
  getClinicalReviewDraftById: (reviewId: string) => Promise<ClinicalReviewDraft | null>;
  submitClinicalReviewDraft: (
    reviewId: string,
    payload: {
      medications: Array<{
        name: string;
        dosage: string;
        frequency: string;
        duration?: string | null;
      }>;
      eventDate?: string | null;
    }
  ) => Promise<void>;

  activeMedications: ActiveMedication[];
  addMedication: (medication: ActiveMedication) => Promise<void>;
  updateMedication: (id: string, updates: Partial<ActiveMedication>) => Promise<void>;
  deactivateMedication: (id: string) => Promise<void>;
  getActiveMedicationsByPetId: (petId: string) => ActiveMedication[];

  getMonthSummary: (petId: string, month: Date) => MonthSummary;
  saveVerifiedReport: (report: Record<string, unknown>) => Promise<string>;

  appointments: Appointment[];
  addAppointment: (appointment: Appointment) => Promise<void>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  getAppointmentsByPetId: (petId: string) => Appointment[];

  clinicalConditions: ClinicalCondition[];
  clinicalAlerts: ClinicalAlert[];
  consolidatedTreatments: TreatmentEntity[];
  getClinicalConditionsByPetId: (petId: string) => ClinicalCondition[];
  getClinicalAlertsByPetId: (petId: string) => ClinicalAlert[];
  getConsolidatedTreatmentsByPetId: (petId: string) => TreatmentEntity[];

  // ─── Modelo episodico (solo con flag experimental) ────────────────────────────
  clinicalEpisodes: ClinicalEpisode[];
  clinicalProfileSnapshot: ClinicalProfileSnapshot | null;
  getClinicalEpisodesByPetId: (petId: string) => ClinicalEpisode[];
  getProfileSnapshotByPetId: (petId: string) => ClinicalProfileSnapshot | null;
}
```

to:

```typescript
interface MedicalContextType {
  events: MedicalEvent[];
  addEvent: (event: MedicalEvent) => Promise<boolean>;
  updateEvent: (id: string, updates: Partial<MedicalEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  confirmEvent: (id: string, overrides?: Partial<MedicalEvent>) => Promise<void>;
  getEventsByPetId: (petId: string) => MedicalEvent[];

  addPendingAction: (action: PendingAction) => Promise<void>;
  completePendingAction: (id: string) => Promise<void>;
  deletePendingAction: (id: string) => Promise<void>;
  getPendingActionsByPetId: (petId: string) => PendingAction[];
  getClinicalReviewDraftById: (reviewId: string) => Promise<ClinicalReviewDraft | null>;
  submitClinicalReviewDraft: (
    reviewId: string,
    payload: {
      medications: Array<{
        name: string;
        dosage: string;
        frequency: string;
        duration?: string | null;
      }>;
      eventDate?: string | null;
    }
  ) => Promise<void>;

  activeMedications: ActiveMedication[];
  addMedication: (medication: ActiveMedication) => Promise<void>;
  updateMedication: (id: string, updates: Partial<ActiveMedication>) => Promise<void>;
  deactivateMedication: (id: string) => Promise<void>;
  getActiveMedicationsByPetId: (petId: string) => ActiveMedication[];

  getMonthSummary: (petId: string, month: Date) => MonthSummary;
  saveVerifiedReport: (report: Record<string, unknown>) => Promise<string>;

  addAppointment: (appointment: Appointment) => Promise<void>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  getAppointmentsByPetId: (petId: string) => Appointment[];

  getClinicalConditionsByPetId: (petId: string) => ClinicalCondition[];
  getClinicalAlertsByPetId: (petId: string) => ClinicalAlert[];
  getConsolidatedTreatmentsByPetId: (petId: string) => TreatmentEntity[];

  getClinicalEpisodesByPetId: (petId: string) => ClinicalEpisode[];
  getProfileSnapshotByPetId: (petId: string) => ClinicalProfileSnapshot | null;
}
```

- [ ] **Step 2: Update the value object**

In the same file, update the `useMemo` value object (~line 1803) to remove the 7 raw state properties:

Remove these lines from the value object:
- `pendingActions,`
- `appointments,`
- `clinicalConditions,`
- `clinicalAlerts,`
- `consolidatedTreatments,`
- `clinicalEpisodes,`
- `clinicalProfileSnapshot,`

Keep: `events,` and `activeMedications,`

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: Build succeeds. TypeScript catches any consumer that was using removed properties (there should be none based on our audit).

- [ ] **Step 4: Commit**

```bash
git add src/app/contexts/MedicalContext.tsx
git commit -m "chore: remove 7 unused raw state exports from MedicalContextType"
```

---

### Task 4: Lazy-load preview routes in production

**Context:** Preview routes (`/preview/wellbeing`, `/preview/wellbeing-master`, `/preview/vaccination-card`) are already lazy-loaded via `import()`. However, the `previewRoutes` array is conditionally built based on `isProductionAppHost()` — lines 38-97 of `routes.tsx`. Verify that the production guard works correctly so these 900+ line components aren't in the production bundle.

**Files:**
- Read: `src/app/routes.tsx:35-97`

- [ ] **Step 1: Read the preview route guard**

Read `src/app/routes.tsx` lines 35-97 and verify:
1. The conditional `isProductionAppHost() ? [] : [...]` correctly excludes previews
2. The lazy imports use dynamic `import()` (not static)

- [ ] **Step 2: Verify `isProductionAppHost` returns true on pessy.app**

Run: `grep -n "isProductionAppHost" src/app/utils/runtimeFlags.ts`
Read the function definition and confirm it checks for `pessy.app` hostname.

- [ ] **Step 3: If already correctly guarded, no changes needed. Document finding.**

Expected outcome: Preview routes are already excluded from production via the conditional. No code change needed — just verification.

---

### Task 5: Audit deprecated redirect routes

**Context:** `routes.tsx` has 10 redirect routes (lines 127-156). These exist for backward compatibility — old URLs from emails, shared links, or deep links that should not 404.

**Files:**
- Read: `src/app/routes.tsx:125-160`

- [ ] **Step 1: Categorize each redirect**

| Route | Redirects To | Risk of Removal |
|-------|-------------|-----------------|
| `/welcome` | `/login` | LOW — old onboarding URL |
| `/onboarding` | `/login` | LOW — old onboarding URL |
| `/register` | `/register-user` | MEDIUM — may be in old emails |
| `/register-pet-step1` | `/register-pet` | LOW — internal rename |
| `/register-pet-step2` | `/register-pet/step2` | LOW — internal rename |
| `/app` | `/inicio` | MEDIUM — may be in Capacitor deep links |
| `/inicio/vacunas` | `/inicio` | MEDIUM — may be in old shared links |
| `/inicio/medicacion` | `/inicio` | MEDIUM — may be in old shared links |
| `/inicio/historial-medico` | `/inicio` | MEDIUM — may be in old shared links |
| `/soluciones/*` (3 routes) | `/inicio` | LOW — old marketing URLs |
| `/vet` | `/vet/login` | KEEP — convenience redirect |

- [ ] **Step 2: Check if any are referenced in Capacitor/native config**

Run: `grep -r "welcome\|onboarding\|/app\b\|soluciones" android/ ios/ capacitor.config.ts 2>/dev/null`

- [ ] **Step 3: Decision — keep all redirects for now**

These are cheap (one-line `<Navigate>` components), zero-risk to keep, and protect against broken links from emails or bookmarks. Removing them saves negligible bytes but risks broken UX. **Leave them.**

- [ ] **Step 4: Commit (documentation only if any comments added)**

No code change expected. If adding a clarifying comment to the redirect block, commit:

```bash
git add src/app/routes.tsx
git commit -m "docs: document redirect routes as intentional backward compat"
```

---

## Sprint 2: Data Layer Stabilization (MedicalContext helpers)

### Task 6: Extract local helpers from MedicalContext

**Context:** `MedicalContext.tsx` defines 7 local helper functions (lines 90-179) that are only used within the file. Extracting them to a dedicated file reduces cognitive load and makes them independently testable. This does NOT change MedicalContext's public API.

**Files:**
- Create: `src/app/utils/medicalContextHelpers.ts`
- Modify: `src/app/contexts/MedicalContext.tsx:90-179` (remove definitions, add import)

- [ ] **Step 1: Create the helpers file**

Create `src/app/utils/medicalContextHelpers.ts`:

```typescript
import type { MedicalEvent, Appointment } from "../types/medical";
import { parseDateSafe } from "./dateUtils";

export const normalizeForHint = (value?: string | null): string =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const hasMailSyncHint = (value?: string | null): boolean => {
  const text = normalizeForHint(value);
  if (!text) return false;
  return /(correo|mail|gmail|sincroniz|sync)/.test(text);
};

export const normalizeMedicationKey = (value?: string | null): string =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const extractTimeFromText = (value?: string | null): string | null => {
  const text = (value || "").trim();
  const match = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
};

export const hasAppointmentLanguage = (value?: string | null): boolean => {
  const text = normalizeForHint(value);
  if (!text) return false;
  return /(turno|consulta|control|recordatorio|confirmacion|confirmado|agendad|programad|reprogramad|cancelad|cita)/.test(text);
};

export const extractSpecialtyFromText = (value?: string | null): string | null => {
  const text = (value || "").trim();
  const match = text.match(/\b(?:consulta|control|turno)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i);
  return match?.[1]?.trim() || null;
};

export const deriveAppointmentCandidateFromEvent = (event: MedicalEvent): Appointment | null => {
  const extracted = event.extractedData || {};
  const sourceText = [
    extracted.sourceSubject,
    extracted.suggestedTitle,
    extracted.observations,
    extracted.aiGeneratedSummary,
    event.title,
  ]
    .filter(Boolean)
    .join(" · ");
  const detectedRows = Array.isArray(extracted.detectedAppointments) ? extracted.detectedAppointments : [];
  const detected = (detectedRows[0] || {}) as Record<string, unknown>;
  const rawDate =
    (typeof detected.date === "string" ? detected.date : "") ||
    extracted.nextAppointmentDate ||
    extracted.eventDate ||
    "";
  const parsedDate = parseDateSafe(rawDate);
  if (!parsedDate) return null;

  const endOfYesterday = new Date();
  endOfYesterday.setHours(0, 0, 0, 0);
  if (parsedDate.getTime() < endOfYesterday.getTime()) return null;

  const explicitAppointment =
    extracted.documentType === "appointment" ||
    detectedRows.length > 0 ||
    Boolean(extracted.appointmentTime);
  if (!explicitAppointment && !hasAppointmentLanguage(sourceText)) return null;

  const title =
    (typeof detected.title === "string" ? detected.title.trim() : "") ||
    extracted.suggestedTitle ||
    event.title ||
    "Turno veterinario";
  const time =
    extracted.appointmentTime ||
    (typeof detected.time === "string" ? detected.time : "") ||
    extractTimeFromText(sourceText) ||
    "";
  const veterinarian =
    extracted.provider ||
    (typeof detected.provider === "string" ? detected.provider : "") ||
    null;
  const clinic =
    extracted.clinic ||
    (typeof detected.clinic === "string" ? detected.clinic : "") ||
    null;
  const specialty =
    (typeof detected.specialty === "string" ? detected.specialty.trim() : "") ||
    extractSpecialtyFromText(sourceText) ||
    null;

  return {
    id: "",
    petId: event.petId,
    title,
    date: parsedDate.toISOString().slice(0, 10),
    time,
    veterinarian,
    clinic,
    specialty,
    status: "pending" as const,
    source: "auto_extracted" as const,
    sourceEventId: event.id,
    notes: null,
    calendarEventId: null,
    createdAt: new Date().toISOString(),
  };
};
```

NOTE: The `deriveAppointmentCandidateFromEvent` function continues beyond line 179 in the original. Read lines 129-200 of MedicalContext.tsx to capture the complete function body. The code above is approximate — the implementor MUST read the original and copy it exactly, including the full return object with all fields.

- [ ] **Step 2: Update MedicalContext.tsx imports**

At the top of `MedicalContext.tsx`, add:

```typescript
import {
  normalizeForHint,
  hasMailSyncHint,
  normalizeMedicationKey,
  extractTimeFromText,
  hasAppointmentLanguage,
  extractSpecialtyFromText,
  deriveAppointmentCandidateFromEvent,
} from "../utils/medicalContextHelpers";
```

Then remove lines 90-200 (the local definitions of these functions).

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: Build succeeds — behavior identical since functions are the same, just moved.

- [ ] **Step 4: Commit**

```bash
git add src/app/utils/medicalContextHelpers.ts src/app/contexts/MedicalContext.tsx
git commit -m "refactor: extract MedicalContext helpers to medicalContextHelpers.ts"
```

---

### Task 7: Migrate `UserProfileScreen` off raw `events` access

**Context:** `UserProfileScreen.tsx:35` destructures `events` directly from `useMedical()`. After Sprint 1 Task 3 removed most raw exports, `events` still exists but this consumer should use `getEventsByPetId()` for consistency. This is the last step before we can consider removing `events` from the interface too.

**Files:**
- Modify: `src/app/components/settings/UserProfileScreen.tsx`

- [ ] **Step 1: Read UserProfileScreen to understand how `events` is used**

Read the file and find how `events` is consumed. It likely does `events.filter(e => e.petId === ...)` or `events.length`.

- [ ] **Step 2: Replace with getter**

Replace:
```typescript
const { events } = useMedical();
```

with:
```typescript
const { getEventsByPetId } = useMedical();
```

And update the usage to call `getEventsByPetId(activePetId)` instead of filtering `events` manually.

- [ ] **Step 3: Do the same for `activeMedications` in MedicationsScreen if feasible**

Read `MedicationsScreen.tsx:248` and determine if `activeMedications` can be replaced with `getActiveMedicationsByPetId()`. If the raw array is used in a way that the getter can't replace (e.g., watching for length changes across all pets), keep it.

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "refactor: migrate raw state consumers to getters in MedicalContext"
```

---

## Sprint 3: Component Decomposition (MedicationsScreen modals)

### Task 8: Extract Edit Medication Modal

**Context:** `MedicationsScreen.tsx` has an inline edit modal (lines 1001-1056) with 7 state variables and handlers. The codebase already has an established modal pattern (see `AddAppointmentModal.tsx`) with `isOpen`, `onClose`, and callback props.

**Files:**
- Create: `src/app/components/medical/EditMedicationModal.tsx`
- Modify: `src/app/components/medical/MedicationsScreen.tsx`

- [ ] **Step 1: Read MedicationsScreen lines 224-230 and 420-476 and 1001-1056**

Understand:
- State variables: `editingItem`, `editDosage`, `editFrequency`, `editDuration`, `editIntakeTime`, `savingEdit`, `editFeedback`
- Handler: `saveEdit()` function (line 420)
- Helper functions: `extractTimeHHmm()` (252), `applyTimeToIso()` (260), `computeEndDateFromDuration()` (269)

- [ ] **Step 2: Create EditMedicationModal component**

Follow the established pattern from `AddAppointmentModal.tsx`:

```typescript
// src/app/components/medical/EditMedicationModal.tsx

interface MedicationCardItem {
  // Copy the exact type from MedicationsScreen — search for its definition
}

interface EditMedicationModalProps {
  isOpen: boolean;
  item: MedicationCardItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditMedicationModal({ isOpen, item, onClose, onSaved }: EditMedicationModalProps) {
  // Move state: editDosage, editFrequency, editDuration, editIntakeTime, savingEdit, editFeedback
  // Move helpers: extractTimeHHmm, applyTimeToIso, computeEndDateFromDuration
  // Move handler: saveEdit()
  // Move JSX from lines 1001-1056
}
```

The implementor MUST read the original code and copy all logic exactly. The handler calls `updateEvent()` and `updateMedication()` from `useMedical()`, and `addReminder()` from `useReminders()`.

- [ ] **Step 3: Update MedicationsScreen to use the extracted modal**

Replace the inline modal JSX (lines 1001-1056) with:

```tsx
<EditMedicationModal
  isOpen={!!editingItem}
  item={editingItem}
  onClose={() => setEditingItem(null)}
  onSaved={() => setEditingItem(null)}
/>
```

Remove the 7 state variables and `saveEdit` handler that moved to the modal.

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Manual test**

Open the app, go to Medications, tap edit on a medication, verify the modal opens and save works.

- [ ] **Step 6: Commit**

```bash
git add src/app/components/medical/EditMedicationModal.tsx src/app/components/medical/MedicationsScreen.tsx
git commit -m "refactor: extract EditMedicationModal from MedicationsScreen"
```

---

### Task 9: Extract Delete Medication Modal

**Context:** `MedicationsScreen.tsx` has an inline two-stage delete modal (lines 1058-1122) with confirmation + post-delete options (create reminder, export to calendar).

**Files:**
- Create: `src/app/components/medical/DeleteMedicationModal.tsx`
- Modify: `src/app/components/medical/MedicationsScreen.tsx`

- [ ] **Step 1: Read MedicationsScreen lines 234-236, 623-660, and 1058-1122**

Understand:
- State: `deletingItem`, `deleteStage`, `deletingInProgress`
- Handler: `confirmDelete()` (line 623)
- Two-stage flow: confirm → after_options

- [ ] **Step 2: Create DeleteMedicationModal**

```typescript
interface DeleteMedicationModalProps {
  isOpen: boolean;
  item: MedicationCardItem | null;
  onClose: () => void;
  onDeleted: () => void;
}
```

Move: state, handler, JSX. The handler calls `deleteEvent()` and `updateEvent()` from `useMedical()`, and `addReminder()` from `useReminders()`.

- [ ] **Step 3: Update MedicationsScreen**

Replace inline modal with `<DeleteMedicationModal>` component.

- [ ] **Step 4: Build and manual test**

Run: `npm run build`
Test: Open app → Medications → Delete a medication → verify confirm + options flow works.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/medical/DeleteMedicationModal.tsx src/app/components/medical/MedicationsScreen.tsx
git commit -m "refactor: extract DeleteMedicationModal from MedicationsScreen"
```

---

## Sprint 4: Service Split (DEFERRED — requires tests first)

### Task 10: Write tests for analysisService before splitting (FUTURE)

**Context:** `analysisService.ts` (2,973 lines) handles document analysis, MIME types, medical event extraction, report synthesis, and health summaries. Splitting it without tests is high risk because the Gemini/AI interface behaviors are hard to verify visually.

**Prerequisites before starting:**
1. Set up a test runner (vitest or jest) if not already configured
2. Write integration tests for the public API: `callAnalysisAPI`, `generateHealthSummary`, `generateClinicalReportSynthesis`, `extractMedicalData`
3. Mock Firebase/Gemini at the boundary, test pure logic

**This task is intentionally deferred. Do NOT start until Sprint 1-3 are complete and stable.**

---

## Summary: What each sprint delivers

| Sprint | Tasks | Lines Affected | Risk | Behavioral Change |
|--------|-------|---------------|------|-------------------|
| 1: Safe Cleanup | 1-5 | ~250 removed | None | None |
| 2: Data Stabilization | 6-7 | ~110 moved | Low | None (same functions, new file) |
| 3: Component Decomposition | 8-9 | ~150 moved | Medium | None (same UI, new files) |
| 4: Service Split | 10 | Deferred | High | Deferred until tests exist |

**Total estimated reduction:** ~500 lines removed/reorganized across Sprints 1-3, with significantly improved maintainability of MedicalContext and MedicationsScreen.
