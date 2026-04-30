/**
 * narrativeBuilder.ts — Pure, deterministic, source-backed narrative generator.
 *
 * **Hard rule: no AI, no inference, no invented content.** Every sentence
 * is a templated projection of the structured ExportPayload. If a number
 * comes out as 0, the corresponding clause is omitted. If a list is
 * empty, the section is left silent (the PDF renderer decides whether
 * to show "No informado" or hide it).
 *
 * Why this exists: the founder's contract says the PDF must read like a
 * health history, not like raw system logs, but it must NEVER:
 *   - diagnose
 *   - recommend treatment
 *   - speculate about cause/effect
 *   - hardcode a pet/condition/medication
 *
 * The way to honor both is to count and group what we already have, and
 * to write conditional sentences that reference only those counts and
 * known names. No string from this module ever asserts a clinical fact
 * the source data didn't provide.
 */

import type {
  Appointment,
  Diagnosis,
  Institution,
  NarrativeBlocks,
  Observation,
  PendingReviewItem,
  Professional,
  Study,
  StudyType,
  Treatment,
  Vaccination,
} from "./types";

interface NarrativeInput {
  petName: string | null;
  documentedDiagnoses: Diagnosis[];
  pendingReview: PendingReviewItem[];
  observations: Observation[];
  vaccinations: Vaccination[];
  treatments: Treatment[];
  studies: Study[];
  appointments: Appointment[];
  professionals: Professional[];
  institutions: Institution[];
}

/** Spanish singular/plural by count. */
function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

/** Spanish list joiner: ["a","b","c"] → "a, b y c". */
function joinSpanishList(items: string[]): string {
  const filtered = items.filter((s) => typeof s === "string" && s.trim().length > 0);
  if (filtered.length === 0) return "";
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) return `${filtered[0]} y ${filtered[1]}`;
  return `${filtered.slice(0, -1).join(", ")} y ${filtered[filtered.length - 1]}`;
}

/** Spanish-friendly label per StudyType. */
const STUDY_TYPE_LABELS: Record<StudyType, { singular: string; plural: string }> = {
  lab: { singular: "análisis de laboratorio", plural: "análisis de laboratorio" },
  imaging_radiology: { singular: "radiografía", plural: "radiografías" },
  imaging_ultrasound: { singular: "ecografía", plural: "ecografías" },
  imaging_echocardiogram: { singular: "ecocardiograma", plural: "ecocardiogramas" },
  ecg: { singular: "ECG", plural: "ECGs" },
  dermatology_microscopy: { singular: "microscopía dermatológica", plural: "microscopías dermatológicas" },
  ophthalmology: { singular: "estudio oftalmológico", plural: "estudios oftalmológicos" },
  biopsy: { singular: "biopsia", plural: "biopsias" },
  other: { singular: "estudio", plural: "estudios" },
};

/**
 * Section 2 — Data status. One paragraph describing what's loaded.
 * Examples:
 *   - empty pet → "Aún no hay información clínica cargada en este perfil."
 *   - rich pet → "Este perfil contiene información clínica registrada,
 *                 incluyendo 4 diagnósticos documentados, 7 estudios y 3
 *                 tratamientos. Algunos documentos todavía requieren
 *                 revisión."
 */
export function buildDataStatusSentence(p: NarrativeInput): string {
  const parts: string[] = [];

  const documentedCount = p.documentedDiagnoses.length;
  const pendingCount = p.pendingReview.length;
  const studiesCount = p.studies.length;
  const treatmentsCount = p.treatments.length;
  const vaccinationsCount = p.vaccinations.length;
  const appointmentsCount = p.appointments.length;
  const professionalsCount = p.professionals.length;
  const institutionsCount = p.institutions.length;
  const observationsCount = p.observations.length;

  const hasAnyData =
    documentedCount + pendingCount + studiesCount + treatmentsCount +
    vaccinationsCount + appointmentsCount + observationsCount > 0;

  if (!hasAnyData) {
    return "Aún no hay información clínica cargada en este perfil.";
  }

  // Build the inventory clause with known nouns only.
  if (documentedCount > 0) {
    parts.push(`${documentedCount} ${plural(documentedCount, "diagnóstico documentado", "diagnósticos documentados")}`);
  }
  if (studiesCount > 0) {
    parts.push(`${studiesCount} ${plural(studiesCount, "estudio", "estudios")}`);
  }
  if (treatmentsCount > 0) {
    parts.push(`${treatmentsCount} ${plural(treatmentsCount, "tratamiento", "tratamientos")}`);
  }
  if (vaccinationsCount > 0) {
    parts.push(`${vaccinationsCount} ${plural(vaccinationsCount, "vacuna", "vacunas")}`);
  }
  if (appointmentsCount > 0) {
    parts.push(`${appointmentsCount} ${plural(appointmentsCount, "turno", "turnos")}`);
  }

  let sentence = "Este perfil contiene información clínica registrada";
  if (parts.length > 0) {
    sentence += `, incluyendo ${joinSpanishList(parts)}`;
  }
  sentence += ".";

  // Pending review clause — separate sentence so it stays factual.
  if (pendingCount > 0) {
    sentence += ` ${pendingCount} ${plural(pendingCount, "registro extraído", "registros extraídos")} de documentos ${plural(pendingCount, "está", "están")} pendiente${pendingCount === 1 ? "" : "s"} de revisión por el tutor o el veterinario.`;
  }

  if (professionalsCount > 0 || institutionsCount > 0) {
    const proPart = professionalsCount > 0
      ? `${professionalsCount} ${plural(professionalsCount, "profesional registrado", "profesionales registrados")}`
      : "";
    const instPart = institutionsCount > 0
      ? `${institutionsCount} ${plural(institutionsCount, "institución", "instituciones")}`
      : "";
    const both = [proPart, instPart].filter(Boolean).join(" y ");
    sentence += ` Se identificaron ${both} en los documentos.`;
  }

  return sentence;
}

