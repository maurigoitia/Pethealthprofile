/**
 * extractVetsFromArchives — Cloud Function callable que recorre los archivos
 * clínicos de una mascota (medical_events + treatments + appointments) y
 * popula la subcolección `pets/{petId}/extractedVets` con los profesionales
 * detectados, deduplicados por nombre normalizado.
 *
 * Origen del bug:
 * La UI de `VetSearchScreen.tsx` llamaba a `httpsCallable(functions,
 * "extractVetsFromArchives")` pero el callable nunca se había exportado
 * desde `functions/src/`. Resultado: cada vez que un tutor entraba a
 * "Buscar veterinarios", la lista se quedaba vacía y la consola tiraba
 * `internal/not-found`. Este archivo es el backend que la UI esperaba.
 *
 * Reglas de extracción (mismas que las del export source-backed para
 * mantener consistencia con la narrativa del PDF):
 *   - Solo se cuentan eventos con `provenance === "vet_input" |
 *     "tutor_confirmed" | "ai_extraction" | "ai_pending_review"`.
 *     Los `tutor_input` puros no aportan profesionales (es texto libre
 *     del tutor sin respaldo documental).
 *   - Dedup por nombre normalizado (lower, sin "Dr./Dra.", colapsa espacios).
 *   - License y clinic se "completan" con la última información disponible
 *     (last-seen wins) sin sobrescribir cuando ya hay un valor previo y
 *     el nuevo evento no la trae.
 *   - phone/email son best-effort: si aparecen en `extractedData`, en
 *     `notes` libres o en `clinic_address`, se capturan vía regex. Si no
 *     aparecen, quedan en null. Nunca se inventan.
 *
 * Confianza:
 *   - high:   tiene license Y eventCount >= 2
 *   - medium: tiene license O eventCount >= 2
 *   - low:    aparece en un solo evento, sin license
 *
 * Idempotencia: el doc ID se deriva del nombre normalizado (md5 corto),
 * así que correr el callable varias veces no genera duplicados — re-escribe
 * con merge sobre el mismo doc.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

import {
  deriveProvenanceSource,
  bucketForProvenance,
} from "../export/firestoreAdapter";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface ExtractVetsRequest {
  petId: string;
}

export interface ExtractVetsResponse {
  processed: number;
  vetsFound: number;
  newlyAdded: number;
  alreadyExisting: number;
}

interface VetCandidate {
  name: string;
  clinic: string | null;
  license: string | null;
  phone: string | null;
  email: string | null;
  firstSeenAtIso: string | null;
  lastSeenAtIso: string | null;
  eventCount: number;
  sourceEventIds: string[];
  /** "high" | "medium" | "low" — determinado al finalizar la agregación */
  confidence: "high" | "medium" | "low";
}

interface VetAggregatorRow {
  name: string;
  clinic: string | null;
  license: string | null;
  phone: string | null;
  email: string | null;
  firstSeenAtIso: string | null;
  lastSeenAtIso: string | null;
  eventCount: number;
  sourceEventIds: Set<string>;
}

interface SourceRow {
  /** ID del evento — usado en `sourceEventIds` */
  eventId: string;
  /** ISO date — para first/last seen */
  dateIso: string | null;
  /** Categoría de la fuente (ya bucketizada) */
  bucket: "vet_document" | "ai_extraction" | "tutor_input";
  vetName: string | null;
  vetLicense: string | null;
  clinic: string | null;
  /** Texto libre desde el cual extraer phone/email best-effort */
  rawText: string | null;
}

// ─── Helpers puros (testeables sin firestore) ──────────────────────────────

/** Regex para combining diacritical marks (U+0300–U+036F). */
const COMBINING_MARKS = new RegExp("[̀-ͯ]", "g");

/** Normaliza un nombre de profesional para usar como clave de dedup. */
export function normalizeVetName(name: string): string {
  return name
    .normalize("NFD")
    .replace(COMBINING_MARKS, "") // strip diacritics (José → jose)
    .toLowerCase()
    .trim()
    .replace(/^(dr|dra|med|m\.v|mv)\.?\s+/i, "")
    .replace(/\s+/g, " ");
}

/** Sanitiza un nombre normalizado en un Firestore document ID estable. */
export function vetDocId(normalizedName: string): string {
  // md5 hex truncado a 24 chars: estable, idempotente, sin colisiones a esta
  // escala (decenas de vets por pet en el peor caso).
  return crypto.createHash("md5").update(normalizedName).digest("hex").slice(0, 24);
}

