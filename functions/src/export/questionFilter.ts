/**
 * Server-side filter for "suggestedQuestionsForVet".
 *
 * Pessy is not a medical app. Questions surfaced to the tutor must NOT
 * contain disguised treatment recommendations, medication names, or
 * pre-affirmed diagnoses. This module is a defense-in-depth layer on top
 * of the prompt: even if Gemini drifts, these patterns drop the unsafe
 * output and replace it with a generic safe question.
 *
 * Patterns are intentionally conservative — when in doubt, drop.
 */

const GENERIC_SAFE_QUESTION =
  "¿Qué controles recomienda para esta etapa de mi mascota?";

// Curated medication names (extend over time; keep lower-cased).
// Drug-name match is intentional: a question naming a drug is a
// recommendation in disguise.
const MEDICATION_NAMES = [
  "apoquel",
  "cytopoint",
  "atopica",
  "prednisolona",
  "prednisona",
  "dexametasona",
  "metilprednisolona",
  "amoxicilina",
  "cefalexina",
  "doxiciclina",
  "enrofloxacina",
  "metronidazol",
  "tramadol",
  "gabapentina",
  "meloxicam",
  "carprofeno",
  "firocoxib",
  "fluoxetina",
  "ivermectina",
  "selamectina",
  "milbemicina",
  "fluralaner",
  "afoxolaner",
  "sarolaner",
  "furosemida",
  "enalapril",
  "benazepril",
  "pimobendan",
  "espironolactona",
];

// Prescription verbs / dose-change verbs. Word-boundary matched.
const PRESCRIPTION_VERBS_RE =
  /\b(dar|darle|empezar\s+con|comenzar\s+con|administrar|aplicar|inyectar|recetar|medicar|(sub|baj)\w*\s+(la\s+)?dosis|cambiar\s+a|reemplazar\s+por|usar\s+\w+|probar\s+con)\b/i;

// "Como tiene X, ¿…?" — diagnosis affirmed before the question mark.
const HIDDEN_DIAGNOSIS_RE =
  /\b(como\s+tiene|porque\s+(tiene|padece|sufre)|dado\s+que\s+(tiene|padece)|ya\s+que\s+(tiene|padece)|puesto\s+que\s+(tiene|padece))\b[^?]*\?/i;

const MED_NAME_RE = new RegExp(
  `\\b(${MEDICATION_NAMES.join("|")})\\b`,
  "i",
);

export interface FilterResult {
  questions: string[];
  /** Number of questions that were dropped and replaced with a generic. */
  blocked: number;
  /** Reasons for each blocked question (for logging/audit). */
  blockedReasons: Array<{ original: string; reason: string }>;
}

export function filterSuggestedQuestions(input: string[]): FilterResult {
  const out: string[] = [];
  const blockedReasons: Array<{ original: string; reason: string }> = [];

  for (const raw of input) {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      blockedReasons.push({ original: String(raw), reason: "empty" });
      out.push(GENERIC_SAFE_QUESTION);
      continue;
    }
    const reason = classifyUnsafe(raw);
    if (reason) {
      blockedReasons.push({ original: raw, reason });
      out.push(GENERIC_SAFE_QUESTION);
    } else {
      out.push(raw);
    }
  }

  return {
    questions: out,
    blocked: blockedReasons.length,
    blockedReasons,
  };
}

export function classifyUnsafe(question: string): string | null {
  if (MED_NAME_RE.test(question)) return "medication_name";
  if (PRESCRIPTION_VERBS_RE.test(question)) return "prescription_verb";
  if (HIDDEN_DIAGNOSIS_RE.test(question)) return "hidden_diagnosis";
  return null;
}

export const __INTERNAL = {
  GENERIC_SAFE_QUESTION,
  MEDICATION_NAMES,
};
