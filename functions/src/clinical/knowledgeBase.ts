import * as admin from "firebase-admin";

export const PESSY_CLINICAL_KNOWLEDGE_VERSION = "pessy-clinical-kb-v1-2026-03-02";

interface KnowledgeSection {
  id: string;
  title: string;
  priority: number;
  keywords: string[];
  body: string;
}

interface ExternalKnowledgeContext {
  text: string;
  source: string;
}

export interface ClinicalKnowledgeContext {
  version: string;
  sectionIds: string[];
  source: "local" | "local+external" | "local+notebook" | "local+external+notebook";
  contextText: string;
}

const KNOWLEDGE_SECTIONS: KnowledgeSection[] = [
  {
    id: "protocol_guardrails",
    title: "Guardrails clínicos Pessy",
    priority: 100,
    keywords: ["historia", "timeline", "documento", "analisis", "diagnostico", "tratamiento", "turno"],
    body:
      "No inventar datos. Si falta evidencia: null. Priorizar fecha clínica principal. Si es turno: no forzar diagnóstico/hallazgos. " +
      "Mantener trazabilidad de fuente (sender, subject, fileName) y marcar baja confianza cuando haya ambigüedad.",
  },
  {
    id: "immunization_wsava_aaha_2024",
    title: "Inmunización WSAVA/AAHA 2024",
    priority: 95,
    keywords: ["vacuna", "vacunacion", "rabia", "distemper", "parvo", "lepto", "lyme", "bordetella", "feline", "fpv"],
    body:
      "Canino core: CDV, CAV-1/2, CPV-2, Rabies. Felino core: FPV, FCV, FHV-1. " +
      "No-core canino: Leptospira, Borrelia, Bordetella, Influenza, Crotalus según riesgo. " +
      "Puppies: interferencia por MDA; esquema repetido hasta >=16 semanas (hasta 20 semanas en alto riesgo). " +
      "Riesgo de eventos adversos aumenta en <=5kg y múltiples vacunas por visita.",
  },
  {
    id: "orthopedics_ofa",
    title: "Ortopedia OFA/VD",
    priority: 80,
    keywords: ["displasia", "cadera", "elbow", "codo", "ofa", "radiografia", "fcp", "uap", "ocd"],
    body:
      "Displasia de cadera (OFA): normal (excellent/good/fair), borderline, displásica (mild/moderate/severe). " +
      "Certificación definitiva >=24 meses. " +
      "Displasia de codo: score 0-3, considerar FCP/OCD/UAP con proyección mediolateral flexionada extrema.",
  },
  {
    id: "hepatobiliary_acvim_2019_plus_2025",
    title: "Hepatobiliar ACVIM + evidencia felina 2025",
    priority: 85,
    keywords: ["higado", "hepatico", "alt", "alkp", "ggt", "lipidosis", "vesicula", "sludge", "bile", "colangitis"],
    body:
      "Hepatitis crónica canina (ACVIM 2019): ALT sensible para daño hepatocelular; ALKP y GGT para colestasis. " +
      "Felino lipidosis: ALKP muy elevada con GGT relativamente normal. " +
      "GB sludge felino (2025): hallazgo inespecífico; no usar aislado para antibióticos o punción biliar. " +
      "Engrosamiento de pared vesicular es predictor más fuerte de NC/CH.",
  },
  {
    id: "dermatology_aaha_icada",
    title: "Dermatología atópica AAHA/ICADA",
    priority: 78,
    keywords: ["dermatitis", "atopia", "alergia", "prurito", "apoquel", "cytopoint", "ciclosporina", "glucocorticoides"],
    body:
      "Dermatitis atópica: diagnóstico de exclusión (FAD, alergia alimentaria, ectoparásitos). " +
      "Flare agudo: corticoide tópico/oral u oclacitinib. " +
      "Crónico: oclacitinib, ciclosporina, lokivetmab, taper de esteroides; dieta 8 semanas para descarte alimentario; " +
      "considerar inmunoterapia (ASIT/SLIT) con evaluación >=1 año.",
  },
  {
    id: "diagnostics_interpretation",
    title: "Diagnóstico de laboratorio e imagen",
    priority: 82,
    keywords: ["bun", "creatinina", "crea", "alb", "ultrasonido", "ecografia", "holter", "vpc", "cardio"],
    body:
      "Interpretación orientativa: BUN/CREA altos pueden sugerir falla renal/deshidratación/obstrucción; ALT alta daño hepatocelular; ALB baja pérdida renal/hepática/GI. " +
      "Ecografía abdominal: seguir estandarización ACVR/ECVDI. " +
      "Doberman DCM: Holter >300 VPC/24h se considera diagnóstico (ESVC 2021).",
  },
  {
    id: "nutrition_wsava_5th_vital",
    title: "Nutrición WSAVA quinta constante vital",
    priority: 76,
    keywords: ["nutricion", "bcs", "mcs", "rer", "der", "peso", "obesidad", "senior"],
    body:
      "Evaluar BCS/MCS en cada visita. Fórmula base: RER = 30 * kg + 70 (kcal/día). " +
      "Gatos >10 años pueden requerir DER 1.1-1.25 * RER con seguimiento de pérdida de peso. " +
      "Proteína felina madura/senior: ~30-45% base seca (según contexto clínico).",
  },
  {
    id: "oncology_3ps",
    title: "Oncología (3 Ps)",
    priority: 60,
    keywords: ["cancer", "oncologia", "linfoma", "mastocitoma", "mct", "estadiaje"],
    body:
      "Usar marco de estadiaje 3 Ps: prognostic, practical, pertinent. " +
      "Linfoma y MCT son entidades frecuentes; diferenciar control paliativo vs intención curativa según contexto y calidad de vida.",
  },
  {
    id: "feline_life_stages_2021",
    title: "Etapas felinas AAHA/AAFP 2021",
    priority: 90,
    keywords: ["feline", "gato", "senior", "geriatrico", "disha", "qol", "ckd", "hipertension"],
    body:
      "Etapas: kitten (0-1), young adult (1-6), mature (7-10), senior (>10). " +
      "Senior: controles al menos semestrales, con CBC/química/urianálisis + T4/BP/SDMA según edad/estado. " +
      "En mayores, vigilar comorbilidades, dolor crónico, movilidad, cognición (DISHA-AL) y calidad de vida.",
  },
  {
    id: "critical_care_feline_isfm_2022",
    title: "Críticos felinos ISFM 2022",
    priority: 88,
    keywords: ["inapetencia", "anorexia", "refeeding", "sonda", "mirtazapina", "maropitant", "ondansetron"],
    body:
      "Intervenir en inapetencia antes de 3 días o <80% RER por >3 días. " +
      "Antieméticos/apetito según criterio clínico (maropitant, ondansetron, metoclopramida, mirtazapina, capromorelina). " +
      "Riesgo de síndrome de realimentación en desnutrición severa: inicio gradual (~20% RER día 1) y corregir P/K/Mg.",
  },
  {
    id: "vaccine_titers_and_risk_context",
    title: "Títulos y contexto epidemiológico",
    priority: 70,
    keywords: ["titulo", "titer", "c6", "ospa", "ospc", "importacion", "rabies", "guarderia", "boarding"],
    body:
      "Pruebas ELISA pueden confirmar seroconversión (CDV, CPV, CAV, FPV). " +
      "Lyme: C6 detecta exposición natural, no anticuerpos por vacuna. " +
      "Leptospirosis: considerar riesgo en guarderías/boarding/congregación incluso en zonas de baja prevalencia.",
  },
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function scoreSection(section: KnowledgeSection, queryNormalized: string): number {
  if (!queryNormalized.trim()) return section.priority;
  let score = section.priority;
  for (const keyword of section.keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (queryNormalized.includes(normalizedKeyword)) score += 25;
  }
  return score;
}

function pickKnowledgeSections(query: string, maxSections: number): KnowledgeSection[] {
  const queryNormalized = normalizeText(query || "");
  const sorted = [...KNOWLEDGE_SECTIONS].sort(
    (a, b) => scoreSection(b, queryNormalized) - scoreSection(a, queryNormalized)
  );
  const size = Math.max(3, Math.min(maxSections, 10));
  return sorted.slice(0, size);
}

interface NotebookKnowledgeDoc {
  notebook: string;
  title: string;
  body: string;
  keywords: string[];
  priority: number;
}

async function fetchNotebookKnowledge(query: string): Promise<ExternalKnowledgeContext | null> {
  try {
    const db = admin.firestore();
    const queryNormalized = normalizeText(query || "");

    const snapshot = await db
      .collection("notebook_knowledge")
      .where("active", "==", true)
      .orderBy("priority", "desc")
      .limit(20)
      .get();

    if (snapshot.empty) return null;

    const scored = snapshot.docs.map((doc) => {
      const data = doc.data() as NotebookKnowledgeDoc;
      const keywords: string[] = Array.isArray(data.keywords) ? data.keywords : [];
      let score = typeof data.priority === "number" ? data.priority : 50;
      for (const keyword of keywords) {
        if (queryNormalized.includes(normalizeText(keyword))) score += 25;
      }
      return { data, score };
    });

    scored.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
    const topSections = scored.slice(0, 5);

    const text = topSections
      .map((s: { data: NotebookKnowledgeDoc }) => `- [${s.data.notebook}] ${s.data.title}: ${s.data.body}`)
      .join("\n");

    if (!text.trim()) return null;
    return { text: text.trim(), source: "notebook-knowledge-firestore" };
  } catch {
    return null;
  }
}

async function fetchExternalClinicalContext(query: string): Promise<ExternalKnowledgeContext | null> {
  const endpoint = (process.env.PESSY_CLINICAL_KNOWLEDGE_ENDPOINT || "").trim();
  if (!endpoint) return null;

  const token = (process.env.PESSY_CLINICAL_KNOWLEDGE_TOKEN || "").trim();
  const timeoutMs = 2500;
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });

  const requestPromise = (async (): Promise<ExternalKnowledgeContext | null> => {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query: query.slice(0, 4000),
          knowledgeVersion: PESSY_CLINICAL_KNOWLEDGE_VERSION,
          topK: 5,
        }),
      });
      if (!response.ok) return null;

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("application/json")) {
        const payload = (await response.json()) as Record<string, unknown>;
        const text =
          (typeof payload.context === "string" && payload.context) ||
          (typeof payload.text === "string" && payload.text) ||
          "";
        if (!text.trim()) return null;
        const source =
          (typeof payload.source === "string" && payload.source.trim()) ||
          "external-clinical-knowledge";
        return { text: text.trim(), source };
      }

      const text = (await response.text()).trim();
      if (!text) return null;
      return { text, source: "external-clinical-knowledge" };
    } catch {
      return null;
    }
  })();

  return Promise.race([requestPromise, timeoutPromise]);
}