/** Extrae primer email válido de un texto. null si no encuentra. */
export function extractEmail(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0].toLowerCase() : null;
}

/**
 * Extrae primer teléfono "razonable" de un texto. null si no encuentra.
 *
 * Acepta formatos AR comunes: +54 9 11 1234-5678, 011-1234-5678,
 * (011) 4567-8900, 11 5555 6666. Valida que tenga al menos 8 dígitos
 * después de remover separadores para evitar falsos positivos sobre
 * matrículas o números de protocolo.
 */
export function extractPhone(text: string | null | undefined): string | null {
  if (!text) return null;
  const candidates = text.match(/(\+?\d[\d\s\-().]{6,20}\d)/g) ?? [];
  for (const c of candidates) {
    const digits = c.replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) {
      return c.trim();
    }
  }
  return null;
}

/** Earliest ISO string (string compare funciona con ISO 8601). */
function earliestIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

/** Latest ISO string. */
function latestIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * Agrega filas crudas en una lista de VetCandidate deduplicada por
 * nombre normalizado.
 *
 * Pure function: no Firestore, no admin SDK. Testeable.
 */
export function aggregateVets(rows: SourceRow[]): VetCandidate[] {
  const map = new Map<string, VetAggregatorRow>();

  for (const row of rows) {
    if (!row.vetName) continue;
    if (row.bucket === "tutor_input") continue; // tutor_input puro no aporta vets

    const key = normalizeVetName(row.vetName);
    if (!key) continue;

    const phone = extractPhone(row.rawText);
    const email = extractEmail(row.rawText);

    const existing = map.get(key);
    if (existing) {
      existing.eventCount += 1;
      existing.sourceEventIds.add(row.eventId);
      // last-seen wins para clinic/license cuando el evento aporta valor
      if (row.vetLicense && !existing.license) existing.license = row.vetLicense;
      if (row.clinic) existing.clinic = row.clinic;
      if (phone && !existing.phone) existing.phone = phone;
      if (email && !existing.email) existing.email = email;
      existing.firstSeenAtIso = earliestIso(existing.firstSeenAtIso, row.dateIso);
      existing.lastSeenAtIso = latestIso(existing.lastSeenAtIso, row.dateIso);
    } else {
      map.set(key, {
        name: row.vetName.trim(),
        clinic: row.clinic ?? null,
        license: row.vetLicense ?? null,
        phone,
        email,
        firstSeenAtIso: row.dateIso,
        lastSeenAtIso: row.dateIso,
        eventCount: 1,
        sourceEventIds: new Set([row.eventId]),
      });
    }
  }

  const out: VetCandidate[] = [];
  for (const v of map.values()) {
    let confidence: VetCandidate["confidence"];
    if (v.license && v.eventCount >= 2) confidence = "high";
    else if (v.license || v.eventCount >= 2) confidence = "medium";
    else confidence = "low";

    out.push({
      name: v.name,
      clinic: v.clinic,
      license: v.license,
      phone: v.phone,
      email: v.email,
      firstSeenAtIso: v.firstSeenAtIso,
      lastSeenAtIso: v.lastSeenAtIso,
      eventCount: v.eventCount,
      sourceEventIds: Array.from(v.sourceEventIds),
      confidence,
    });
  }
  return out;
}

// ─── Mapeo desde Firestore raw → SourceRow ─────────────────────────────────

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Recolecta todo el texto libre de un medical_event que pueda contener
 * teléfono o email del profesional. */
function collectRawText(raw: Record<string, unknown>): string {
  const ed = (raw.extractedData as Record<string, unknown> | undefined) ?? {};
  const mp = (ed.masterPayload as Record<string, unknown> | undefined) ?? {};
  const di = (mp.document_info as Record<string, unknown> | undefined) ??
    (ed.document_info as Record<string, unknown> | undefined) ?? {};

  const parts: Array<string | null | undefined> = [
    asString(raw.notes),
    asString(ed.notes),
    asString(di.notes),
    asString(di.clinic_address),
    asString(ed.clinic_address),
    asString(di.clinic_contact),
    asString(ed.clinic_contact),
    asString(di.veterinarian_contact),
    asString(ed.veterinarian_contact),
    asString(di.contact_info),
    asString(ed.contact_info),
  ];

  return parts.filter((p): p is string => !!p).join(" \n ");
}

