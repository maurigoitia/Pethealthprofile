# PDF Logo + Auditoría Extracción — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Embeber el logo de Pessy como imagen PNG en el header de los PDFs exportados (ExportReportModal + VaccinationCardModal), reemplazando el texto plano "PESSY". (2) Auditar el pipeline de extracción (Gemini → masterPayload → PDF) verificando que nombres de especialistas, fechas de eventos, vacunas y tratamientos lleguen completos al PDF, documentando gaps en un reporte.

**Architecture:**
- jsPDF acepta imágenes vía `pdf.addImage(dataUrl, "PNG", x, y, w, h)`. Cargamos `/pessy-logo.png` una vez como dataURL en build-time (import) o runtime (fetch). Usamos runtime fetch para evitar bundlers.
- Auditoría: script Node que lee 5 eventos reales de Firestore vía Admin SDK, imprime `extractedData.masterPayload`, y simula los campos que el PDF generaría. Output como markdown report en `docs/audits/`.

**Tech Stack:** jsPDF, TypeScript, React 18, Firebase Admin SDK (Node), Vitest.

---

## File Structure

**Create:**
- `src/lib/pdf/loadLogo.ts` — helper async para cargar logo como dataURL
- `src/lib/pdf/loadLogo.test.ts` — test unitario
- `scripts/audit-extraction.ts` — script de auditoría (Node + Admin SDK)
- `docs/audits/2026-04-25-extraction-audit.md` — output del audit

**Modify:**
- `src/app/components/medical/ExportReportModal.tsx:183-199` — header con logo
- `src/app/components/medical/VaccinationCardModal.tsx` — header con logo (similar bloque ~líneas 60-80)

---

### Task 1: Helper `loadLogo` con test

**Files:**
- Create: `src/lib/pdf/loadLogo.ts`
- Test: `src/lib/pdf/loadLogo.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/pdf/loadLogo.test.ts
import { describe, it, expect, vi } from "vitest";
import { loadPessyLogo } from "./loadLogo";

describe("loadPessyLogo", () => {
  it("returns a PNG data URL string", async () => {
    const mockBlob = new Blob(["fake-png-bytes"], { type: "image/png" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    } as any);
    const original = global.FileReader;
    class FR {
      result = "data:image/png;base64,FAKE";
      onloadend: (() => void) | null = null;
      readAsDataURL() { setTimeout(() => this.onloadend?.(), 0); }
    }
    (global as any).FileReader = FR;

    const url = await loadPessyLogo();
    expect(url).toBe("data:image/png;base64,FAKE");

    (global as any).FileReader = original;
  });

  it("throws when fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as any);
    await expect(loadPessyLogo()).rejects.toThrow(/logo/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pdf/loadLogo.test.ts`
Expected: FAIL — `Cannot find module './loadLogo'`

- [ ] **Step 3: Implement helper**

```typescript
// src/lib/pdf/loadLogo.ts
let cached: string | null = null;

export async function loadPessyLogo(path = "/pessy-logo.png"): Promise<string> {
  if (cached) return cached;
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load Pessy logo (${res.status})`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      cached = reader.result as string;
      resolve(cached);
    };
    reader.onerror = () => reject(new Error("FileReader failed reading logo"));
    reader.readAsDataURL(blob);
  });
}