export async function resolveClinicalKnowledgeContext(params: {
  query?: string;
  maxSections?: number;
}): Promise<ClinicalKnowledgeContext> {
  const query = (params.query || "").trim();
  const selected = pickKnowledgeSections(query, params.maxSections ?? 7);

  // Fetch both external sources in parallel for speed
  const [external, notebook] = await Promise.all([
    fetchExternalClinicalContext(query),
    fetchNotebookKnowledge(query),
  ]);

  const localBlock = selected
    .map((section) => `- [${section.id}] ${section.title}: ${section.body}`)
    .join("\n");

  const externalBlock = external?.text
    ? `\n\nCONTEXTO CLÍNICO EXTERNO (${external.source}):\n${external.text.slice(0, 5000)}`
    : "";

  const notebookBlock = notebook?.text
    ? `\n\nCONTEXTO NOTEBOOK KNOWLEDGE (${notebook.source}):\n${notebook.text.slice(0, 5000)}`
    : "";

  const sourceLabel = notebook && external
    ? "local+external+notebook"
    : notebook
      ? "local+notebook"
      : external
        ? "local+external"
        : "local";

  const contextText = [
    "PESSY CLINICAL KNOWLEDGE BASE",
    `version: ${PESSY_CLINICAL_KNOWLEDGE_VERSION}`,
    "Aplicar como marco clínico de referencia. Priorizar evidencia del documento/paciente, no inventar datos.",
    "",
    "KNOWLEDGE SECTIONS:",
    localBlock,
    externalBlock,
    notebookBlock,
  ].join("\n");

  return {
    version: PESSY_CLINICAL_KNOWLEDGE_VERSION,
    sectionIds: selected.map((section) => section.id),
    source: sourceLabel as ClinicalKnowledgeContext["source"],
    contextText,
  };
}
