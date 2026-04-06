/**
 * Human Medical Content Blocker
 *
 * Detects emails with human health insurance and medical content
 * using a weighted signal system. No Firebase calls.
 *
 * Consolidates dispersed human medical detection logic from:
 * - petMatching.ts (isCandidateClinicalEmail, isBlockedClinicalDomain, etc.)
 * - clinicalAi.ts (early filtering)
 *
 * Returns a structured result with:
 * - isHumanMedical: Whether this is human healthcare content
 * - confidence: 0-100 score
 * - signals: All detected signals with weights
 * - shouldSkipAi: Whether to block without expensive AI calls
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface HumanMedicalSignal {
  type: 'domain' | 'keyword' | 'pattern' | 'attachment_name';
  value: string;
  weight: number;  // 0-100, higher = stronger signal
}

export interface HumanMedicalBlockResult {
  isHumanMedical: boolean;
  confidence: number;           // 0-100
  signals: HumanMedicalSignal[];
  blockedReason: string | null;  // human-readable explanation
  shouldSkipAi: boolean;         // true if confidence >= 80 (block without AI)
}

// ── Blocked Domains (weight: 100 each) ───────────────────────────────────────

const HUMAN_BLOCKED_DOMAINS = new Set([
  "huesped.org",
  "huesped.org.ar",
  "osde.com.ar",
  "osdebinario.com.ar",
  "swissmedical.com.ar",
  "medicus.com.ar",
  "galeno.com.ar",
  "omint.com.ar",
  "hospitalitaliano.org.ar",
  "hospitalaleman.com",
  "afip.gob.ar",
  "afip.gov.ar",
  "ioma.gob.ar",
  "pami.org.ar",
  "cuil.gob.ar",
]);

// ── Keywords and Patterns ────────────────────────────────────────────────────

const HUMAN_HEALTH_KEYWORDS = [
  { keyword: "afiliado", weight: 85, singular: "afiliada" },
  { keyword: "número de socio", weight: 90 },
  { keyword: "nro de socio", weight: 90 },
  { keyword: "cobertura médica", weight: 90, singular: "cobertura medica" },
  { keyword: "plan médico", weight: 90, singular: "plan medico" },
  { keyword: "CUIL", weight: 85, context: "afiliación" },
  { keyword: "CUIT", weight: 85, context: "afiliación" },
  { keyword: "prestador", weight: 70, context: "médico" },
  { keyword: "obra social", weight: 80 },
  { keyword: "autorización médica", weight: 85, singular: "autorizacion medica" },
  { keyword: "autorización de práctica", weight: 85 },
  { keyword: "médico de cabecera", weight: 90, singular: "medico de cabecera" },
  { keyword: "guardia médica", weight: 80, singular: "guardia medica" },
];

// ── Veterinary signals that reduce human medical confidence ──────────────────

const VETERINARY_REDUCTION_SIGNALS = [
  { pattern: /\b(veterinaria|veterinario|clínica veterinaria|clínica veterinaria)\b/i, reduction: 25 },
  { pattern: /\b(mascota|canino|canina|felino|felina)\b/i, reduction: 15 },
];

const KNOWN_PET_NAMES = new Set([
  "thor", "max", "luna", "bella", "charlie", "buddy", "daisy", "rocky", "molly", "cooper",
  "lucy", "jack", "bailey", "sadie", "loki", "milo", "rex", "duke", "lady", "honey",
  "shadow", "ginger", "pepper", "bandit", "simba", "nala", "cleo", "whiskers", "mittens",
]);

// ── Helper: Extract domain from email ────────────────────────────────────────

function extractSenderDomain(email: string): string {
  const match = email.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
  return match?.[1] || "";
}

// ── Helper: Normalize text for matching ─────────────────────────────────────

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^\w\s]/g, " ") // Replace non-alphanumeric with space
    .trim();
}

// ── Helper: Check if domain is blocked ───────────────────────────────────────

function checkBlockedDomain(fromEmail: string): HumanMedicalSignal | null {
  const domain = extractSenderDomain(fromEmail);
  if (!domain) return null;

  const domainLower = domain.toLowerCase();
  for (const blockedDomain of HUMAN_BLOCKED_DOMAINS) {
    if (domainLower === blockedDomain || domainLower.endsWith(`.${blockedDomain}`)) {
      return {
        type: "domain",
        value: domain,
        weight: 100,
      };
    }
  }
  return null;
}

// ── Helper: Check for human health keywords in text ──────────────────────────

function checkKeywords(text: string): HumanMedicalSignal[] {
  const signals: HumanMedicalSignal[] = [];
  const normalized = normalizeForMatch(text);
  if (!normalized) return signals;

  for (const entry of HUMAN_HEALTH_KEYWORDS) {
    const keywordNorm = normalizeForMatch(entry.keyword);
    if (normalized.includes(keywordNorm)) {
      signals.push({
        type: "keyword",
        value: entry.keyword,
        weight: entry.weight,
      });
    }

    // Also check singular form if different
    if (entry.singular) {
      const singularNorm = normalizeForMatch(entry.singular);
      if (normalized.includes(singularNorm)) {
        // Avoid duplicate if singular is same as keyword
        if (!signals.some(s => s.value === entry.keyword)) {
          signals.push({
            type: "keyword",
            value: entry.keyword,
            weight: entry.weight,
          });
        }
      }
    }
  }

  return signals;
}

// ── Helper: Check for DNI/CUIL patterns in human medical context ────────────

function checkDniCuilPatterns(text: string): HumanMedicalSignal[] {
  const signals: HumanMedicalSignal[] = [];
  const normalized = text.toLowerCase();

  // DNI pattern: DNI: 12345678 or D.N.I.: 12345678
  const dniPattern = /(?:dni|d\.?n\.?i\.?)\s*[:\s]*(\d{7,8})/i;
  if (dniPattern.test(normalized)) {
    // Check if context suggests human patient
    const contextPatterns = [
      /\b(paciente|patient|afiliado|beneficiario|beneficiaria)\b/i,
      /\b(número de paciente|patient number|historia clínica|medical record)\b/i,
    ];
    if (contextPatterns.some(p => p.test(normalized))) {
      signals.push({
        type: "pattern",
        value: "DNI en contexto de paciente humano",
        weight: 90,
      });
    }
  }

  // CUIL pattern: XX-XXXXXXXX-X or XXXXXXXXXX
  const cuilPattern = /\b(\d{2})-?(\d{7,8})-?(\d)\b/;
  if (cuilPattern.test(normalized)) {
    // Check if context is human healthcare
    const contextPatterns = [
      /\b(afiliado|socio|beneficiario|paciente)\b/i,
      /\b(obra social|prepagas|prepaga|cobertura médica|cobertura medica)\b/i,
    ];
    if (contextPatterns.some(p => p.test(normalized))) {
      signals.push({
        type: "pattern",
        value: "CUIL en contexto de afiliación humana",
        weight: 90,
      });
    }
  }

  return signals;
}

// ── Helper: Check attachment filenames ───────────────────────────────────────

function checkAttachmentNames(filenames: string[]): HumanMedicalSignal[] {
  const signals: HumanMedicalSignal[] = [];
  const joined = normalizeForMatch(filenames.join(" "));
  if (!joined) return signals;

  const humanAttachmentPatterns = [
    { pattern: /historia[_\s]?clinica/i, value: "historia_clinica", weight: 85 },
    { pattern: /receta[_\s]?medica/i, value: "receta_medica", weight: 85 },
    { pattern: /certificado[_\s]?medico/i, value: "certificado_medico", weight: 85 },
    { pattern: /bono[_\s]?consulta/i, value: "bono_consulta", weight: 85 },
    { pattern: /resultado[_\s]?laboratorio(?!.*veterinaria)/i, value: "resultado_laboratorio", weight: 85 },
    { pattern: /historia[_\s]?clinica/i, value: "hc_", weight: 75 },
  ];

  for (const entry of humanAttachmentPatterns) {
    if (entry.pattern.test(joined)) {
      signals.push({
        type: "attachment_name",
        value: entry.value,
        weight: entry.weight,
      });
    }
  }

  return signals;
}

// ── Helper: Calculate veterinary reduction ──────────────────────────────────

function calculateVeterinaryReduction(fullText: string): number {
  let reduction = 0;

  for (const signal of VETERINARY_REDUCTION_SIGNALS) {
    if (signal.pattern.test(fullText)) {
      reduction += signal.reduction;
    }
  }

  // Check for known pet names in subject/body
  const tokens = normalizeForMatch(fullText).split(/\s+/);
  for (const token of tokens) {
    if (KNOWN_PET_NAMES.has(token)) {
      reduction += 20;
      break; // Only count once per email
    }
  }

  return Math.min(reduction, 60); // Cap at -60 reduction
}

// ── Main function ────────────────────────────────────────────────────────────

export function checkHumanMedicalContent(input: {
  fromEmail: string;
  subject: string;
  bodyText: string;
  attachmentFilenames: string[];
}): HumanMedicalBlockResult {
  const signals: HumanMedicalSignal[] = [];

  // 1. Check blocked domains (highest priority, weight: 100)
  const domainSignal = checkBlockedDomain(input.fromEmail);
  if (domainSignal) {
    signals.push(domainSignal);
    return {
      isHumanMedical: true,
      confidence: 100,
      signals: [domainSignal],
      blockedReason: `Email from blocked domain: ${domainSignal.value}`,
      shouldSkipAi: true,
    };
  }

  // 2. Check keywords in subject and body
  signals.push(...checkKeywords(input.subject));
  signals.push(...checkKeywords(input.bodyText));

  // 3. Check for DNI/CUIL patterns
  signals.push(...checkDniCuilPatterns(input.subject));
  signals.push(...checkDniCuilPatterns(input.bodyText));

  // 4. Check attachment filenames
  signals.push(...checkAttachmentNames(input.attachmentFilenames));

  // 5. Calculate score
  let totalWeight = 0;
  for (const signal of signals) {
    totalWeight += signal.weight;
  }

  // 6. Apply veterinary reduction (guardrail)
  const fullText = `${input.subject}\n${input.fromEmail}\n${input.bodyText}\n${input.attachmentFilenames.join(" ")}`;
  const vetReduction = calculateVeterinaryReduction(fullText);
  const adjustedWeight = Math.max(0, totalWeight - vetReduction);

  // 7. Determine classification and confidence
  // isHumanMedical uses totalWeight so vet guardrails only reduce confidence, not flip classification
  let isHumanMedical = false;
  let confidence = 0;
  let blockedReason: string | null = null;

  if (totalWeight >= 150) {
    isHumanMedical = true;
    confidence = Math.min(95, Math.max(30, Math.round(adjustedWeight / 2)));
    blockedReason = `Multiple human healthcare signals detected (score: ${adjustedWeight})`;
  } else if (totalWeight >= 70) {
    isHumanMedical = true;
    confidence = Math.min(90, Math.max(20, adjustedWeight));
    blockedReason = `Human healthcare signals detected (score: ${adjustedWeight})`;
  } else if (totalWeight > 0) {
    // Not quite threshold, but detected some signals
    confidence = Math.round(adjustedWeight * 0.4);
  }

  return {
    isHumanMedical,
    confidence,
    signals,
    blockedReason,
    shouldSkipAi: confidence >= 80,
  };
}