export function __resetLogoCacheForTests() { cached = null; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pdf/loadLogo.test.ts`
Expected: PASS (2/2)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/loadLogo.ts src/lib/pdf/loadLogo.test.ts
git commit -m "feat(pdf): loadPessyLogo helper for embedding brand logo in jsPDF"
```

---

### Task 2: Embed logo en ExportReportModal

**Files:**
- Modify: `src/app/components/medical/ExportReportModal.tsx:183-199`

- [ ] **Step 1: Import helper at top of file**

Add after existing imports:
```typescript
import { loadPessyLogo } from "../../../lib/pdf/loadLogo";
```

- [ ] **Step 2: Load logo before generating PDF**

In `handleGenerate` (or whatever async fn calls `new jsPDF`), before the header block:
```typescript
let logoDataUrl: string | null = null;
try { logoDataUrl = await loadPessyLogo(); } catch { /* fallback to text-only */ }
```

- [ ] **Step 3: Replace text-only header (lines 183-189) with logo + text**

Replace:
```typescript
      // ── HEADER ────────────────────────────────────────────────────────────
      pdf.setFillColor(13, 148, 136);
      pdf.rect(0, 0, PW, 28, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("PESSY", M, 17);
```

With:
```typescript
      // ── HEADER ────────────────────────────────────────────────────────────
      pdf.setFillColor(7, 71, 56); // #074738 (Plano primary)
      pdf.rect(0, 0, PW, 28, "F");
      if (logoDataUrl) {
        pdf.addImage(logoDataUrl, "PNG", M, 6, 16, 16);
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text("PESSY", M + 20, 17);
      } else {
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");
        pdf.text("PESSY", M, 17);
      }
```

- [ ] **Step 4: Run build to verify no TS errors**

Run: `npm run build`
Expected: SUCCESS, no errors related to ExportReportModal.

- [ ] **Step 5: Manual smoke test**

Open the app at staging (`pessy-qa-app.web.app/inicio`), generate a PDF, open the file and verify the logo appears top-left of the green header band, "PESSY" text to its right.

- [ ] **Step 6: Commit**

```bash
git add src/app/components/medical/ExportReportModal.tsx
git commit -m "feat(pdf): embed Pessy logo in ExportReportModal header"
```

---

### Task 3: Embed logo en VaccinationCardModal

**Files:**
- Modify: `src/app/components/medical/VaccinationCardModal.tsx` (header block, find `pdf.text(\"PESSY\"` or first `pdf.setFillColor` of header)

- [ ] **Step 1: Locate header block**

Run: `grep -n "PESSY\|setFillColor" src/app/components/medical/VaccinationCardModal.tsx | head -20`
Identify the header rect + text block.

- [ ] **Step 2: Add import**

```typescript
import { loadPessyLogo } from "../../../lib/pdf/loadLogo";
```

- [ ] **Step 3: Load logo before PDF generation**

```typescript
let logoDataUrl: string | null = null;
try { logoDataUrl = await loadPessyLogo(); } catch { /* fallback */ }
```

- [ ] **Step 4: Replace header text-only with logo+text using same pattern as Task 2**

Mirror the conditional block from Task 2 Step 3 — `pdf.addImage(logoDataUrl, "PNG", margin, 6, 16, 16)` plus offset text.

- [ ] **Step 5: Build + manual smoke test**

Run: `npm run build` (expect SUCCESS).
Generate the vaccination card PDF on staging, verify logo appears.

- [ ] **Step 6: Commit**

```bash
git add src/app/components/medical/VaccinationCardModal.tsx
git commit -m "feat(pdf): embed Pessy logo in VaccinationCardModal header"
```

---

### Task 4: Audit script — extracción real → PDF

**Files:**
- Create: `scripts/audit-extraction.ts`
- Create: `docs/audits/2026-04-25-extraction-audit.md`

- [ ] **Step 1: Write the script**

```typescript
// scripts/audit-extraction.ts
// Run with: npx ts-node --transpile-only scripts/audit-extraction.ts <petId>
import * as admin from "firebase-admin";
import * as fs from "fs";

const SA = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ?? "./service-account.json";
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();

const REQUIRED_FIELDS = [
  "veterinarian_name",
  "veterinarian_license",
  "clinic_name",
  "event_date",
  "event_type",
  "diagnosis",
  "medications",
  "vaccines",
];

async function main() {
  const petId = process.argv[2];
  if (!petId) { console.error("Usage: audit-extraction <petId>"); process.exit(1); }
  const snap = await db
    .collection("medical_events")
    .where("petId", "==", petId)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  const lines: string[] = [];
  lines.push(`# Extraction Audit — pet ${petId}`);
  lines.push(`Generated: ${new Date().toISOString()}\n`);
  lines.push(`Sample size: ${snap.size} events\n`);

  let totals: Record<string, number> = {};
  REQUIRED_FIELDS.forEach(f => totals[f] = 0);

  for (const doc of snap.docs) {
    const data = doc.data();
    const docInfo = data?.extractedData?.masterPayload?.document_info ?? {};
    lines.push(`\n## Event \`${doc.id}\``);
    lines.push(`- workflowStatus: \`${data.workflowStatus ?? "—"}\``);
    lines.push(`- requiresManualConfirmation: \`${!!data.requiresManualConfirmation}\``);
    lines.push("- Field coverage:");
    for (const f of REQUIRED_FIELDS) {
      const v = (docInfo as any)[f];
      const present = v !== undefined && v !== null && v !== "";
      if (present) totals[f]++;
      lines.push(`  - \`${f}\`: ${present ? "✅" : "❌"} ${present ? `\`${JSON.stringify(v).slice(0, 60)}\`` : ""}`);
    }
  }

  lines.push(`\n## Coverage summary (${snap.size} events)`);
  for (const f of REQUIRED_FIELDS) {
    const pct = snap.size === 0 ? 0 : Math.round((totals[f] / snap.size) * 100);
    lines.push(`- \`${f}\`: ${totals[f]}/${snap.size} (${pct}%)`);
  }

  fs.writeFileSync("docs/audits/2026-04-25-extraction-audit.md", lines.join("\n"));
  console.log("Wrote docs/audits/2026-04-25-extraction-audit.md");
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run audit against real pet**

User must provide:
- `GOOGLE_APPLICATION_CREDENTIALS` path to service account JSON for `polar-scene-488615-i0`
- A real `petId` from Firestore (e.g., from Mauricio's profile)

Run: `npx ts-node --transpile-only scripts/audit-extraction.ts <petId>`
Expected: file `docs/audits/2026-04-25-extraction-audit.md` created with per-field coverage.

- [ ] **Step 3: Read the audit and identify gaps**

Open `docs/audits/2026-04-25-extraction-audit.md`. For each field <80% coverage, note in a "Gaps" section at the bottom of the file:
- Which Gemini prompt produces it (search `functions/src/gmail/ingestion/clinicalAi.ts` for `veterinarian_name` etc.)
- Whether the gap is upstream (Gemini didn't extract) or downstream (PDF doesn't render)

- [ ] **Step 4: Commit**

```bash
git add scripts/audit-extraction.ts docs/audits/2026-04-25-extraction-audit.md
git commit -m "chore(audit): extraction coverage report — Gemini → PDF pipeline"
```

---

### Task 5: Reporte de gaps + propuesta follow-up

**Files:**
- Modify: `docs/audits/2026-04-25-extraction-audit.md` (append section)

- [ ] **Step 1: Add a "Recommendations" section**

Based on the gaps found in Task 4 Step 3, append:

```markdown
## Recommendations

For each field with <80% coverage:

### `<field_name>` (NN%)
- **Root cause:** [upstream Gemini prompt / downstream PDF render / missing in masterPayload schema]
- **Fix proposal:** [add to prompt schema / surface in PDF / re-process events with new prompt]
- **Effort:** [S/M/L]
- **Priority:** [P0/P1/P2]
```

Plus a final summary table:

```markdown
## Action items

| # | Field | Root cause | Fix | Priority |
|---|-------|-----------|-----|----------|
| 1 | ... | ... | ... | ... |
```

- [ ] **Step 2: Commit**

```bash
git add docs/audits/2026-04-25-extraction-audit.md
git commit -m "docs(audit): extraction gaps and follow-up recommendations"
```

---

## Self-Review

**Spec coverage:**
- (1) Logo en PDF: Tasks 1-3 ✅ (helper + ExportReport + VaccinationCard)
- (2) Auditoría OCR/extracción: Tasks 4-5 ✅ (script real + reporte de gaps)

**Placeholders:** None — every step has the actual code or exact command.

**Type consistency:** `loadPessyLogo` signature consistent across Tasks 1-3. `REQUIRED_FIELDS` array reused only inside the audit script. `logoDataUrl: string | null` consistent.

**Risks/notes:**
- Task 4 requires the user to provide a service-account JSON and a real petId. Cannot run autonomously.
- Logo aspect ratio: `pessy-logo.png` is square enough for 16×16mm. If it looks stretched, adjust w/h proportionally.
- Cache strategy in `loadPessyLogo` is module-level — fine for SPA lifetime, no SSR concerns here.
