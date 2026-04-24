/**
 * extractVetsFromArchives — callable Cloud Function
 *
 * Recorre todos los `medical_events` de un pet y extrae los veterinarios
 * que aparecen en los documentos (nombre, clínica, matrícula, teléfono,
 * email). Dos paths:
 *   A) Evento con `extractedData.masterPayload.document_info` → usar directo.
 *   B) Evento viejo con `rawText` (fallback) → llamar a Gemini 2.5 Flash
 *      con un prompt dedicado.
 *
 * Dedup por hash(normalize(name)+normalize(clinic)). Upsert en subcolección
 * `pets/{petId}/extractedVets/{hash}`. Idempotente vía `sourceEventIds`.
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as crypto from "crypto";

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface ExtractedVetDoc {
  id: string;
  name: string;
  clinic: string | null;
  license: string | null;
  phone: string | null;
  email: string | null;
  firstSeenAt: admin.firestore.Timestamp;
  lastSeenAt: admin.firestore.Timestamp;
  eventCount: number;
  sourceEventIds: string[];
  confidence: "high" | "medium" | "low";
}

interface VetFields {
  name: string;
  clinic: string | null;
  license: string | null;
  phone: string | null;
  email: string | null;
  confidence: "high" | "medium" | "low";
}

// ─── Gemini backend (copia minimal del patrón en index.ts) ──────────────────

function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY || "";
}

async function callGeminiForVet(rawText: string): Promise<VetFields | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const prompt =
    "Del siguiente documento veterinario, extrae SOLO los datos del profesional " +
    "que emite/firma el documento: nombre del vet (con Dr/Dra si está), clínica, " +
    "matrícula, teléfono, email. Respondé en JSON con esta forma exacta: " +
    `{"name": string|null, "clinic": string|null, "license": string|null, ` +
    `"phone": string|null, "email": string|null}. ` +
    "Si NO podés identificar con certeza un campo, devolvé null. NO inventes. " +
    "NO devuelvas datos de productos, laboratorios ni de otras personas mencionadas.\n\n" +
    "DOCUMENTO:\n" +
    rawText.slice(0, 8000);

  const model = process.env.ANALYSIS_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          topK: 1,
          topP: 1,
          responseMimeType: "application/json",
          maxOutputTokens: 512,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!resp.ok) {
      console.warn("[extractVets] Gemini HTTP error:", resp.status);
      return null;
    }

    const json = (await resp.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) return null;

    const parsed = JSON.parse(text) as Partial<VetFields>;
    if (!parsed || typeof parsed !== "object") return null;

    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    if (!name) return null;

    return {
      name,
      clinic: typeof parsed.clinic === "string" && parsed.clinic.trim() ? parsed.clinic.trim() : null,
      license: typeof parsed.license === "string" && parsed.license.trim() ? parsed.license.trim() : null,
      phone: typeof parsed.phone === "string" && parsed.phone.trim() ? parsed.phone.trim() : null,
      email: typeof parsed.email === "string" && parsed.email.trim() ? parsed.email.trim() : null,
      confidence: "medium", // Gemini fallback → medium
    };
  } catch (err) {
    console.warn("[extractVets] Gemini call failed:", err);
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function normalizeEmail(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  return lower.length > 0 ? lower : null;
}

function normalizeForHash(raw: string | null): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function vetHash(name: string, clinic: string | null): string {
  const key = `${normalizeForHash(name)}|${normalizeForHash(clinic)}`;
  return crypto.createHash("sha1").update(key).digest("hex").slice(0, 24);
}

function extractFromMasterPayload(event: Record<string, unknown>): VetFields | null {
  const extractedData = event.extractedData as Record<string, unknown> | undefined;
  const masterPayload = extractedData?.masterPayload as Record<string, unknown> | undefined;
  const docInfo = masterPayload?.document_info as Record<string, unknown> | undefined;
  if (!docInfo) return null;

  const name = asTrimmedString(docInfo.veterinarian_name);
  if (!name) return null;

  return {
    name,
    clinic: asTrimmedString(docInfo.clinic_name),
    license: asTrimmedString(docInfo.veterinarian_license),
    phone: asTrimmedString(docInfo.phone),
    email: asTrimmedString(docInfo.email),
    confidence: "high", // structured field → high confidence
  };
}

function getRawTextFromEvent(event: Record<string, unknown>): string | null {
  const extractedData = event.extractedData as Record<string, unknown> | undefined;
  if (!extractedData) return null;
  return (
    asTrimmedString(extractedData.rawText) ||
    asTrimmedString(extractedData.raw_text) ||
    asTrimmedString((event as Record<string, unknown>).rawText) ||
    null
  );
}

async function assertPetAccess(petId: string, uid: string): Promise<void> {
  const snap = await admin.firestore().collection("pets").doc(petId).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "Mascota no encontrada.");
  }
  const data = snap.data() as Record<string, unknown>;
  const ownerId = asTrimmedString(data.ownerId);
  const coTutorUids = Array.isArray(data.coTutorUids)
    ? (data.coTutorUids as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  if (ownerId !== uid && !coTutorUids.includes(uid)) {
    throw new functions.https.HttpsError("permission-denied", "No tenés acceso a esta mascota.");
  }
}

// ─── Procesamiento por batches ──────────────────────────────────────────────

async function processBatch(
  events: Array<{ id: string; data: Record<string, unknown> }>,
): Promise<Array<{ eventId: string; vet: VetFields | null }>> {
  return Promise.all(
    events.map(async ({ id, data }) => {
      // Path A: masterPayload structured
      const fromMaster = extractFromMasterPayload(data);
      if (fromMaster) return { eventId: id, vet: fromMaster };

      // Path B: Gemini fallback on rawText
      const rawText = getRawTextFromEvent(data);
      if (!rawText) return { eventId: id, vet: null };

      const fromGemini = await callGeminiForVet(rawText);
      return { eventId: id, vet: fromGemini };
    }),
  );
}

// ─── Main callable ──────────────────────────────────────────────────────────

export const extractVetsFromArchives = functions
  .runWith({ secrets: ["GEMINI_API_KEY"], timeoutSeconds: 540, memory: "1GB" })
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    const uid = context.auth.uid;
    const petId = typeof data?.petId === "string" ? data.petId.trim() : "";
    if (!petId) {
      throw new functions.https.HttpsError("invalid-argument", "petId requerido.");
    }

    await assertPetAccess(petId, uid);

    const firestore = admin.firestore();

    // Traer todos los medical_events del pet
    const eventsSnap = await firestore
      .collection("medical_events")
      .where("petId", "==", petId)
      .get();

    const allEvents = eventsSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
    const processed = allEvents.length;

    // Process en batches paralelos de 5
    const BATCH_SIZE = 5;
    const results: Array<{ eventId: string; vet: VetFields | null }> = [];
    for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
      const batch = allEvents.slice(i, i + BATCH_SIZE);
      const batchResults = await processBatch(batch);
      results.push(...batchResults);
    }

    // Dedup + upsert
    const vetsSubcol = firestore.collection("pets").doc(petId).collection("extractedVets");
    let vetsFound = 0;
    let newlyAdded = 0;
    let alreadyExisting = 0;

    const nowTs = admin.firestore.Timestamp.now();

    // Agrupar por hash para sumar sourceEventIds en memoria antes de escribir
    const byHash = new Map<
      string,
      {
        fields: VetFields;
        sourceEventIds: Set<string>;
      }
    >();

    for (const { eventId, vet } of results) {
      if (!vet) continue;
      vetsFound++;
      const hash = vetHash(vet.name, vet.clinic);
      const existing = byHash.get(hash);
      if (existing) {
        existing.sourceEventIds.add(eventId);
        // merge fields: keep non-null
        existing.fields.clinic = existing.fields.clinic || vet.clinic;
        existing.fields.license = existing.fields.license || vet.license;
        existing.fields.phone = existing.fields.phone || vet.phone;
        existing.fields.email = existing.fields.email || vet.email;
        // confidence: high > medium > low
        if (vet.confidence === "high") existing.fields.confidence = "high";
      } else {
        byHash.set(hash, { fields: { ...vet }, sourceEventIds: new Set([eventId]) });
      }
    }

    // Upsert cada hash
    for (const [hash, { fields, sourceEventIds }] of byHash.entries()) {
      const ref = vetsSubcol.doc(hash);
      const snap = await ref.get();

      const normalizedPhone = normalizePhone(fields.phone);
      const normalizedEmail = normalizeEmail(fields.email);
      const newSources = Array.from(sourceEventIds);

      if (!snap.exists) {
        const docPayload: ExtractedVetDoc = {
          id: hash,
          name: fields.name,
          clinic: fields.clinic,
          license: fields.license,
          phone: normalizedPhone,
          email: normalizedEmail,
          firstSeenAt: nowTs,
          lastSeenAt: nowTs,
          eventCount: newSources.length,
          sourceEventIds: newSources,
          confidence: fields.confidence,
        };
        await ref.set(docPayload);
        newlyAdded++;
      } else {
        const existing = snap.data() as Partial<ExtractedVetDoc>;
        const existingSources = Array.isArray(existing.sourceEventIds) ? existing.sourceEventIds : [];
        const sourcesSet = new Set(existingSources);
        let added = 0;
        for (const s of newSources) {
          if (!sourcesSet.has(s)) {
            sourcesSet.add(s);
            added++;
          }
        }

        // Idempotencia: si todos los sources ya estaban → skip write
        if (added === 0) {
          alreadyExisting++;
          continue;
        }

        await ref.update({
          name: existing.name || fields.name,
          clinic: existing.clinic || fields.clinic,
          license: existing.license || fields.license,
          phone: existing.phone || normalizedPhone,
          email: existing.email || normalizedEmail,
          lastSeenAt: nowTs,
          eventCount: (existing.eventCount || 0) + added,
          sourceEventIds: Array.from(sourcesSet),
          confidence:
            fields.confidence === "high" || existing.confidence === "high"
              ? "high"
              : existing.confidence || fields.confidence,
        });
        alreadyExisting++;
      }
    }

    return {
      processed,
      vetsFound,
      newlyAdded,
      alreadyExisting,
    };
  });
