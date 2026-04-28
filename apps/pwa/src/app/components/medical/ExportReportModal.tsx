import { useState } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";
import { useAuth } from "../../contexts/AuthContext";
import { formatDateSafe } from "../../utils/dateUtils";
import { loadJsPdf, savePdfWithFallback } from "../../utils/pdfExport";
import { generateClinicalOverview } from "../../utils/clinicalOverview";
import { loadPessyLogo } from "../../../lib/pdf/loadLogo";
import { httpsCallable } from "firebase/functions";
import { functions as fbFunctions } from "../../../lib/firebase";

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ReportType = "health" | "vaccine" | "treatment";

// Feature flag: when true, the export PDF uses the new source-backed
// callable (pessyExportSourceBacked). When false, falls back to the
// legacy pessyClinicalSummaryStructured (prompt-only) path.
// Toggling this constant requires a code change + redeploy — it is not
// a runtime-configurable kill switch.
const USE_SOURCE_BACKED_EXPORT = true;

// ── Source-backed payload shape (mirrors functions/src/export/types.ts) ──
type SBDocumentedSource =
  | "vet_document"
  | "vaccination_card"
  | "lab_pdf"
  | "prescription";
interface SBDiagnosis {
  id: string;
  condition: string;
  date: string;
  source: SBDocumentedSource;
  sourceEventIds: string[];
}
interface SBObservation {
  id: string;
  text: string;
  date: string;
  source: "tutor_input";
  sourceEventIds: string[];
}
interface SBPendingReview {
  id: string;
  label: string;
  date: string;
  source: "ai_extraction" | "ai_pending_review";
  sourceEventIds: string[];
}
interface SBTreatment {
  id: string;
  name: string;
  date: string;
  source: SBDocumentedSource;
  sourceEventIds: string[];
}
interface SBVaccination {
  id: string;
  name: string;
  date: string;
  source: SBDocumentedSource;
  sourceEventIds: string[];
}
interface SourceBackedExportPayload {
  petId: string;
  petName: string | null;
  safeTemplate: boolean;
  documentedDiagnoses: SBDiagnosis[];
  /**
   * AI-extracted findings still awaiting vet/tutor confirmation. The
   * underlying source (a real PDF or email attachment) exists; the data
   * just isn't verified yet. Render as "pending review", never as
   * documented.
   */
  pendingReview?: SBPendingReview[];
  pendingReviewCount?: number;
  observations: SBObservation[];
  vaccinations: SBVaccination[];
  treatments: SBTreatment[];
  // suggestedQuestionsForVet stays empty in this PR by design.
  suggestedQuestionsForVet: string[];
  generatedAt: string;
}