/** Mapea un medical_event raw a SourceRow. null si el evento no aporta vet. */
export function medicalEventToSourceRow(
  id: string,
  raw: Record<string, unknown>,
): SourceRow | null {
  const ed = (raw.extractedData as Record<string, unknown> | undefined) ?? {};
  const mp = (ed.masterPayload as Record<string, unknown> | undefined) ?? {};
  const di = (mp.document_info as Record<string, unknown> | undefined) ??
    (ed.document_info as Record<string, unknown> | undefined) ?? {};

  const provenance = deriveProvenanceSource({
    createdBy: raw.createdBy,
    source: raw.source,
    tutorConfirmed: raw.tutorConfirmed,
    userConfirmed: raw.userConfirmed,
    requiresManualConfirmation: raw.requiresManualConfirmation,
    workflowStatus: raw.workflowStatus,
    extractedData: ed as { masterPayload?: unknown } | null,
  });
  const bucket = bucketForProvenance(provenance);

  const vetName =
    asString(di.veterinarian_name) ??
    asString(ed.veterinarian_name) ??
    asString(raw.veterinarian) ??
    null;

  if (!vetName) return null;

  const vetLicense =
    asString(di.veterinarian_license) ??
    asString(ed.veterinarian_license) ??
    null;

  const clinic =
    asString(di.clinic_name) ??
    asString(ed.clinic_name) ??
    null;

  const dateIso =
    asString(ed.eventDate) ??
    asString(raw.createdAt) ??
    asString(raw.date) ??
    null;

  return {
    eventId: id,
    dateIso,
    bucket,
    vetName,
    vetLicense,
    clinic,
    rawText: collectRawText(raw),
  };
}

/** Mapea un appointment raw a SourceRow (cuando trae profesional). */
export function appointmentToSourceRow(
  id: string,
  raw: Record<string, unknown>,
): SourceRow | null {
  const vetName =
    asString(raw.veterinarian) ??
    asString(raw.veterinarian_name) ??
    asString(raw.professional) ??
    null;
  if (!vetName) return null;

  const clinic = asString(raw.clinic) ?? asString(raw.location) ?? null;
  const dateIso =
    asString(raw.date) ??
    asString(raw.scheduledFor) ??
    asString(raw.startDate) ??
    asString(raw.createdAt) ??
    null;

  // Los appointments documentan a un profesional real (el tutor cargó
  // el turno con su nombre). Tratamos como ai_extraction salvo que
  // venga marcado como vet_input explícitamente.
  const bucket: SourceRow["bucket"] =
    raw.source === "vet_input" || raw.createdBy === "vet"
      ? "vet_document"
      : "ai_extraction";

  const rawText = [
    asString(raw.notes),
    asString(raw.contact),
    asString(raw.phone),
    asString(raw.email),
  ]
    .filter((p): p is string => !!p)
    .join(" \n ");

  return {
    eventId: id,
    dateIso,
    bucket,
    vetName,
    vetLicense: null, // appointments no llevan matrícula
    clinic,
    rawText,
  };
}

/** Mapea un treatment raw a SourceRow (cuando trae profesional). */
export function treatmentToSourceRow(
  id: string,
  raw: Record<string, unknown>,
): SourceRow | null {
  const vetName = asString(raw.veterinarian) ?? asString(raw.prescribedBy) ?? null;
  if (!vetName) return null;

  const provenance = deriveProvenanceSource({
    createdBy: raw.createdBy,
    source: raw.source,
    tutorConfirmed: raw.tutorConfirmed,
    userConfirmed: raw.userConfirmed,
    requiresManualConfirmation: raw.requiresManualConfirmation,
    workflowStatus: raw.workflowStatus,
    extractedData: (raw.extractedData as { masterPayload?: unknown } | null) ?? null,
  });
  const bucket = bucketForProvenance(provenance);

  const dateIso =
    asString(raw.startDate) ??
    asString(raw.date) ??
    asString(raw.createdAt) ??
    null;

  return {
    eventId: id,
    dateIso,
    bucket,
    vetName,
    vetLicense: null,
    clinic: asString(raw.clinic) ?? null,
    rawText: asString(raw.notes) ?? "",
  };
}

// ─── Persistencia ──────────────────────────────────────────────────────────

interface UpsertResult {
  newlyAdded: number;
  alreadyExisting: number;
}

