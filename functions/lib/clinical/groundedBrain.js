"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pessyClinicalBrainGrounding = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const vertexai_1 = require("@google-cloud/vertexai");
const DEFAULT_LOCATION = "us-central1";
const DEFAULT_MODEL = "gemini-2.0-flash-001";
const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";
const DEFAULT_DATASTORE_ID = "pessy-vet-kb";
const MAX_DOCUMENT_CHARS = 140000;
const MAX_CONTEXT_CHARS = 12000;
const BRAIN_SCHEMA_VERSION = "brain_payload_v2";
const ALLOWED_CATEGORIES = new Set(["Medication", "Vaccine", "Diagnostic", "ClinicalEvent"]);
const ALLOWED_DOCUMENT_TYPES = new Set([
    "blood_panel",
    "biochemistry_panel",
    "urinalysis",
    "dermatology_microscopy",
    "cytology",
    "radiology_report",
    "general_clinical_report",
]);
const QUALITATIVE_DOCUMENT_TYPES = new Set(["dermatology_microscopy", "cytology", "radiology_report"]);
const OUT_OF_RANGE_HINT_REGEX = /\b(fuera de rango|out of range|alterad[oa]s?|anormal(?:es)?|high|low)\b/i;
const NUMERIC_SIGNAL_REGEX = /\d+(?:[.,]\d+)?\s*(?:mg\/dl|g\/dl|mmol\/l|iu\/l|u\/l|%|x10|\/µl|\/ul|kg|g|ml)\b/i;
function asRecord(value) {
    if (!value || typeof value !== "object")
        return {};
    return value;
}
function asString(value) {
    return typeof value === "string" ? value.trim() : "";
}
function asNullableString(value) {
    const normalized = asString(value);
    return normalized || null;
}
function asBoolean(value, fallback = false) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true" || normalized === "1")
            return true;
        if (normalized === "false" || normalized === "0")
            return false;
    }
    return fallback;
}
function asNumber(value, fallback = 0) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function asNullableNumber(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    const raw = asString(value).replace(",", ".");
    if (!raw)
        return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}