export function ExportReportModal({ isOpen, onClose }: ExportReportModalProps) {
  const [selectedReport, setSelectedReport] = useState<ReportType>("health");
  const [isGenerating, setIsGenerating] = useState(false);

  const { user, userName, userFullName } = useAuth();
  const { activePet } = usePet();
  const {
    getEventsByPetId,
    getActiveMedicationsByPetId,
    getAppointmentsByPetId,
    getClinicalConditionsByPetId,
    getClinicalAlertsByPetId,
    getConsolidatedTreatmentsByPetId,
    saveVerifiedReport,
  } = useMedical();

  const fmt = (iso?: string | null) => {
    return formatDateSafe(iso, "es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }, "—");
  };

  const clean = (v?: string | null) =>
    (v || "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s+/g, "")
      .replace(/`/g, "")
      .replace(/[%Ï]/g, "")       // basura de encoding de emails
      .replace(/^>+\s*/gm, "")    // quotes de email reply
      .replace(/\s+/g, " ")
      .trim();

  // ── Filtros semánticos (regla dura: sin ruido) ─────────────────────────
  const isEmailLike = (v?: string | null) => !!v && /@/.test(v);
  const isNoisePlaceholder = (v?: string | null) => {
    const s = (v || "").toLowerCase().trim();
    return !s
      || s.includes("sin interpretacion")
      || s.includes("sin interpretación")
      || s.includes("sin referencia")
      || s.includes("pendiente de revisión")
      || s === "—";
  };
  // Nombre de profesional usable: no vacío, no email
  const cleanProfessional = (v?: string | null): string | null => {
    const s = clean(v);
    if (!s || isEmailLike(s)) return null;
    return s;
  };
  // Para un evento: nombre de vet REAL (masterPayload > extractedData, nunca email)
  const getRealProfessional = (event: any): string | null => {
    const mp = (event.extractedData as Record<string, unknown>)?.masterPayload as Record<string, unknown> | undefined;
    const docInfo = mp?.document_info as Record<string, unknown> | undefined;
    const fromPayload = cleanProfessional(docInfo?.veterinarian_name as string);
    if (fromPayload) return fromPayload;
    return cleanProfessional(event.extractedData?.provider) || cleanProfessional(event.extractedData?.clinic);
  };

  const getCanonicalSummary = (event: any) => {
    const extracted = event.extractedData || {};
    const summary = clean(extracted.diagnosis || extracted.observations || "");
    if (summary) return summary;
    if (event.requiresManualConfirmation || event.workflowStatus === "review_required") {
      return "Pendiente de revisión humana";
    }
    return "Sin interpretacion confirmada";
  };

  const buildNarrativeClinicalProfile = (args: {
    petName: string;
    activeConditions: Array<{ normalizedName?: string | null }>;
    resolvedConditions: Array<{ normalizedName?: string | null }>;
    treatmentRows: Array<{ name?: string | null; condition?: string | null; status?: string | null }>;
    studies: any[];
  }) => {
    const activeNames = args.activeConditions
      .map((condition) => clean(condition.normalizedName))
      .filter(Boolean)
      .slice(0, 3);
    const resolvedNames = args.resolvedConditions
      .map((condition) => clean(condition.normalizedName))
      .filter(Boolean)
      .slice(0, 2);
    const medicationNames = args.treatmentRows
      .map((row) => clean(row.name))
      .filter(Boolean)
      .slice(0, 3);
    const studyLabels = args.studies
      .map((event) => clean(event.extractedData?.studyType || event.title || event.extractedData?.suggestedTitle || toTypeLabel(event.extractedData?.documentType)))
      .filter(Boolean)
      .slice(0, 3);

    const sentences: string[] = [];
    if (activeNames.length> 0) {
      sentences.push(`${args.petName} tiene hoy seguimiento activo por ${activeNames.join(", ")}.`);
    } else if (resolvedNames.length> 0) {
      sentences.push(`${args.petName} tiene antecedentes relevantes por ${resolvedNames.join(", ")}.`);
    } else {
      sentences.push(`${args.petName} tiene un historial ordenado con eventos y estudios confirmados.`);
    }

    if (medicationNames.length> 0) {
      sentences.push(`Los cuidados o continuidades mas relevantes incluyen ${medicationNames.join(", ")}.`);
    }

    if (studyLabels.length> 0) {
      sentences.push(`Entre los estudios complementarios registrados se destacan ${studyLabels.join(", ")}.`);
    }

    return sentences.slice(0, 3).join(" ");
  };

  const toTs = (value?: string | null) => (value ? Date.parse(value) || 0 : 0);

  const fmtLong = (iso?: string | null) => {
    return formatDateSafe(
      iso,
      "es-AR",
      { day: "2-digit", month: "long", year: "numeric" },
      "—",
    );
  };

  const fmtDateTime = (date?: string | null, time?: string | null) => {
    const base = fmtLong(date);
    return time ? `${base} ${time}` : base;
  };

  const toTypeLabel = (documentType?: string | null): string => {
    const map: Record<string, string> = {
      vaccine: "Vacuna",
      lab_test: "Laboratorio",
      xray: "Radiografía",
      checkup: "Consulta",
      medication: "Tratamiento",
      surgery: "Cirugía",
      echocardiogram: "Ecocardiograma",
      electrocardiogram: "Electrocardiograma",
      appointment: "Turno",
      other: "Otro",
    };
    return map[documentType || ""] || "Otro";
  };

  const TITLE_MAP: Record<ReportType, string> = {
    health: "Resumen Estructurado de Cuidado",
    vaccine: "Carnet de Vacunación",
    treatment: "Plan de Tratamiento",
  };

  const generatePDF = async () => {
    if (!activePet) return;
    setIsGenerating(true);

    try {
      const JsPdf = await loadJsPdf();
      const pdf = new JsPdf({ orientation: "portrait", unit: "mm", format: "a4" });
      const PW = 210;
      const M = 16;            // margen
      const CW = PW - M * 2;  // ancho de contenido
      const COL2 = M + CW / 2; // segunda columna
      let y = 0;

      const newPage = () => { pdf.addPage(); y = 20; };
      const checkY = (need = 14) => { if (y + need> 278) newPage(); };

      // Logo blanco (variante manual de marca para fondo verde oscuro)
      let logoWhite: string | null = null;
      try { logoWhite = await loadPessyLogo("white", 1024); } catch { /* fallback header text-only */ }

      // ── HEADER (manual de marca Pessy — Plano Branding) ───────────────────
      const HEADER_H = 38;
      pdf.setFillColor(7, 71, 56); // #074738 primary
      pdf.rect(0, 0, PW, HEADER_H, "F");

      // Logo isotipo + wordmark "Pessy." (lockup horizontal del manual)
      const LOGO_SIZE = 22; // mm — área de seguridad respetada
      const LOGO_Y = (HEADER_H - LOGO_SIZE) / 2; // centrado vertical
      if (logoWhite) {
        pdf.addImage(logoWhite, "PNG", M, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
      }
      // Wordmark "Pessy." en blanco — lowercase con punto, oficial del manual
      const WORDMARK_X = logoWhite ? M + LOGO_SIZE + 4 : M;
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text("Pessy.", WORDMARK_X, HEADER_H / 2 + 2.5);

      // Columna derecha: tipo de reporte + fecha
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text(TITLE_MAP[selectedReport], PW - M, HEADER_H / 2 - 1, { align: "right" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(
        `Generado ${new Date().toLocaleDateString("es-AR")}`,
        PW - M,
        HEADER_H / 2 + 4.5,
        { align: "right" }
      );

      y = HEADER_H + 4;
      // Pill de validación se renderiza más abajo, después del AI call

      // ── DATOS DE LA MASCOTA ───────────────────────────────────────────────
      pdf.setFillColor(240, 253, 250);
      pdf.roundedRect(M, y, CW, 26, 3, 3, "F");
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(27, 94, 79);
      pdf.text(activePet.name, M + 4, y + 8);
      pdf.setTextColor(60, 60, 60);
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      const species = activePet.species === "dog" ? "Perro" : activePet.species === "cat" ? "Gato" : activePet.species || "—";
      pdf.text(`Raza: ${activePet.breed || "—"}`, M + 4, y + 16);
      pdf.text(`Especie: ${species}`, COL2, y + 16);
      pdf.text(`Edad: ${activePet.age || "—"}`, M + 4, y + 22);
      pdf.text(`Tutor: ${clean(userFullName || userName || user?.email)}`, COL2, y + 22);
      y += 32;

      // ── DATOS ─────────────────────────────────────────────────────────────
      const events = getEventsByPetId(activePet.id);
      const medications = getActiveMedicationsByPetId(activePet.id);
      const appointments = getAppointmentsByPetId(activePet.id);
      const upcoming = appointments.filter(a => a.status === "upcoming");
      const conditions = getClinicalConditionsByPetId(activePet.id);
      const alerts = getClinicalAlertsByPetId(activePet.id);
      const treatments = getConsolidatedTreatmentsByPetId(activePet.id);
      const activeConditions = conditions.filter((condition) => condition.status === "active" || condition.status === "monitoring");
      const resolvedConditions = conditions.filter((condition) => condition.status === "resolved");
      const activeAlerts = alerts.filter((alert) => alert.status === "active");
      const activeTreatments = treatments.filter((treatment) => treatment.status === "active");

      const sortedEvents = [...events].sort((a, b) => {
        const aDate = a.extractedData.eventDate || a.createdAt;
        const bDate = b.extractedData.eventDate || b.createdAt;
        return toTs(bDate) - toTs(aDate);
      });

      const pendingManualReviewCount = events.filter((event) => {
        return event.requiresManualConfirmation || event.workflowStatus === "review_required";
      }).length;

      const conditionNameById = new Map<string, string>(
        conditions.map((condition) => [condition.id, clean(condition.normalizedName)]),
      );

      const treatmentRows = (activeTreatments.length> 0
        ? activeTreatments.map((item) => ({
            name: clean(item.normalizedName) || "Tratamiento",
            dosage: clean(item.dosage) || "—",
            frequency: clean(item.frequency) || "—",
            condition: item.linkedConditionIds.length> 0
              ? item.linkedConditionIds
                  .map((conditionId) => conditionNameById.get(conditionId))
                  .filter(Boolean)
                  .join(", ")
              : "Sin asociar",
            startDate: item.startDate,
            professional: clean(item.prescribingProfessional?.name || item.clinic?.name) || "Sin firma clínica",
            status: item.endDate ? "Temporal" : "Crónico",
          }))
        : medications.map((item) => ({
            name: clean(item.name) || "Tratamiento",
            dosage: clean(item.dosage) || "—",
            frequency: clean(item.frequency) || "—",
            condition: "Sin asociar",
            startDate: item.startDate,
            professional: clean(item.prescribedBy) || "Sin firma clínica",
            status: item.endDate ? "Temporal" : "Crónico",
          })))
        .filter((item) => item.name.length> 0);

      const studies = sortedEvents.filter((event) => {
        const type = event.extractedData.documentType;
        return ["xray", "lab_test", "echocardiogram", "electrocardiogram"].includes(type);
      });
      const narrativeClinicalProfile = buildNarrativeClinicalProfile({
        petName: activePet.name,
        activeConditions,
        resolvedConditions,
        treatmentRows,
        studies,
      });

      const reportSummaryForVerification = [
        `Problemas activos: ${activeConditions.length}`,
        `Tratamientos activos: ${treatmentRows.length}`,
        `Turnos próximos: ${upcoming.length}`,
        `Eventos: ${events.length}`,
      ].join(" · ");

      // ══════════════════════════════════════════════════════════════════════
      // AI BRAIN — Cerebro de Pessy genera el resumen estructurado de 10 secciones
      // Si falla → fallback al renderer local (existing behavior preservado).
      // ══════════════════════════════════════════════════════════════════════
      type AISections = {
        patient: { name: string; species: string; breed: string; sex: string; age: string; weight: string; tutor: string };
        purpose: string;
        clinicalHistory: string;
        diagnoses: { confirmed: string[]; findings: string[]; suspected: string[] };
        studies: Array<{ date: string; type: string; mainFinding: string; professional: string }>;
        treatment: Array<{ name: string; dose: string; frequency: string; route: string; indication: string; startDate: string; notes: string }>;
        professionals: { persons: string[]; institutions: string[] };
        currentStatus: string;
        followUp: string;
        finalNote: string;
      };
      type ProvenanceMix = {
        total: number;
        vet_input: number;
        tutor_confirmed: number;
        ai_extraction: number;
        ai_pending_review: number;
        tutor_input: number;
      };
      let aiSections: AISections | null = null;
      let provenanceMix: ProvenanceMix | null = null;
      let validatedRatio = 0;

      // ── Adapter: source-backed payload → existing 10-section AISections ──
      // We only ever populate `diagnoses.confirmed` from documented sources.
      // Observations from tutor_input never become confirmed claims. Sections
      // we cannot ground in Firestore-loaded data (studies, professionals,
      // currentStatus, followUp narrative) stay intentionally empty / generic.
      const buildSectionsFromPayload = (p: SourceBackedExportPayload): AISections => {
        const pet = activePet!;
        const documentedCount = p.documentedDiagnoses.length;
        const pendingReviewCount =
          typeof p.pendingReviewCount === "number"
            ? p.pendingReviewCount
            : (p.pendingReview?.length ?? 0);
        const observationCount = p.observations.length;
        const treatmentCount = p.treatments.length;
        const vaccinationCount = p.vaccinations.length;

        const historyParts: string[] = [];
        if (documentedCount > 0) {
          historyParts.push(
            `${documentedCount} diagnóstico${documentedCount === 1 ? "" : "s"} documentado${documentedCount === 1 ? "" : "s"} en archivos cargados.`,
          );
        }
        if (pendingReviewCount > 0) {
          historyParts.push(
            `${pendingReviewCount} ${pendingReviewCount === 1 ? "registro extraído" : "registros extraídos"} de documentos, pendiente${pendingReviewCount === 1 ? "" : "s"} de revisión.`,
          );
        }
        if (vaccinationCount > 0) {
          historyParts.push(
            `${vaccinationCount} vacuna${vaccinationCount === 1 ? "" : "s"} registrada${vaccinationCount === 1 ? "" : "s"}.`,
          );
        }
        if (treatmentCount > 0) {
          historyParts.push(
            `${treatmentCount} tratamiento${treatmentCount === 1 ? "" : "s"} documentado${treatmentCount === 1 ? "" : "s"}.`,
          );
        }
        if (observationCount > 0) {
          historyParts.push(
            `${observationCount} ${observationCount === 1 ? "observación cargada" : "observaciones cargadas"} por el tutor.`,
          );
        }
        const clinicalHistory = historyParts.length
          ? historyParts.join(" ")
          : "Sin información clínica documentada cargada.";

        return {
          patient: {
            name: p.petName || pet.name || "",
            species: pet.species || "",
            breed: pet.breed || "",
            sex: pet.sex || "",
            age: pet.age || (pet as { birthDate?: string }).birthDate || "",
            weight: pet.weight ? String(pet.weight) : "",
            tutor: userFullName || userName || "",
          },
          purpose:
            "Reporte de salud generado por Pessy a partir de los documentos y datos cargados por el tutor.",
          clinicalHistory,
          diagnoses: {
            confirmed: p.documentedDiagnoses.map(
              (d) => `${d.condition}${d.date ? ` (${fmt(d.date)})` : ""}`,
            ),
            // PDF Section 4 already has a "Hallazgos extraídos de estudios"
            // sub-heading. Pending-review items map there cleanly: real
            // source, AI-extracted, not yet confirmed.
            findings: (p.pendingReview ?? []).map(
              (r) => `${r.label}${r.date ? ` (${fmt(r.date)})` : ""}`,
            ),
            suspected: [],
          },
          studies: [],
          treatment: p.treatments.map((t) => ({
            name: t.name,
            dose: "",
            frequency: "",
            route: "",
            indication: "",
            startDate: t.date ? fmt(t.date) : "",
            notes: "",
          })),
          professionals: { persons: [], institutions: [] },
          currentStatus: "",
          followUp:
            "Consultá con tu veterinario para definir los próximos pasos de seguimiento.",
          finalNote:
            "Este reporte se generó a partir de documentos cargados por el tutor en Pessy. No reemplaza una evaluación clínica veterinaria. Cualquier decisión de tratamiento debe tomarla un profesional habilitado.",
        };
      };

      const provenanceMixFromPayload = (
        p: SourceBackedExportPayload,
      ): ProvenanceMix => {
        const documented =
          p.documentedDiagnoses.length + p.vaccinations.length + p.treatments.length;
        const pending =
          typeof p.pendingReviewCount === "number"
            ? p.pendingReviewCount
            : (p.pendingReview?.length ?? 0);
        const observation = p.observations.length;
        const total = documented + pending + observation;
        return {
          total,
          // Documented bucket maps to the existing "validated" pair. We
          // attribute it to tutor_confirmed since the underlying source
          // could be vet_input or tutor_confirmed; the renderer only
          // sums them anyway.
          vet_input: 0,
          tutor_confirmed: documented,
          // Pending-review items count as ai_extraction so the validation
          // pill reflects "partially validated" instead of "empty".
          ai_extraction: pending,
          ai_pending_review: 0,
          tutor_input: observation,
        };
      };

      if (USE_SOURCE_BACKED_EXPORT) {
        // Source-backed path. If this fails we DO NOT fall back to the
        // legacy prompt-only callable — that would defeat the purpose of
        // moving to source-backed safety. On failure we leave aiSections
        // null so the existing local honest renderer takes over (no
        // fabricated narrative).
        try {
          const callSB = httpsCallable<
            { petId: string },
            SourceBackedExportPayload
          >(fbFunctions, "pessyExportSourceBacked");
          const sbResult = await callSB({ petId: activePet.id });
          const payload = sbResult.data;
          if (payload) {
            provenanceMix = provenanceMixFromPayload(payload);
            validatedRatio =
              provenanceMix.total > 0
                ? provenanceMix.tutor_confirmed / provenanceMix.total
                : 0;
            // Empty pet → keep aiSections null so the local fallback renders
            // the honest "no information yet" state. We do NOT fabricate a
            // narrative for an empty pet.
            aiSections = payload.safeTemplate ? null : buildSectionsFromPayload(payload);
          }
        } catch (err) {
          console.warn("[ExportReport] source-backed export falló, uso renderer local:", err);
        }

        // Safety net: if the callable returned an empty payload but the
        // local MedicalContext clearly has events for this pet, do NOT
        // let the validation pill say "Sin información cargada". That
        // would directly contradict what the Timeline shows on the same
        // screen. Surface the discrepancy as an honest "not validated"
        // pill state so the local fallback renderer can fill in the
        // narrative from the cached data.
        const localCount = events.length + appointments.length + treatments.length;
        if ((!provenanceMix || provenanceMix.total === 0) && localCount > 0) {
          provenanceMix = {
            total: localCount,
            vet_input: 0,
            tutor_confirmed: 0,
            ai_extraction: 0,
            ai_pending_review: 0,
            tutor_input: localCount,
          };
          validatedRatio = 0;
        }
      } else {
        // Legacy prompt-only path. Only reachable if the feature flag above
        // is flipped (requires a code change + redeploy).
        try {
          const callAI = httpsCallable<
            { petId: string },
            { sections: AISections; provenanceMix?: ProvenanceMix; validatedRatio?: number }
          >(fbFunctions, "pessyClinicalSummaryStructured");
          const aiResult = await callAI({ petId: activePet.id });
          aiSections = aiResult.data?.sections || null;
          provenanceMix = aiResult.data?.provenanceMix || null;
          validatedRatio = aiResult.data?.validatedRatio || 0;
        } catch (err) {
          console.warn("[ExportReport] cerebro AI falló, uso renderer local:", err);
        }
      }

      // ── PILL VALIDACIÓN (Fase 1: dinámica según provenance mix) ──────────
      const validatedCount = (provenanceMix?.vet_input || 0) + (provenanceMix?.tutor_confirmed || 0);
      const totalEvents = provenanceMix?.total || 0;
      const pillState: "empty" | "validated" | "mixed" | "not_validated" =
        totalEvents === 0 ? "empty" :
        validatedRatio >= 0.7 ? "validated" :
        validatedRatio >= 0.3 ? "mixed" : "not_validated";

      const pillConfig = {
        empty:         { fill: [243, 244, 246], stroke: [156, 163, 175], txt: [55, 65, 81], label: "Sin información cargada", subtitle: "Subí documentos para empezar" },
        validated:     { fill: [220, 252, 231], stroke: [16, 185, 129], txt: [6, 95, 70],   label: `Validación: ${validatedCount}/${totalEvents} eventos confirmados`, subtitle: "La mayoría revisado o cargado por veterinario" },
        mixed:         { fill: [254, 243, 199], stroke: [245, 158, 11], txt: [146, 64, 14], label: `Validación parcial: ${validatedCount}/${totalEvents}`, subtitle: "Algunos eventos sin revisión humana" },
        not_validated: { fill: [254, 226, 226], stroke: [239, 68, 68],  txt: [153, 27, 27], label: "Sin validación veterinaria", subtitle: "Información cargada por el tutor — sin revisar" },
      } as const;
      const cfg = pillConfig[pillState];
      pdf.setFillColor(cfg.fill[0], cfg.fill[1], cfg.fill[2]);
      pdf.setDrawColor(cfg.stroke[0], cfg.stroke[1], cfg.stroke[2]);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(M, y, CW, 7, 1.5, 1.5, "FD");
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(cfg.txt[0], cfg.txt[1], cfg.txt[2]);
      pdf.text(cfg.label, M + 3, y + 4.5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.text(cfg.subtitle, PW - M - 3, y + 4.5, { align: "right" });
      y += 11;
      pdf.setTextColor(25, 25, 25);

      if (aiSections) {
        // ── Renderer 10 secciones ────────────────────────────────────────────
        const renderSection = (n: number, title: string, body: () => void) => {
          checkY(20);
          y += 2;
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(7, 71, 56); // primary
          pdf.text(`${n}. ${title}`, M, y);
          y += 4;
          pdf.setDrawColor(26, 155, 125); // accent
          pdf.setLineWidth(0.4);
          pdf.line(M, y, M + CW, y);
          y += 5;
          pdf.setTextColor(40, 40, 40);
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          body();
          y += 4;
        };

        const para = (text: string) => {
          if (!text) text = "No informado";
          const lines = pdf.splitTextToSize(text, CW);
          for (const line of lines) {
            checkY(6);
            pdf.text(line, M, y);
            y += 4.5;
          }
        };
        const bullet = (text: string) => {
          checkY(6);
          pdf.text("•", M, y);
          const lines = pdf.splitTextToSize(text, CW - 5);
          let first = true;
          for (const line of lines) {
            if (!first) checkY(6);
            pdf.text(line, M + 4, y);
            y += 4.5;
            first = false;
          }
        };

        // 1. Identificación del paciente
        renderSection(1, "Identificación del paciente", () => {
          const p = aiSections!.patient;
          para(`Nombre: ${p.name || "No informado"}`);
          para(`Especie: ${p.species || "No informado"}`);
          para(`Raza: ${p.breed || "No informado"}`);
          para(`Sexo: ${p.sex || "No informado"}`);
          para(`Edad: ${p.age || "No informado"}`);
          para(`Peso: ${p.weight || "No informado"}`);
          para(`Tutor: ${p.tutor || "No informado"}`);
        });

        // 2. Motivo del resumen
        renderSection(2, "Motivo del resumen", () => para(aiSections!.purpose));

        // 3. Historia clínica resumida
        renderSection(3, "Historia clínica resumida", () => para(aiSections!.clinicalHistory));

        // 4. Diagnósticos / Hallazgos
        renderSection(4, "Información clínica documentada", () => {
          const d = aiSections!.diagnoses;
          if (d.confirmed.length === 0 && d.findings.length === 0 && d.suspected.length === 0) {
            para("No informado");
            return;
          }
          if (d.confirmed.length) {
            pdf.setFont("helvetica", "bold"); pdf.text("Documentados en archivos:", M, y); y += 5;
            pdf.setFont("helvetica", "normal");
            d.confirmed.forEach(bullet);
            y += 1;
          }
          if (d.findings.length) {
            pdf.setFont("helvetica", "bold"); pdf.text("Hallazgos extraídos de estudios:", M, y); y += 5;
            pdf.setFont("helvetica", "normal");
            d.findings.forEach(bullet);
            y += 1;
          }
          if (d.suspected.length) {
            pdf.setFont("helvetica", "bold"); pdf.text("Sospechas:", M, y); y += 5;
            pdf.setFont("helvetica", "normal");
            d.suspected.forEach(bullet);
          }
        });

        // 5. Estudios realizados
        renderSection(5, "Estudios realizados", () => {
          if (!aiSections!.studies.length) { para("No informado"); return; }
          aiSections!.studies.forEach((s) => {
            const head = `${s.date || "fecha no informada"} · ${s.type || "—"}`;
            const detail = `${s.mainFinding || "Sin hallazgo registrado"}${s.professional ? ` · ${s.professional}` : ""}`;
            pdf.setFont("helvetica", "bold"); checkY(6); pdf.text(head, M, y); y += 4.5;
            pdf.setFont("helvetica", "normal");
            const lines = pdf.splitTextToSize(detail, CW);
            for (const line of lines) { checkY(6); pdf.text(line, M, y); y += 4.5; }
            y += 1.5;
          });
        });

        // 6. Tratamiento actual
        renderSection(6, "Tratamiento actual", () => {
          if (!aiSections!.treatment.length) { para("No informado"); return; }
          aiSections!.treatment.forEach((t) => {
            pdf.setFont("helvetica", "bold"); checkY(6); pdf.text(t.name || "—", M, y); y += 4.5;
            pdf.setFont("helvetica", "normal");
            const parts: string[] = [];
            if (t.dose) parts.push(`Dosis: ${t.dose}`);
            if (t.frequency) parts.push(`Frecuencia: ${t.frequency}`);
            if (t.route) parts.push(`Vía: ${t.route}`);
            if (t.indication) parts.push(`Indicación: ${t.indication}`);
            if (t.startDate) parts.push(`Inicio: ${t.startDate}`);
            const detail = parts.join(" · ") || "No informado";
            const lines = pdf.splitTextToSize(detail, CW);
            for (const line of lines) { checkY(6); pdf.text(line, M, y); y += 4.5; }
            if (t.notes) {
              const noteLines = pdf.splitTextToSize(`Notas: ${t.notes}`, CW);
              for (const line of noteLines) { checkY(6); pdf.text(line, M, y); y += 4.5; }
            }
            y += 1.5;
          });
        });

        // 7. Veterinarios e instituciones
        renderSection(7, "Veterinarios e instituciones tratantes", () => {
          const p = aiSections!.professionals;
          if (!p.persons.length && !p.institutions.length) { para("No informado"); return; }
          if (p.persons.length) {
            pdf.setFont("helvetica", "bold"); pdf.text("Profesionales:", M, y); y += 5;
            pdf.setFont("helvetica", "normal");
            p.persons.forEach(bullet);
            y += 1;
          }
          if (p.institutions.length) {
            pdf.setFont("helvetica", "bold"); pdf.text("Instituciones:", M, y); y += 5;
            pdf.setFont("helvetica", "normal");
            p.institutions.forEach(bullet);
          }
        });

        // 8. Estado clínico actual
        renderSection(8, "Estado clínico actual", () => para(aiSections!.currentStatus));

        // 9. Recomendaciones de seguimiento
        renderSection(9, "Recomendaciones de seguimiento", () => para(aiSections!.followUp));

        // 10. Nota final
        renderSection(10, "Nota final", () => para(aiSections!.finalNote));

      } else if (selectedReport === "health") {
        // FALLBACK LOCAL — solo se ejecuta si el cerebro AI falla.
        // No es código muerto: garantiza PDF funcional aunque Gemini esté caído.
        const sectionTitle = (title: string) => {
          checkY(16);
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(26, 155, 125);
          pdf.text(title, M, y);
          y += 5;
          pdf.setDrawColor(26, 155, 125);
          pdf.setLineWidth(0.4);
          pdf.line(M, y, M + CW, y);
          y += 5;
        };

        const bullet = (text: string) => {
          const lines = pdf.splitTextToSize(`•  ${text}`, CW - 4);
          checkY(lines.length * 4 + 2);
          pdf.text(lines, M + 1, y + 1);
          y += lines.length * 4 + 1;
        };

        const bodyText = (text: string, color: [number, number, number] = [55, 65, 81]) => {
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(color[0], color[1], color[2]);
          const lines = pdf.splitTextToSize(text, CW - 2);
          checkY(lines.length * 4 + 2);
          pdf.text(lines, M, y + 1);
          y += lines.length * 4 + 2;
        };

        // Sólo fechas REALMENTE futuras (>= hoy a las 00:00)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const futureAppointments = [...upcoming]
          .filter((a) => {
            if (!a.date) return false;
            const d = new Date(a.date);
            return !isNaN(d.getTime()) && d >= todayStart;
          })
          .sort((a, b) =>
            toTs(`${a.date || ""}T${a.time || "00:00"}`) -
            toTs(`${b.date || ""}T${b.time || "00:00"}`),
          );

        // Eventos últimos 60 días con contenido real
        const sixtyDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 60;
        const recentEvents = sortedEvents.filter((ev) => {
          const d = toTs(ev.extractedData.eventDate || ev.createdAt);
          return d >= sixtyDaysAgo;
        });

        // Estudios relevantes: con interpretación real, sin ruido de email
        const relevantStudies = sortedEvents.filter((ev) => {
          const t = ev.extractedData.documentType;
          if (!["xray", "lab_test", "echocardiogram", "electrocardiogram"].includes(t)) return false;
          const diag = clean(ev.extractedData.diagnosis || ev.extractedData.observations || "");
          if (isNoisePlaceholder(diag)) return false;
          return true;
        });

        // Mapa condición → tratamientos vinculados (vía event source)
        // Reconstruimos condición a partir del event que originó el medicamento
        const eventById = new Map(sortedEvents.map((e) => [e.id, e] as const));
        const medsWithCondition = medications.map((med) => {
          let condition: string | null = null;
          const srcEvent = med.sourceEventId ? eventById.get(med.sourceEventId) : null;
          if (srcEvent) {
            const diag = clean(srcEvent.extractedData.diagnosis || "");
            if (!isNoisePlaceholder(diag)) {
              // tomar solo el primer diagnóstico antes del "("
              condition = diag.split(/[(;]/)[0].trim();
            }
          }
          return {
            name: clean(med.name) || "Medicamento",
            dosage: clean(med.dosage),
            frequency: clean(med.frequency),
            condition,
          };
        }).filter((m) => m.name.length > 0);

        // Vets tratantes (de masterPayload, sin emails)
        const vetMap = new Map<string, { name: string; license: string | null; clinic: string | null; lastDate: string | null }>();
        for (const ev of sortedEvents) {
          const name = getRealProfessional(ev);
          if (!name) continue;
          const mp = (ev.extractedData as Record<string, unknown>)?.masterPayload as Record<string, unknown> | undefined;
          const docInfo = mp?.document_info as Record<string, unknown> | undefined;
          const license = clean((docInfo?.veterinarian_license as string) || "");
          const clinic = cleanProfessional((docInfo?.clinic_name as string) || "");
          const key = name.toLowerCase().replace(/\s+/g, "_");
          const evDate = ev.extractedData.eventDate || ev.createdAt || null;
          const existing = vetMap.get(key);
          if (!existing) {
            vetMap.set(key, { name, license: license || null, clinic: clinic || null, lastDate: evDate });
          } else {
            vetMap.set(key, {
              ...existing,
              license: existing.license || license || null,
              clinic: existing.clinic || clinic || null,
              lastDate: evDate && (!existing.lastDate || evDate > existing.lastDate) ? evDate : existing.lastDate,
            });
          }
        }
        const vetList = Array.from(vetMap.values())
          .sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""));

        // ── 0. AI OVERVIEW (síntesis de 1-2 oraciones, arriba de todo) ─
        const overviewFindings = Array.from(new Set(
          recentEvents
            .map((ev) => clean(ev.extractedData.diagnosis || "").split(/[(;]/)[0].trim())
            .filter((d) => d && !isNoisePlaceholder(d))
        )).slice(0, 5);

        const overview = generateClinicalOverview({
          petName: activePet.name,
          activeConditionNames: activeConditions.map((c) => clean(c.normalizedName)).filter(Boolean),
          activeMedicationNames: medsWithCondition.map((m) => m.name),
          recentFindings: overviewFindings,
          hasUpcomingAppointment: futureAppointments.length > 0,
          hasPendingReviews: pendingManualReviewCount > 0,
        });

        if (overview) {
          checkY(22);
          // Card verde claro destacado
          pdf.setFillColor(224, 242, 241);
          pdf.roundedRect(M, y, CW, 20, 3, 3, "F");
          pdf.setDrawColor(26, 155, 125);
          pdf.setLineWidth(0.6);
          pdf.line(M, y, M, y + 20); // borde izquierdo accent
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(26, 155, 125);
          pdf.text("RESUMEN", M + 4, y + 5.5);
          pdf.setFontSize(9.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(7, 71, 56);
          const overviewLines = pdf.splitTextToSize(overview, CW - 8);
          pdf.text(overviewLines, M + 4, y + 11);
          // Altura dinámica si el texto ocupa más
          const cardH = Math.max(20, 11 + overviewLines.length * 4.2 + 2);
          if (cardH > 20) {
            // redibujar con altura correcta
            pdf.setFillColor(224, 242, 241);
            pdf.roundedRect(M, y, CW, cardH, 3, 3, "F");
            pdf.setDrawColor(26, 155, 125);
            pdf.line(M, y, M, y + cardH);
            pdf.setFontSize(8.5);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(26, 155, 125);
            pdf.text("RESUMEN", M + 4, y + 5.5);
            pdf.setFontSize(9.5);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(7, 71, 56);
            pdf.text(overviewLines, M + 4, y + 11);
          }
          y += cardH + 4;
        }

        // ── 1. Estado actual (1 oración) ────────────────────────────────
        sectionTitle("Estado actual");
        const stateParts: string[] = [];
        if (activeConditions.length > 0) {
          const names = activeConditions.slice(0, 3).map((c) => clean(c.normalizedName)).filter(Boolean);
          stateParts.push(`${activePet.name} está en tratamiento activo por ${names.join(", ")}.`);
        } else if (medsWithCondition.length > 0) {
          stateParts.push(`${activePet.name} tiene tratamientos en curso.`);
        } else {
          stateParts.push(`${activePet.name} no tiene condiciones activas registradas.`);
        }
        if (recentEvents.length > 0) {
          stateParts.push(`Seguimiento reciente: ${recentEvents.length} eventos en los últimos 60 días.`);
        }
        bodyText(stateParts.join(" "));

        // ── 2. Diagnósticos principales ─────────────────────────────────
        if (activeConditions.length > 0) {
          sectionTitle("Diagnósticos principales");
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(55, 65, 81);
          for (const c of activeConditions.slice(0, 6)) {
            const name = clean(c.normalizedName);
            if (!name) continue;
            bullet(name);
          }
        }

        // ── 3. Medicación actual ────────────────────────────────────────
        if (medsWithCondition.length > 0) {
          sectionTitle("Medicación actual");
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(55, 65, 81);
          for (const m of medsWithCondition.slice(0, 10)) {
            const parts = [m.name];
            if (m.dosage) parts.push(m.dosage);
            if (m.frequency) parts.push(m.frequency);
            const line = parts.join(" · ");
            const suffix = m.condition ? `  (para ${m.condition})` : "";
            bullet(line + suffix);
          }
        }

        // ── 4. Próximo turno ────────────────────────────────────────────
        if (futureAppointments.length > 0) {
          sectionTitle("Próximo turno");
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(55, 65, 81);
          for (const a of futureAppointments.slice(0, 3)) {
            const title = clean(a.title || "Turno");
            const vet = cleanProfessional(a.veterinarian);
            const when = fmtDateTime(a.date, a.time);
            const parts = [when, title];
            if (vet) parts.push(vet);
            bullet(parts.join(" · "));
          }
        }

        // ── 5. Resumen clínico reciente (últimos 60 días, narrativa) ────
        if (recentEvents.length > 0) {
          sectionTitle("Resumen clínico reciente");
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(55, 65, 81);

          // Agrupar por tipo y extraer hallazgos únicos
          const findingsByType = new Map<string, Set<string>>();
          for (const ev of recentEvents) {
            const t = toTypeLabel(ev.extractedData.documentType);
            const diag = clean(ev.extractedData.diagnosis || "");
            if (isNoisePlaceholder(diag)) continue;
            const finding = diag.split(/[(;]/)[0].trim();
            if (!finding) continue;
            if (!findingsByType.has(t)) findingsByType.set(t, new Set());
            findingsByType.get(t)!.add(finding);
          }

          // Estudios realizados (tipos únicos)
          const studyTypes = new Set<string>();
          for (const ev of recentEvents) {
            const t = ev.extractedData.documentType;
            if (["xray", "lab_test", "echocardiogram", "electrocardiogram"].includes(t)) {
              studyTypes.add(toTypeLabel(t));
            }
          }

          if (findingsByType.size > 0) {
            for (const [type, findings] of findingsByType) {
              const list = Array.from(findings).slice(0, 3).join(", ");
              bullet(`${type}: ${list}`);
            }
          }
          if (studyTypes.size > 0) {
            bullet(`Estudios realizados: ${Array.from(studyTypes).join(", ")}`);
          }
          const activeMedCount = medsWithCondition.length;
          if (activeMedCount > 0) {
            bullet(`Se iniciaron ${activeMedCount} tratamiento${activeMedCount > 1 ? "s" : ""} farmacológico${activeMedCount > 1 ? "s" : ""}`);
          }
        }

        // ── 6. Veterinarios tratantes (sin emails) ──────────────────────
        if (vetList.length > 0) {
          sectionTitle("Veterinarios tratantes");
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(55, 65, 81);
          for (const vet of vetList.slice(0, 8)) {
            const parts = [vet.name];
            if (vet.license) parts.push(`Mat. ${vet.license}`);
            if (vet.clinic) parts.push(vet.clinic);
            bullet(parts.join(" · "));
          }
        }

        // ── 7. Estudios relevantes (con hallazgos reales) ───────────────
        if (relevantStudies.length > 0) {
          sectionTitle("Estudios relevantes");
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(55, 65, 81);
          for (const ev of relevantStudies.slice(0, 6)) {
            const date = fmt(ev.extractedData.eventDate || ev.createdAt);
            const type = toTypeLabel(ev.extractedData.documentType);
            const diag = clean(ev.extractedData.diagnosis || "").split(/[(;]/)[0].trim();
            bullet(`${date} · ${type}${diag ? ` — ${diag}` : ""}`);
          }
        }

        // ── 8. Alertas (si existen) ─────────────────────────────────────
        if (activeAlerts.length > 0 || pendingManualReviewCount > 0) {
          sectionTitle("Alertas");
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(245, 158, 11);
          if (pendingManualReviewCount > 0) {
            bullet(`Hay ${pendingManualReviewCount} documento${pendingManualReviewCount > 1 ? "s" : ""} pendiente${pendingManualReviewCount > 1 ? "s" : ""} de revisión`);
          }
          if (activeAlerts.length > 0) {
            bullet(`${activeAlerts.length} alerta${activeAlerts.length > 1 ? "s" : ""} clínica${activeAlerts.length > 1 ? "s" : ""} activa${activeAlerts.length > 1 ? "s" : ""}`);
          }
        }

        // Skip resto de secciones legacy
        if (false) {
          sectionTitle("1. Perfil resumido (legacy)");

        pdf.setFontSize(8.6);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(55, 65, 81);
        const profileLines = pdf.splitTextToSize(narrativeClinicalProfile || "Sin sintesis disponible.", CW - 2);
        pdf.text(profileLines, M, y + 1);
        y += profileLines.length * 4 + 2;

        const profileHighlights = [
          activeConditions[0] ? `Condición principal: ${clean(activeConditions[0].normalizedName)}` : "",
          treatmentRows[0] ? `Tratamiento relevante: ${clean(treatmentRows[0].name)}` : "",
          studies[0] ? `Estudio destacado: ${clean(studies[0].extractedData.studyType || studies[0].title || studies[0].extractedData.suggestedTitle)}` : "",
        ].filter(Boolean);

        if (profileHighlights.length> 0) {
          for (const highlight of profileHighlights.slice(0, 3)) {
            checkY(6);
            pdf.text(`• ${highlight}`, M, y + 1);
            y += 5;
          }
        }

        y += 2;
        sectionTitle("2. Estado actual");

        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(31, 41, 55);
        pdf.text("Problemas activos", M, y);
        y += 4;
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(55, 65, 81);
        if (activeConditions.length === 0) {
          pdf.text("Sin condiciones activas registradas.", M, y + 1);
          y += 6;
        } else {
          for (const condition of activeConditions.slice(0, 8)) {
            checkY(6);
            const statusLabel = condition.status === "monitoring" ? "en seguimiento" : "activo";
            pdf.text(`• ${clean(condition.normalizedName)} (${statusLabel})`, M, y + 1);
            y += 5;
          }
        }

        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(31, 41, 55);
        pdf.text("Eventos en seguimiento", M, y + 1);
        y += 4;
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(55, 65, 81);
        if (activeAlerts.length === 0) {
          pdf.text("Sin eventos de seguimiento activos.", M, y + 1);
          y += 6;
        } else {
          for (const alert of activeAlerts.slice(0, 4)) {
            checkY(6);
            pdf.text(`• ${clean(alert.title).substring(0, 95)}`, M, y + 1);
            y += 5;
          }
        }

        const nextAppointments = [...upcoming].sort((a, b) => {
          return toTs(`${a.date || ""}T${a.time || "00:00"}`) - toTs(`${b.date || ""}T${b.time || "00:00"}`);
        });
        if (nextAppointments.length> 0) {
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(31, 41, 55);
          pdf.text("Agenda próxima", M, y + 1);
          y += 4;
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(55, 65, 81);
          for (const appointment of nextAppointments.slice(0, 5)) {
            checkY(8);
            const detail = `${fmtDateTime(appointment.date, appointment.time)} · ${clean(
              appointment.title || appointment.clinic || "Turno",
            )}${appointment.veterinarian ? ` · ${clean(appointment.veterinarian)}` : ""}`;
            const lines = pdf.splitTextToSize(`• ${detail}`, CW - 2);
            pdf.text(lines, M, y + 1);
            y += lines.length * 4 + 1;
          }
          y += 1;
        }

        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(31, 41, 55);
        pdf.text("Alertas de coherencia", M, y + 1);
        y += 4;
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(55, 65, 81);
        if (activeAlerts.length === 0) {
          pdf.text("• Sin inconsistencias lógicas detectadas.", M, y + 1);
          y += 5;
        } else {
          pdf.text(`• ${activeAlerts.length} alerta(s) activa(s).`, M, y + 1);
          y += 5;
        }
        if (pendingManualReviewCount> 0) {
          pdf.text(`• ${pendingManualReviewCount} ítem(s) pendiente(s) de validación manual.`, M, y + 1);
          y += 5;
        }

        sectionTitle("3. Tratamientos activos vinculados");
        const colWidths = [34, 20, 20, 34, 18, 34, 18];
        const headers = ["Medicamento", "Dosis", "Frecuencia", "Condición", "Inicio", "Profesional", "Estado"];
        const drawRow = (cells: string[], rowY: number, bg = [248, 250, 252] as [number, number, number]) => {
          let x = M;
          pdf.setFillColor(bg[0], bg[1], bg[2]);
          pdf.roundedRect(M, rowY, CW, 8, 1.5, 1.5, "F");
          pdf.setFontSize(6.7);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(31, 41, 55);
          cells.forEach((cell, idx) => {
            const text = clean(cell || "—").substring(0, 34);
            pdf.text(text, x + 1.3, rowY + 5.2);
            x += colWidths[idx];
          });
        };

        checkY(10);
        pdf.setFillColor(226, 232, 240);
        pdf.roundedRect(M, y, CW, 8, 1.5, 1.5, "F");
        pdf.setFontSize(6.7);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        let headerX = M;
        headers.forEach((header, idx) => {
          pdf.text(header, headerX + 1.3, y + 5.2);
          headerX += colWidths[idx];
        });
        y += 9;

        if (treatmentRows.length === 0) {
          checkY(8);
          drawRow(["Sin tratamientos activos", "—", "—", "—", "—", "—", "—"], y, [240, 253, 250]);
          y += 9;
        } else {
          for (const treatment of treatmentRows.slice(0, 12)) {
            checkY(8);
            drawRow([
              treatment.name,
              treatment.dosage,
              treatment.frequency,
              treatment.condition || "Sin asociar",
              fmt(treatment.startDate),
              treatment.professional,
              treatment.status,
            ], y, [240, 253, 250]);
            y += 9;
          }
        }

        sectionTitle("4. Condiciones registradas");
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(31, 41, 55);
        pdf.text("Activas", M, y);
        y += 4;
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(55, 65, 81);
        if (activeConditions.length === 0) {
          pdf.text("Sin condiciones activas registradas.", M, y + 1);
          y += 6;
        } else {
          for (const condition of activeConditions.slice(0, 8)) {
            checkY(8);
            const linkedTreatments = treatmentRows
              .filter((row) => row.condition.toLowerCase().includes(clean(condition.normalizedName).toLowerCase()))
              .map((row) => row.name);
            const treatmentText = linkedTreatments.length> 0 ? linkedTreatments.join(", ") : "sin tratamiento vinculado";
            const line = `• ${clean(condition.normalizedName)} · detectada: ${fmt(condition.firstDetectedDate)} · tratamientos: ${treatmentText}`;
            const lines = pdf.splitTextToSize(line, CW - 2);
            pdf.text(lines, M, y + 1);
            y += lines.length * 4 + 1;
          }
        }

        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(31, 41, 55);
        pdf.text("Resueltas", M, y + 1);
        y += 4;
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(55, 65, 81);
        if (resolvedConditions.length === 0) {
          pdf.text("Sin condiciones resueltas registradas.", M, y + 1);
          y += 6;
        } else {
          for (const condition of resolvedConditions.slice(0, 6)) {
            checkY(6);
            pdf.text(`• ${clean(condition.normalizedName)} · última vez: ${fmt(condition.lastDetectedDate)}`, M, y + 1);
            y += 5;
          }
        }

        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(31, 41, 55);
        pdf.text("Antecedentes", M, y + 1);
        y += 4;
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(55, 65, 81);
        const historicalStudiesCount = studies.filter((event) => toTs(event.extractedData.eventDate || event.createdAt) < toTs(new Date().toISOString()) - 1000 * 60 * 60 * 24 * 180).length;
        pdf.text(`• Eventos históricos registrados: ${resolvedConditions.length + historicalStudiesCount}`, M, y + 1);
        y += 5;
        pdf.text(`• Estudios complementarios acumulados: ${studies.length}`, M, y + 1);
        y += 6;

        sectionTitle("5. Estudios complementarios");
        if (studies.length === 0) {
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(120, 120, 120);
          pdf.text("No hay estudios complementarios tipificados en el período.", M, y + 2);
          y += 8;
        } else {
          for (const event of studies.slice(0, 12)) {
            checkY(11);
            const extracted = event.extractedData;
            const studyTitle = clean(extracted.studyType || event.title || extracted.suggestedTitle || toTypeLabel(extracted.documentType));
            const detailSource = clean(extracted.provider || extracted.clinic || "Sin referencia");
            const summary = getCanonicalSummary(event).substring(0, 110);
            pdf.setFillColor(248, 250, 252);
            pdf.roundedRect(M, y, CW, 10, 1.8, 1.8, "F");
            pdf.setFontSize(8);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(31, 41, 55);
            pdf.text(`${fmt(extracted.eventDate || event.createdAt)} · ${studyTitle.substring(0, 70)}`, M + 2, y + 4.5);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(71, 85, 105);
            pdf.setFontSize(7.2);
            const lineTwo = `${detailSource}${summary ? ` · ${summary}` : ""}`;
            pdf.text(lineTwo.substring(0, 116), M + 2, y + 8);
            y += 11;
          }
        }

        // ── Profesionales que atendieron ──────────────────────────────────
        sectionTitle("6. Profesionales que atendieron a " + activePet.name);

        // Extraer y deduplicar vets de todos los eventos médicos
        const vetMap = new Map<string, { name: string; license: string | null; clinic: string | null; address: string | null; lastDate: string | null; count: number }>();
        for (const ev of sortedEvents) {
          const mp = (ev.extractedData as Record<string, unknown>)?.masterPayload as Record<string, unknown> | undefined;
          const docInfo = mp?.document_info as Record<string, unknown> | undefined;
          const name = clean((docInfo?.veterinarian_name as string) || "");
          if (!name) continue;
          const key = name.toLowerCase().replace(/\s+/g, "_");
          const license = clean((docInfo?.veterinarian_license as string) || "");
          const clinic = clean((docInfo?.clinic_name as string) || "");
          const address = clean((docInfo?.clinic_address as string) || "");
          const evDate = (ev.extractedData.eventDate as string | null) || ev.createdAt || null;
          const existing = vetMap.get(key);
          if (!existing) {
            vetMap.set(key, { name, license: license || null, clinic: clinic || null, address: address || null, lastDate: evDate, count: 1 });
          } else {
            vetMap.set(key, {
              ...existing,
              license: existing.license || license || null,
              clinic: existing.clinic || clinic || null,
              address: existing.address || address || null,
              lastDate: evDate && (!existing.lastDate || evDate > existing.lastDate) ? evDate : existing.lastDate,
              count: existing.count + 1,
            });
          }
        }
        const vetList = Array.from(vetMap.values()).sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""));

        if (vetList.length === 0) {
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(120, 120, 120);
          pdf.text("No se encontraron profesionales identificados en los documentos.", M, y + 2);
          y += 8;
        } else {
          for (const vet of vetList.slice(0, 10)) {
            checkY(14);
            pdf.setFillColor(240, 253, 250);
            pdf.roundedRect(M, y, CW, 12, 1.8, 1.8, "F");
            pdf.setFontSize(8.5);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(7, 71, 56);
            pdf.text(vet.name, M + 3, y + 5);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7.5);
            pdf.setTextColor(71, 85, 105);
            const details: string[] = [];
            if (vet.license) details.push(`Mat. ${vet.license}`);
            if (vet.clinic) details.push(vet.clinic);
            if (vet.address) details.push(vet.address);
            details.push(`${vet.count} doc${vet.count > 1 ? "s" : ""} · último: ${fmt(vet.lastDate)}`);
            pdf.text(details.join("  ·  ").substring(0, 115), M + 3, y + 9.5);
            y += 13;
          }
        }
        y += 3;

        sectionTitle("7. Línea de tiempo (resumen)");
        const timelineHeaders = ["Fecha", "Tipo", "Referencia", "Resumen"];
        const timelineWidths = [24, 20, 48, 86];
        checkY(9);
        pdf.setFillColor(226, 232, 240);
        pdf.roundedRect(M, y, CW, 8, 1.5, 1.5, "F");
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        let tx = M;
        timelineHeaders.forEach((header, idx) => {
          pdf.text(header, tx + 1.2, y + 5.2);
          tx += timelineWidths[idx];
        });
        y += 9;

        for (const event of sortedEvents.slice(0, 16)) {
          checkY(8);
          const extracted = event.extractedData;
          pdf.setFillColor(248, 250, 252);
          pdf.roundedRect(M, y, CW, 8, 1.5, 1.5, "F");
          pdf.setFontSize(6.8);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(31, 41, 55);

          const cells = [
            fmt(extracted.eventDate || event.createdAt),
            toTypeLabel(extracted.documentType),
            clean(extracted.provider || extracted.clinic || "—"),
            getCanonicalSummary(event),
          ];

          let cx = M;
          cells.forEach((cell, idx) => {
            const maxLen = idx === 3 ? 72 : idx === 2 ? 40 : 18;
            pdf.text(cell.substring(0, maxLen), cx + 1.2, y + 5.2);
            cx += timelineWidths[idx];
          });
          y += 9;
        }
        } // cierre if (false) legacy
      }

      // ──────────────────────────────────────────────────────────────────────
      // CARNET DE VACUNACIÓN (fallback local — solo si AI no renderizó)
      // ──────────────────────────────────────────────────────────────────────
      if (!aiSections && selectedReport === "vaccine") {
        const vaccines = events.filter(e => e.extractedData.documentType === "vaccine");
        checkY(16);
        pdf.setFontSize(10.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(26, 155, 125);
        pdf.text("Vacunas registradas", M, y);
        y += 5;
        pdf.setDrawColor(26, 155, 125);
        pdf.line(M, y, M + CW, y);
        y += 4;

        if (vaccines.length === 0) {
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(150, 150, 150);
          pdf.text("No hay vacunas registradas en el historial.", M, y + 6);
          y += 12;
        } else {
          for (const vac of vaccines) {
            const d = vac.extractedData;
            // Nombre de la vacuna: título del evento o diagnóstico o título genérico
            const vacName = clean(vac.title || d.diagnosis || d.suggestedTitle) || "Vacuna";
            const rowH = d.nextAppointmentDate ? 20 : 15;
            checkY(rowH + 2);
            pdf.setFillColor(240, 253, 250);
            pdf.roundedRect(M, y, CW, rowH, 2, 2, "F");
            pdf.setFontSize(8.5);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(30, 30, 30);
            pdf.text(vacName.substring(0, 60), M + 3, y + 6);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(90, 90, 90);
            pdf.setFontSize(7.5);
            pdf.text(`Aplicada: ${fmt(d.eventDate || vac.createdAt)}`, M + 3, y + 12);
            if (d.provider) pdf.text(`Ref: ${clean(d.provider).substring(0, 30)}`, COL2, y + 12);
            if (d.nextAppointmentDate) {
              pdf.setTextColor(16, 185, 129);
              pdf.text(`Próximo refuerzo: ${fmt(d.nextAppointmentDate)}`, M + 3, y + 17);
            }
            y += rowH + 2;
          }
        }
      }

      // ──────────────────────────────────────────────────────────────────────
      // PLAN DE TRATAMIENTO (fallback local — solo si AI no renderizó)
      // ──────────────────────────────────────────────────────────────────────
      if (!aiSections && selectedReport === "treatment") {
        // Medicaciones
        checkY(16);
        pdf.setFontSize(10.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(26, 155, 125);
        pdf.text("Medicaciones activas", M, y);
        y += 5;
        pdf.setDrawColor(26, 155, 125);
        pdf.line(M, y, M + CW, y);
        y += 4;

        const treatmentRows = treatments.length> 0
          ? treatments
          : medications.map((item) => ({
              id: item.id,
              normalizedName: item.name,
              dosage: item.dosage,
              frequency: item.frequency,
              startDate: item.startDate,
              endDate: item.endDate,
              status: item.active ? "active" : "completed",
            }));

        if (treatmentRows.length === 0) {
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(150, 150, 150);
          pdf.text("No hay medicaciones activas.", M, y + 6);
          y += 12;
        } else {
          for (const med of treatmentRows) {
            const rowH = (med.startDate || med.endDate) ? 20 : 13;
            checkY(rowH + 2);
            pdf.setFillColor(240, 253, 250);
            pdf.roundedRect(M, y, CW, rowH, 2, 2, "F");
            pdf.setFontSize(8.5);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(30, 30, 30);
            pdf.text(clean((med as any).name || (med as any).normalizedName).substring(0, 50), M + 3, y + 6);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(90, 90, 90);
            pdf.setFontSize(7.5);
            pdf.text(`Dosis: ${clean((med as any).dosage) || "—"}`, M + 3, y + 11);
            pdf.text(`Frec: ${clean((med as any).frequency) || "—"}`, COL2, y + 11);
            if (med.startDate || med.endDate) {
              pdf.text(`Inicio: ${fmt(med.startDate)}`, M + 3, y + 17);
              pdf.text(`Fin: ${med.endDate ? fmt(med.endDate) : "Crónico"}`, COL2, y + 17);
            }
            y += rowH + 2;
          }
        }

        // Próximas citas
        if (upcoming.length> 0) {
          y += 2;
          checkY(16);
          pdf.setFontSize(10.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(26, 155, 125);
          pdf.text("Próximas citas", M, y);
          y += 5;
          pdf.setDrawColor(26, 155, 125);
          pdf.line(M, y, M + CW, y);
          y += 4;

          for (const apt of upcoming.slice(0, 8)) {
            checkY(14);
            pdf.setFillColor(240, 253, 250);
            pdf.roundedRect(M, y, CW, 12, 2, 2, "F");
            pdf.setFontSize(8.5);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(30, 30, 30);
            pdf.text(clean(apt.title || "Cita").substring(0, 55), M + 3, y + 5);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(90, 90, 90);
            pdf.setFontSize(7.5);
            const aptInfo = `${fmt(apt.date)}${apt.time ? " — " + apt.time : ""}${apt.veterinarian ? " · " + clean(apt.veterinarian) : ""}`;
            pdf.text(aptInfo.substring(0, 70), M + 3, y + 10);
            y += 13;
          }
        }
      }

      // ── ID DE VERIFICACIÓN ─────────────────────────────────────────────────
      let reportId: string | null = null;
      try {
        reportId = await saveVerifiedReport({
          petId: activePet.id, petName: activePet.name,
          petBreed: activePet.breed || "No registrada",
          ownerName: clean(userFullName || userName || user?.email) || "No registrado",
          summary: reportSummaryForVerification || narrativeClinicalProfile, reportType: selectedReport,
          sourceEventCount: events.length, sourceMedicationCount: medications.length,
          sourceAppointmentCount: upcoming.length,
          sourceEventIds: events.map(e => e.id),
        });
      } catch { /* silencioso */ }

      if (reportId) {
        checkY(16);
        y += 2;
        pdf.setFillColor(224, 242, 241);
        pdf.roundedRect(M, y, CW, 12, 2, 2, "F");
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(7, 71, 56);
        pdf.text("Identificador del reporte", M + 3, y + 5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(55, 65, 81);
        pdf.text(`ID: ${reportId}`, M + 3, y + 9.5);
        y += 14;
      }

      // ── FOOTER EN TODAS LAS PÁGINAS ────────────────────────────────────────
      const totalPages = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFillColor(248, 249, 252);
        pdf.rect(0, 282, PW, 15, "F");
        pdf.setFontSize(6.5);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(120, 120, 120);
        const footerByState = {
          empty: "Pessy organiza información cargada por el tutor. Aún no hay documentos en este perfil.",
          validated: "Información parcialmente validada por veterinarios. Conserva valor de referencia. No reemplaza un historial clínico oficial.",
          mixed: "Información parcialmente validada. Los ítems sin marca de validación fueron cargados por el tutor sin revisión profesional.",
          not_validated: "Pessy organiza la información cargada por el tutor. No reemplaza un historial clínico oficial ni constituye diagnóstico veterinario.",
        } as const;
        pdf.text(
          footerByState[pillState],
          PW / 2,
          287,
          { align: "center", maxWidth: PW - 2 * M }
        );
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(150, 150, 150);
        pdf.text("Generado por PESSY — pessy.app", M, 293);
        pdf.text(`Página ${i} de ${totalPages}`, PW - M, 293, { align: "right" });
      }

      const fileName = `PESSY_${TITLE_MAP[selectedReport].replace(/ /g, "_")}_${activePet.name}_${new Date().toISOString().slice(0, 10)}.pdf`;
      await savePdfWithFallback(pdf, fileName);
      onClose();

    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("No se pudo generar el PDF. Intentá de nuevo.");
    } finally {
      setIsGenerating(false);
    }
  };

  const options = [
    { id: "health" as ReportType, icon: "description", title: "Resumen Estructurado de Cuidado", subtitle: "Estado actual, recordatorios y cronologia", color: "text-[#074738]", bg: "bg-[#E0F2F1]", border: "border-[#1A9B7D]", dot: "bg-[#1A9B7D]" },
    { id: "vaccine" as ReportType, icon: "vaccines", title: "Cartilla de Vacunación", subtitle: "Cobertura vigente y próximos refuerzos", color: "text-[#074738]", bg: "bg-[#E0F2F1]", border: "border-[#1A9B7D]", dot: "bg-[#1A9B7D]" },
    { id: "treatment" as ReportType, icon: "medication", title: "Plan de Cuidados", subtitle: "Rutinas actuales y proximos pasos sugeridos", color: "text-[#074738]", bg: "bg-[#E0F2F1]", border: "border-[#1A9B7D]", dot: "bg-[#1A9B7D]" },
  ];

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/60" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] max-h-[82vh] flex flex-col max-w-md mx-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700 cursor-pointer" onClick={onClose} />
        </div>
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-[#E0F2F1] dark:bg-slate-800">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Exportar PDF</h2>
          <p className="text-sm text-slate-500 mt-0.5">Resumen legible de tu mascota para compartir cuando lo necesites</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {options.map((opt) => {
            const selected = selectedReport === opt.id;
            return (
              <button key={opt.id} onClick={() => setSelectedReport(opt.id)}
                className={`w-full p-4 rounded-[16px] border-2 flex items-center gap-4 active:scale-[0.97] transition-all text-left ${selected ? `${opt.border} ${opt.bg}` : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50"}`}>
                <div className={`size-10 rounded-[12px] flex items-center justify-center ${selected ? opt.bg : "bg-[#E0F2F1] dark:bg-slate-700"}`}>
                  <MaterialIcon name={opt.icon} className={`text-xl ${selected ? opt.color : "text-slate-500"}`} />
                </div>
                <div className="flex-1">
                  <p className={`font-bold text-sm ${selected ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>{opt.title}</p>
                  <p className="text-xs text-slate-500">{opt.subtitle}</p>
                </div>
                <div className={`size-5 rounded-full border-2 flex items-center justify-center ${selected ? opt.border : "border-slate-300"}`}>
                  {selected && <div className={`size-2.5 rounded-full ${opt.dot}`} />}
                </div>
              </button>
            );
          })}
        </div>
        <div className="px-5 pb-8 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button onClick={generatePDF} disabled={isGenerating}
            className="w-full h-14 rounded-[14px] bg-[#074738] text-white font-bold text-base flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(26,155,125,0.3)] disabled:opacity-60 active:scale-[0.97] transition-all">
            {isGenerating
              ? <><div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Generando PDF...</span></>
              : <><MaterialIcon name="download" className="text-xl" /><span>Descargar PDF</span></>}
          </button>
        </div>
      </div>
    </>
  );
}