/**
 * Section 3 — Current care. Mentions active treatments by name (when known)
 * and upcoming appointments. Never asserts disease or prognosis.
 */
export function buildCurrentCareSentence(p: NarrativeInput): string {
  const petLabel = p.petName ?? "La mascota";
  const activeTreatments = p.treatments.filter((t) => t.status !== "historical");
  const upcomingAppts = p.appointments.filter((a) => a.status === "upcoming");

  const sentences: string[] = [];

  if (activeTreatments.length > 0) {
    const names = activeTreatments
      .map((t) => t.name)
      .filter((n): n is string => !!n && n.trim().length > 0)
      .slice(0, 4); // cap visible names; more get summarized
    if (names.length === activeTreatments.length) {
      sentences.push(`${petLabel} tiene ${plural(activeTreatments.length, "un tratamiento activo registrado", "tratamientos activos registrados")} con ${joinSpanishList(names)}.`);
    } else {
      sentences.push(`${petLabel} tiene ${activeTreatments.length} tratamientos activos registrados, incluyendo ${joinSpanishList(names)}.`);
    }
  }

  if (upcomingAppts.length > 0) {
    sentences.push(`Hay ${upcomingAppts.length} ${plural(upcomingAppts.length, "turno próximo", "turnos próximos")} agendado${upcomingAppts.length === 1 ? "" : "s"}.`);
  }

  if (p.studies.length > 0) {
    sentences.push(`Se ${plural(p.studies.length, "registró", "registraron")} ${p.studies.length} ${plural(p.studies.length, "estudio", "estudios")} en el historial.`);
  }

  if (sentences.length === 0) {
    return "No hay tratamientos activos ni turnos próximos registrados en este perfil.";
  }

  return sentences.join(" ");
}

/**
 * Section 5 — Studies summary. Groups by type and counts.
 * Example: "10 estudios documentados — 4 ecocardiogramas, 3 análisis
 * de laboratorio, 2 radiografías, 1 microscopía dermatológica."
 */
export function buildStudiesSummary(p: NarrativeInput): string {
  if (p.studies.length === 0) return "";

  const counts = new Map<StudyType, number>();
  for (const s of p.studies) {
    counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
  }

  // Sort by count desc, then by type name for stability.
  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const groupParts = sorted.map(([type, count]) => {
    const label = STUDY_TYPE_LABELS[type];
    return `${count} ${count === 1 ? label.singular : label.plural}`;
  });

  return `${p.studies.length} ${plural(p.studies.length, "estudio registrado", "estudios registrados")} — ${joinSpanishList(groupParts)}.`;
}

/**
 * Section 9 — Pending review / data quality. Counts unsigned studies,
 * missing fields, and pending-review extractions. Never editorializes.
 */
export function buildPendingReviewSummary(p: NarrativeInput): string {
  const facts: string[] = [];

  if (p.pendingReview.length > 0) {
    facts.push(`${p.pendingReview.length} ${plural(p.pendingReview.length, "registro extraído", "registros extraídos")} ${plural(p.pendingReview.length, "espera", "esperan")} confirmación`);
  }

  const unsignedStudies = p.studies.filter((s) => !s.signedBy).length;
  if (unsignedStudies > 0) {
    facts.push(`${unsignedStudies} ${plural(unsignedStudies, "estudio sin firma", "estudios sin firma")}`);
  }

  const apptsMissingProfessional = p.appointments.filter(
    (a) => a.status === "upcoming" && !a.professional,
  ).length;
  if (apptsMissingProfessional > 0) {
    facts.push(`${apptsMissingProfessional} ${plural(apptsMissingProfessional, "turno sin profesional asignado", "turnos sin profesional asignado")}`);
  }

  const observationsCount = p.observations.length;
  if (observationsCount > 0) {
    facts.push(`${observationsCount} ${plural(observationsCount, "observación cargada por el tutor", "observaciones cargadas por el tutor")}`);
  }

  if (facts.length === 0) {
    return "";
  }

  return `Pendientes de revisión: ${joinSpanishList(facts)}.`;
}

/** Build all four narrative blocks at once. */
export function buildNarrative(p: NarrativeInput): NarrativeBlocks {
  return {
    dataStatus: buildDataStatusSentence(p),
    currentCare: buildCurrentCareSentence(p),
    studiesSummary: buildStudiesSummary(p),
    pendingReviewSummary: buildPendingReviewSummary(p),
  };
}