async function upsertVets(
  fs: admin.firestore.Firestore,
  petId: string,
  candidates: VetCandidate[],
): Promise<UpsertResult> {
  if (candidates.length === 0) return { newlyAdded: 0, alreadyExisting: 0 };

  const colRef = fs.collection("pets").doc(petId).collection("extractedVets");
  // Pre-leemos los docs existentes para contar newlyAdded vs alreadyExisting.
  // Como N es chico (decenas en el peor caso) hacemos un get() por cada uno.
  // Si esto se vuelve un cuello de botella, conviene listar la colección
  // entera en un solo get y comparar en memoria.
  const writes: Array<Promise<unknown>> = [];
  let newlyAdded = 0;
  let alreadyExisting = 0;

  for (const c of candidates) {
    const docId = vetDocId(normalizeVetName(c.name));
    const docRef = colRef.doc(docId);
    const snap = await docRef.get();

    const firstSeenTs =
      c.firstSeenAtIso && !isNaN(new Date(c.firstSeenAtIso).getTime())
        ? admin.firestore.Timestamp.fromDate(new Date(c.firstSeenAtIso))
        : null;
    const lastSeenTs =
      c.lastSeenAtIso && !isNaN(new Date(c.lastSeenAtIso).getTime())
        ? admin.firestore.Timestamp.fromDate(new Date(c.lastSeenAtIso))
        : null;

    const payload = {
      name: c.name,
      clinic: c.clinic,
      license: c.license,
      phone: c.phone,
      email: c.email,
      firstSeenAt: firstSeenTs,
      lastSeenAt: lastSeenTs,
      eventCount: c.eventCount,
      sourceEventIds: c.sourceEventIds,
      confidence: c.confidence,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (snap.exists) {
      alreadyExisting += 1;
      writes.push(docRef.set(payload, { merge: true }));
    } else {
      newlyAdded += 1;
      writes.push(docRef.set(payload, { merge: true }));
    }
  }

  await Promise.all(writes);
  return { newlyAdded, alreadyExisting };
}

// ─── Callable export ───────────────────────────────────────────────────────

export const extractVetsFromArchives = functions
  .runWith({ timeoutSeconds: 60, memory: "256MB" })
  .region("us-central1")
  .https.onCall(async (data: unknown, context): Promise<ExtractVetsResponse> => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Iniciá sesión para actualizar la lista de veterinarios.",
      );
    }

    const petId =
      data && typeof data === "object" && typeof (data as { petId?: unknown }).petId === "string"
        ? ((data as { petId: string }).petId).trim()
        : "";
    if (!petId) {
      throw new functions.https.HttpsError("invalid-argument", "Falta petId.");
    }

    const fs = admin.firestore();

    // Permission check (igual que pessyExportSourceBacked).
    const petSnap = await fs.doc(`pets/${petId}`).get();
    if (!petSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Mascota no encontrada.");
    }
    const pet = petSnap.data() ?? {};
    const isOwner = pet.ownerId === context.auth.uid;
    const isCoTutor =
      Array.isArray(pet.coTutorUids) && pet.coTutorUids.includes(context.auth.uid);
    if (!isOwner && !isCoTutor) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No tenés acceso a esta mascota.",
      );
    }

    // ── Carga las 3 fuentes en paralelo ─────────────────────────────
    const [meSnap, trSnap, apSnap] = await Promise.all([
      fs
        .collection("medical_events")
        .where("petId", "==", petId)
        .orderBy("createdAt", "desc")
        .limit(500)
        .get()
        .catch((err) => {
          // Si no hay índice, degradamos a un fetch sin orderBy
          console.warn("[extractVetsFromArchives] medical_events orderBy failed, fallback:", err);
          return fs.collection("medical_events").where("petId", "==", petId).limit(500).get();
        }),
      fs.collection("treatments").where("petId", "==", petId).limit(200).get(),
      fs.collection("appointments").where("petId", "==", petId).limit(200).get(),
    ]);

    const rows: SourceRow[] = [];
    for (const d of meSnap.docs) {
      const r = medicalEventToSourceRow(d.id, d.data() ?? {});
      if (r) rows.push(r);
    }
    for (const d of trSnap.docs) {
      const r = treatmentToSourceRow(d.id, d.data() ?? {});
      if (r) rows.push(r);
    }
    for (const d of apSnap.docs) {
      const r = appointmentToSourceRow(d.id, d.data() ?? {});
      if (r) rows.push(r);
    }

    const candidates = aggregateVets(rows);
    const upsertResult = await upsertVets(fs, petId, candidates);

    const processed =
      meSnap.docs.length + trSnap.docs.length + apSnap.docs.length;

    return {
      processed,
      vetsFound: candidates.length,
      newlyAdded: upsertResult.newlyAdded,
      alreadyExisting: upsertResult.alreadyExisting,
    };
  });