function pickAllowed(value, allowed, fallback) {
    return allowed.has(value) ? value : fallback;
}
function hasNumericSignal(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return true;
    const text = asString(value);
    if (!text)
        return false;
    return NUMERIC_SIGNAL_REGEX.test(text) || /\b\d+(?:[.,]\d+)?\b/.test(text);
}
function normalizeEntity(raw) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const row = asRecord(raw);
    const value = asNullableString((_b = (_a = row.value) !== null && _a !== void 0 ? _a : row.result) !== null && _b !== void 0 ? _b : row.observation);
    const status = asNullableString((_c = row.status) !== null && _c !== void 0 ? _c : row.interpretation);
    return {
        type: asString(row.type) || "observation",
        label: asNullableString((_d = row.label) !== null && _d !== void 0 ? _d : row.name),
        value,
        unit: asNullableString(row.unit),
        numeric_value: asNullableNumber((_e = row.numeric_value) !== null && _e !== void 0 ? _e : row.numericValue),
        reference_range: asNullableString((_g = (_f = row.reference_range) !== null && _f !== void 0 ? _f : row.referenceRange) !== null && _g !== void 0 ? _g : row.ref),
        status,
        observation: asNullableString(row.observation),
        evidence_excerpt: asNullableString((_j = (_h = row.evidence_excerpt) !== null && _h !== void 0 ? _h : row.evidence) !== null && _j !== void 0 ? _j : row.source_excerpt),
    };
}
function hasNoObservedPathogenFinding(payloadText) {
    return /\bno se observaron\b/i.test(payloadText) && /\b(dermatofitos|ectopar[aá]sitos|parasitos)\b/i.test(payloadText);
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function extractCandidateText(response) {
    const candidates = Array.isArray(response.candidates)
        ? response.candidates
        : [];
    const firstCandidate = asRecord(candidates[0]);
    const content = asRecord(firstCandidate.content);
    const parts = Array.isArray(content.parts) ? content.parts : [];
    return parts
        .map((part) => asString(part.text))
        .filter(Boolean)
        .join("\n")
        .trim();
}
function tryParseJson(raw) {
    const cleaned = raw
        .replace(/^```json/i, "")
        .replace(/^```/i, "")
        .replace(/```$/i, "")
        .trim();
    if (!cleaned)
        return null;
    try {
        return JSON.parse(cleaned);
    }
    catch (_a) {
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace < 0 || lastBrace <= firstBrace)
            return null;
        const maybeJson = cleaned.slice(firstBrace, lastBrace + 1);
        try {
            return JSON.parse(maybeJson);
        }
        catch (_b) {
            return null;
        }
    }
}
function normalizeBrainPayload(input) {
    const entitiesRaw = Array.isArray(input.entities) ? input.entities : [];
    const entities = entitiesRaw.map((row) => normalizeEntity(row)).filter((row) => Boolean(row.type || row.value || row.observation));
    const rawConfidence = asNumber(input.confidence, 0);
    const normalizedConfidence = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence;
    const normalizedCategory = pickAllowed(asString(input.category), ALLOWED_CATEGORIES, "ClinicalEvent");
    const normalizedDocumentType = pickAllowed(asString(input.document_type || input.study_type), ALLOWED_DOCUMENT_TYPES, "general_clinical_report");
    const qualitativeStudy = QUALITATIVE_DOCUMENT_TYPES.has(normalizedDocumentType);
    const numericSignalDetected = entities.some((row) => row.numeric_value !== null || hasNumericSignal(row.value) || hasNumericSignal(row.reference_range));
    let blockedOutOfRangeInference = false;
    if (qualitativeStudy && !numericSignalDetected) {
        for (const row of entities) {
            const statusText = asString(row.status);
            const rangeText = asString(row.reference_range);
            if (OUT_OF_RANGE_HINT_REGEX.test(statusText) || OUT_OF_RANGE_HINT_REGEX.test(rangeText)) {
                row.status = "observational";
                row.reference_range = null;
                blockedOutOfRangeInference = true;
            }
        }
    }
    const stitchedEvidence = [
        asString(input.primary_finding),
        ...entities.map((row) => asString(row.value)),
        ...entities.map((row) => asString(row.observation)),
    ]
        .filter(Boolean)
        .join(" ");
    const derivedPrimaryFinding = hasNoObservedPathogenFinding(stitchedEvidence)
        ? "No se observaron estructuras compatibles con dermatofitos ni ectoparásitos."
        : "";
    const output = {
        schema_version: BRAIN_SCHEMA_VERSION,
        pet_reference: asString(input.pet_reference) || null,
        category: normalizedCategory,
        document_type: normalizedDocumentType,
        study_type: asString(input.study_type) || null,
        primary_finding: asString(input.primary_finding) || derivedPrimaryFinding || null,
        entities,
        confidence: clamp(normalizedConfidence, 0, 1),
        review_required: asBoolean(input.review_required, false),
        reason_if_review_needed: asString(input.reason_if_review_needed) || null,
        semantic_flags: {
            qualitative_study: qualitativeStudy,
            numeric_signal_detected: numericSignalDetected,
            blocked_out_of_range_inference: blockedOutOfRangeInference,
        },
        ui_hint: asRecord(input.ui_hint),
    };
    if (output.entities.length === 0 && !output.primary_finding) {
        output.review_required = true;
        output.reason_if_review_needed = output.reason_if_review_needed || "empty_entities_from_brain";
    }
    if (qualitativeStudy && !numericSignalDetected && blockedOutOfRangeInference) {
        output.reason_if_review_needed =
            output.reason_if_review_needed || "qualitative_study_blocked_out_of_range_inference";
    }
    return output;
}
// ─── Normalización de texto crudo antes del prompt ──────────────────────────
function normalizeDocumentText(raw) {
    return raw
        // Colapsar whitespace excesivo preservando saltos de párrafo
        .replace(/[ \t]{3,}/g, "  ")
        .replace(/\n{4,}/g, "\n\n\n")
        // Eliminar caracteres de control y ruido OCR típico (caracteres no-ASCII aislados)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        // Colapsar guiones OCR repetidos (artefacto de PDFs escaneados)
        .replace(/-{4,}/g, "---")
        // Normalizar comillas y tildes OCR
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        .trim();
}
function selectMostProbablePets(args) {
    if (args.pets.length === 0)
        return { primary: null, secondary: null };
    if (args.pets.length === 1)
        return { primary: args.pets[0], secondary: null };
    const searchText = [
        args.subjectHint || "",
        asString(args.documentMetadata.subject),
        asString(args.documentMetadata.from_email),
        args.documentText.slice(0, 3000),
    ]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const scored = args.pets.map((pet) => {
        const normalizedName = pet.name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
        // Bonus por aparición directa del nombre
        const nameHits = (searchText.match(new RegExp(`\\b${normalizedName}\\b`, "g")) || []).length;
        // Bonus por especie o raza mencionada
        const speciesHit = pet.species
            ? searchText.includes(pet.species.toLowerCase()) ? 1 : 0
            : 0;
        return { pet, score: nameHits * 10 + speciesHit };
    });
    scored.sort((a, b) => b.score - a.score);
    return {
        primary: scored[0].pet,
        secondary: scored.length > 1 && scored[1].score > 0 ? scored[1].pet : null,
    };
}
// ─── Contexto clínico por tipo de documento ──────────────────────────────────
const DOCUMENT_TYPE_FIELD_HINTS = {
    blood_panel: "Extraer eritrocitos, leucocitos, plaquetas, hemoglobina, hematocrito, diferencial leucocitario. " +
        "Respetar rangos de referencia por especie. Marcar status: normal/alto/bajo SOLO con rango numérico explícito.",
    biochemistry_panel: "Extraer ALT, AST, ALP/ALKP, GGT, BUN, creatinina, glucosa, proteínas totales, albúmina, bilirrubinas, electrolitos. " +
        "NUNCA inferir falla orgánica; solo describir valores y rangos.",
    urinalysis: "Extraer densidad urinaria, pH, proteínas, glucosa, cetonas, bilirrubina, sedimento (cilindros, células, cristales, bacterias). " +
        "Es estudio cualitativo-cuantitativo; no proyectar diagnóstico.",
    dermatology_microscopy: "Estudio cualitativo. Agrupar KOH + tricograma en un único evento. " +
        "Si dice 'no se observaron dermatofitos/ectoparásitos', promover como primary_finding. " +
        "NUNCA marcar status 'alterado' sin hallazgo positivo explícito.",
    cytology: "Estudio cualitativo. Extraer tipo de muestra, hallazgos celulares, presencia/ausencia de agentes. " +
        "No inferir malignidad sin descripción morfológica.",
    radiology_report: "Estudio cualitativo-descriptivo. Extraer hallazgos por región anatómica. " +
        "Distinguir hallazgos principales de incidentales. No proyectar diagnóstico definitivo.",
    general_clinical_report: "Documento clínico general. Extraer: motivo de consulta, diagnóstico/presuntivo, medicaciones indicadas, " +
        "indicaciones de seguimiento, fechas relevantes.",
};
// ─── Prompt XML estructurado ─────────────────────────────────────────────────
function buildGroundingPrompt(args) {
    const rawPets = Array.isArray(asRecord(args.knownContext).pets)
        ? asRecord(args.knownContext).pets
        : [];
    const recentEvents = JSON.stringify(asRecord(args.knownContext).recent_events_summary || []).slice(0, MAX_CONTEXT_CHARS);
    const subjectHint = asString(args.documentMetadata.subject);
    const senderHint = asString(args.documentMetadata.from_email || args.documentMetadata.sender);
    const dateHint = asString(args.documentMetadata.date || args.documentMetadata.email_date);
    // Selección inteligente: máximo 2 mascotas, priorizando la más probable
    const { primary: primaryPet, secondary: secondaryPet } = selectMostProbablePets({
        pets: rawPets,
        documentText: args.documentText,
        documentMetadata: args.documentMetadata,
        subjectHint,
    });
    // Construir bloque de mascota principal
    const primaryPetBlock = primaryPet
        ? JSON.stringify({
            id: primaryPet.id,
            name: primaryPet.name,
            species: primaryPet.species || null,
            breed: primaryPet.breed || null,
            birth_date: primaryPet.birth_date || null,
            weight_kg: primaryPet.weight_kg || null,
            chronic_conditions: primaryPet.chronic_conditions || [],
        })
        : "null";
    const secondaryPetBlock = secondaryPet
        ? JSON.stringify({ id: secondaryPet.id, name: secondaryPet.name, species: secondaryPet.species || null })
        : "null";
    // Normalizar texto del documento
    const cleanDocumentText = normalizeDocumentText(args.documentText).slice(0, MAX_DOCUMENT_CHARS);
    return `<ROL>
Sos un especialista en extracción clínica veterinaria para Pessy.
Tu único objetivo es convertir el documento clínico en un JSON estructurado exacto.
No sos un asistente conversacional: respondés SOLO el JSON, sin markdown, sin texto extra.
</ROL>

<REGLAS_ABSOLUTAS>
1. No inventar datos. Si falta evidencia → null.
2. Ignorar marketing, facturas, publicidad → review_required=true + reason.
3. Dosis/frecuencia potencialmente riesgosa para especie/peso → review_required=true.
4. NUNCA marcar status "fuera de rango / alterado / high / low" sin valor numérico Y rango de referencia explícitos en el documento.
5. En estudios cualitativos (dermatology_microscopy, cytology, radiology_report): status siempre "observational", reference_range siempre null.
6. primary_finding: si el documento dice "no se observaron dermatofitos/ectoparásitos", promoverlo como primary_finding textualmente.
7. pet_reference: usar el nombre EXACTO de la mascota del contexto (no inventar variantes).
8. Responder SOLO JSON válido. Sin backticks, sin comentarios, sin texto previo ni posterior.
</REGLAS_ABSOLUTAS>

<MASCOTA_PRINCIPAL>
${primaryPetBlock}
</MASCOTA_PRINCIPAL>

<MASCOTA_SECUNDARIA_SI_AMBIGUO>
${secondaryPetBlock}
</MASCOTA_SECUNDARIA_SI_AMBIGUO>

<METADATA_DOCUMENTO>
{
  "subject": ${JSON.stringify(subjectHint || null)},
  "sender": ${JSON.stringify(senderHint || null)},
  "date": ${JSON.stringify(dateHint || null)}
}
</METADATA_DOCUMENTO>

<HISTORIAL_RECIENTE_MASCOTA>
${recentEvents}
</HISTORIAL_RECIENTE_MASCOTA>

<INSTRUCCIONES_POR_TIPO_DE_DOCUMENTO>
Primero clasificá el document_type. Valores válidos:
  blood_panel | biochemistry_panel | urinalysis | dermatology_microscopy | cytology | radiology_report | general_clinical_report

Guías por tipo:
- blood_panel: ${DOCUMENT_TYPE_FIELD_HINTS.blood_panel}
- biochemistry_panel: ${DOCUMENT_TYPE_FIELD_HINTS.biochemistry_panel}
- urinalysis: ${DOCUMENT_TYPE_FIELD_HINTS.urinalysis}
- dermatology_microscopy: ${DOCUMENT_TYPE_FIELD_HINTS.dermatology_microscopy}
- cytology: ${DOCUMENT_TYPE_FIELD_HINTS.cytology}
- radiology_report: ${DOCUMENT_TYPE_FIELD_HINTS.radiology_report}
- general_clinical_report: ${DOCUMENT_TYPE_FIELD_HINTS.general_clinical_report}
</INSTRUCCIONES_POR_TIPO_DE_DOCUMENTO>

<ESQUEMA_DE_RESPUESTA>
{
  "schema_version": "brain_payload_v2",
  "pet_reference": "string|null — nombre exacto del contexto",
  "category": "Medication|Vaccine|Diagnostic|ClinicalEvent",
  "document_type": "blood_panel|biochemistry_panel|urinalysis|dermatology_microscopy|cytology|radiology_report|general_clinical_report",
  "study_type": "string|null — subtipo libre si aplica",
  "primary_finding": "string|null — hallazgo principal en 1 oración",
  "entities": [
    {
      "type": "string — lab_value|medication|vaccine|diagnosis|imaging_finding|recommendation|observation",
      "label": "string|null — nombre del analito, medicamento, etc.",
      "value": "string|null — valor o descripción",
      "unit": "string|null",
      "numeric_value": "number|null — solo si es numérico",
      "reference_range": "string|null — rango del laboratorio, null en cualitativos",
      "status": "string|null — normal|alto|bajo|observational — SOLO con evidencia explícita",
      "observation": "string|null — descripción cualitativa si no hay valor numérico",
      "evidence_excerpt": "string|null — cita textual del documento que sustenta (<30 palabras)"
    }
  ],
  "confidence": "number 0.0..1.0",
  "review_required": "boolean",
  "reason_if_review_needed": "string|null",
  "semantic_flags": {
    "qualitative_study": "boolean",
    "numeric_signal_detected": "boolean",
    "blocked_out_of_range_inference": "boolean"
  },
  "ui_hint": {
    "evidence_excerpt": "string|null — fragmento más representativo del documento"
  }
}
</ESQUEMA_DE_RESPUESTA>

<DOCUMENTO_A_PROCESAR>
${cleanDocumentText}
</DOCUMENTO_A_PROCESAR>`;
}
function buildDefaultDatastorePath(project) {
    return `projects/${project}/locations/global/collections/default_collection/dataStores/${DEFAULT_DATASTORE_ID}`;
}
async function resolveConfiguredDatastorePath(project) {
    try {
        const snap = await admin.firestore().collection("system_config").doc("grounding").get();
        if (snap.exists) {
            const data = asRecord(snap.data());
            const configuredPath = asString(data.datastore_path);
            if (configuredPath)
                return configuredPath;
            const configuredId = asString(data.datastore_id);
            if (configuredId) {
                return `projects/${project}/locations/global/collections/default_collection/dataStores/${configuredId}`;
            }
        }
    }
    catch (_a) {
        // Ignore config read failures and use deterministic fallback path.
    }
    return buildDefaultDatastorePath(project);
}
function buildTools(args) {
    const tools = [];
    if (args.datastorePath) {
        tools.push({
            retrieval: {
                vertexAiSearch: {
                    datastore: args.datastorePath,
                },
            },
        });
    }
    if (args.enableGoogleSearch) {
        tools.push({
            googleSearch: {},
        });
    }
    return tools;
}
async function callGeminiApiFallback(args) {
    const apiKey = asString(process.env.GEMINI_API_KEY);
    if (!apiKey) {
        throw new Error("gemini_api_key_missing_for_fallback");
    }
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [
                {
                    parts: [{ text: args.prompt }],
                },
            ],
            generationConfig: {
                temperature: args.temperature,
                topP: 1,
                topK: 1,
                maxOutputTokens: args.maxOutputTokens,
                responseMimeType: "application/json",
            },
        }),
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`gemini_api_fallback_failed_${response.status}:${body.slice(0, 600)}`);
    }
    return (await response.json());
}
exports.pessyClinicalBrainGrounding = functions
    .runWith({
    timeoutSeconds: 180,
    memory: "1GB",
    secrets: ["GMAIL_FORCE_SYNC_KEY", "GEMINI_API_KEY"],
})
    .region("us-central1")
    .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "method_not_allowed" });
        return;
    }
    const configuredKey = asString(process.env.GMAIL_FORCE_SYNC_KEY);
    const incomingHeader = asString(req.headers["x-force-sync-key"]) ||
        asString(req.headers["x-brain-key"]) ||
        asString(req.headers.authorization).replace(/^Bearer\s+/i, "");
    if (!configuredKey || !incomingHeader || incomingHeader !== configuredKey) {
        res.status(401).json({ ok: false, error: "unauthorized" });
        return;
    }
    const body = asRecord(req.body);
    const documentText = asString(body.document_text || body.documentText);
    if (!documentText) {
        res.status(400).json({ ok: false, error: "missing_document_text" });
        return;
    }
    const knownContext = asRecord(body.known_context || body.knownContext);
    const documentMetadata = asRecord(body.document_metadata || body.documentMetadata);
    const project = asString(body.project) ||
        asString(process.env.GCLOUD_PROJECT) ||
        asString(process.env.GOOGLE_CLOUD_PROJECT);
    if (!project) {
        res.status(500).json({ ok: false, error: "missing_project_id" });
        return;
    }
    const location = asString(body.location) || DEFAULT_LOCATION;
    const modelName = asString(body.model) || DEFAULT_MODEL;
    const requestedDatastore = asString(body.datastore || process.env.PESSY_VERTEX_DATASTORE);
    const datastorePath = requestedDatastore || (await resolveConfiguredDatastorePath(project));
    const enableGoogleSearch = asBoolean(body.enable_google_search, false);
    const maxOutputTokens = clamp(asNumber(body.max_output_tokens, 1800), 256, 4096);
    const temperature = clamp(asNumber(body.temperature, 0.2), 0, 1);
    const prompt = buildGroundingPrompt({
        documentText,
        documentMetadata,
        knownContext,
    });
    const tools = buildTools({
        datastorePath,
        enableGoogleSearch,
    });
    const vertex = new vertexai_1.VertexAI({ project, location });
    const model = vertex.getGenerativeModel({ model: modelName });
    const generationConfig = {
        temperature,
        topP: 1,
        topK: 1,
        maxOutputTokens: maxOutputTokens,
    };
    if (tools.length === 0) {
        generationConfig.responseMimeType = "application/json";
    }
    const requestPayload = {
        contents: [
            {
                role: "user",
                parts: [{ text: prompt }],
            },
        ],
        generationConfig: generationConfig,
    };
    if (tools.length > 0)
        requestPayload.tools = tools;
    const startedAt = Date.now();
    let responsePayload = {};
    let fallbackUsed = false;
    let fallbackError = "";
    let vertexError = "";
    try {
        const generated = await model.generateContent(requestPayload);
        responsePayload = generated.response;
    }
    catch (error) {
        vertexError = String((error === null || error === void 0 ? void 0 : error.message) || error).slice(0, 1200);
        try {
            fallbackUsed = true;
            const fallbackModel = asString(process.env.ANALYSIS_MODEL) || DEFAULT_GEMINI_FALLBACK_MODEL;
            responsePayload = await callGeminiApiFallback({
                prompt,
                model: fallbackModel,
                temperature,
                maxOutputTokens,
            });
        }
        catch (fallbackErr) {
            fallbackError = String((fallbackErr === null || fallbackErr === void 0 ? void 0 : fallbackErr.message) || fallbackErr).slice(0, 1200);
        }
    }
    if (!responsePayload || Object.keys(responsePayload).length === 0) {
        res.status(500).json({
            ok: false,
            error: "brain_grounding_failed",
            detail: fallbackError || vertexError || "unknown_grounding_error",
        });
        return;
    }
    let rawText = extractCandidateText(responsePayload);
    let parsed = tryParseJson(rawText);
    if (!parsed) {
        try {
            const retry = await model.generateContent(requestPayload);
            responsePayload = retry.response;
            rawText = extractCandidateText(responsePayload);
            parsed = tryParseJson(rawText);
        }
        catch (_a) {
            // Keep original parse failure path below.
        }
    }
    if (!parsed && tools.length > 0 && !enableGoogleSearch) {
        try {
            const recoveryPayload = Object.assign(Object.assign({}, requestPayload), { tools: buildTools({
                    datastorePath,
                    enableGoogleSearch: true,
                }) });
            const retryWithSearch = await model.generateContent(recoveryPayload);
            responsePayload = retryWithSearch.response;
            rawText = extractCandidateText(responsePayload);
            parsed = tryParseJson(rawText);
        }
        catch (_b) {
            // Keep parse failure handling below.
        }
    }
    if (!parsed) {
        res.status(422).json({
            ok: false,
            error: "invalid_brain_json",
            raw_preview: rawText.slice(0, 900),
            fallback_used: fallbackUsed,
            vertex_error: vertexError || null,
        });
        return;
    }
    const normalizedBrainPayload = normalizeBrainPayload(parsed);
    if (fallbackUsed && datastorePath) {
        normalizedBrainPayload.review_required = true;
        normalizedBrainPayload.reason_if_review_needed =
            normalizedBrainPayload.reason_if_review_needed || "grounding_unavailable_vertex_access";
    }
    const candidates = Array.isArray(responsePayload.candidates)
        ? responsePayload.candidates
        : [];
    const firstCandidate = asRecord(candidates[0]);
    const groundingMetadata = asRecord(firstCandidate.groundingMetadata);
    const usageMetadata = asRecord(responsePayload.usageMetadata);
    res.status(200).json({
        ok: true,
        brainPayload: normalizedBrainPayload,
        grounding: {
            model: modelName,
            project,
            location,
            datastore: datastorePath || null,
            google_search_enabled: enableGoogleSearch,
            processing_ms: Date.now() - startedAt,
            usage_metadata: usageMetadata,
            grounding_metadata: groundingMetadata,
            fallback_used: fallbackUsed,
            vertex_error: vertexError || null,
        },
    });
});
//# sourceMappingURL=groundedBrain.js.map