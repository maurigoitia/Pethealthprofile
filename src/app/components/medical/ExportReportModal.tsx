import { useState } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";
import { useAuth } from "../../contexts/AuthContext";
import { formatDateSafe } from "../../utils/dateUtils";
import { loadJsPdf, savePdfWithFallback } from "../../utils/pdfExport";

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ReportType = "health" | "vaccine" | "treatment";

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
      .replace(/\s+/g, " ")
      .trim();

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
    health: "Informe de Salud",
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
      const pessyNote = (text: string) => {
        checkY(8);
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(13, 148, 136);
        pdf.text(`★ ${text}`, M, y);
        pdf.setTextColor(25, 25, 25);
        pdf.setFont("helvetica", "normal");
        y += 6;
      };

      // ── HEADER ────────────────────────────────────────────────────────────
      pdf.setFillColor(13, 148, 136);
      pdf.rect(0, 0, PW, 28, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("PESSY", M, 17);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Resumen de salud de ${activePet.name}`, M, 23);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text(TITLE_MAP[selectedReport], PW - M, 15, { align: "right" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.text(`Generado: ${new Date().toLocaleDateString("es-AR")}`, PW - M, 21, { align: "right" });

      y = 36;
      pdf.setTextColor(25, 25, 25);

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

      // ──────────────────────────────────────────────────────────────────────
      // REPORTE DE SALUD COMPLETO
      // ──────────────────────────────────────────────────────────────────────
      if (selectedReport === "health") {
        const sectionTitle = (title: string) => {
          checkY(16);
          pdf.setFontSize(10.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(13, 148, 136);
          pdf.text(title, M, y);
          y += 5;
          pdf.setDrawColor(13, 148, 136);
          pdf.setLineWidth(0.4);
          pdf.line(M, y, M + CW, y);
          y += 4;
        };

        sectionTitle("1. Perfil resumido");

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

        pessyNote(
          activeConditions.length > 0
            ? `${activePet.name} tiene ${activeConditions.length} condición(es) activa(s) registrada(s).`
            : `${activePet.name} no tiene condiciones activas registradas.`
        );

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

        pessyNote(
          treatmentRows.length > 0
            ? `${treatmentRows.length} tratamiento(s) activo(s) en seguimiento.`
            : "Sin tratamientos activos registrados."
        );

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

        sectionTitle("6. Línea de tiempo (resumen)");
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
      }

      // ──────────────────────────────────────────────────────────────────────
      // CARNET DE VACUNACIÓN
      // ──────────────────────────────────────────────────────────────────────
      if (selectedReport === "vaccine") {
        const vaccines = events.filter(e => e.extractedData.documentType === "vaccine");
        checkY(16);
        pdf.setFontSize(10.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(13, 148, 136);
        pdf.text("Vacunas registradas", M, y);
        y += 5;
        pdf.setDrawColor(13, 148, 136);
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

        const overdueVaccines = vaccines.filter(v =>
          v.extractedData.nextAppointmentDate &&
          Date.parse(v.extractedData.nextAppointmentDate) < Date.now()
        );
        const upcomingVaccines = vaccines.filter(v =>
          v.extractedData.nextAppointmentDate &&
          Date.parse(v.extractedData.nextAppointmentDate) >= Date.now() &&
          Date.parse(v.extractedData.nextAppointmentDate) < Date.now() + 30 * 24 * 60 * 60 * 1000
        );
        if (overdueVaccines.length > 0) {
          pessyNote(`${overdueVaccines.length} refuerzo(s) vencido(s) — revisar con el veterinario.`);
        } else if (upcomingVaccines.length > 0) {
          pessyNote(`${upcomingVaccines.length} refuerzo(s) próximo(s) en los próximos 30 días.`);
        } else {
          pessyNote(`${vaccines.length} vacuna(s) registrada(s).`);
        }
      }

      // ──────────────────────────────────────────────────────────────────────
      // PLAN DE TRATAMIENTO
      // ──────────────────────────────────────────────────────────────────────
      if (selectedReport === "treatment") {
        // Medicaciones
        checkY(16);
        pdf.setFontSize(10.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(13, 148, 136);
        pdf.text("Medicaciones activas", M, y);
        y += 5;
        pdf.setDrawColor(13, 148, 136);
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
          pdf.setTextColor(13, 148, 136);
          pdf.text("Próximas citas", M, y);
          y += 5;
          pdf.setDrawColor(13, 148, 136);
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
          summary: reportSummaryForVerification || executiveSummary, reportType: selectedReport,
          sourceEventCount: events.length, sourceMedicationCount: medications.length,
          sourceAppointmentCount: upcoming.length,
          sourceEventIds: events.map(e => e.id),
        });
      } catch { /* silencioso */ }

      if (reportId) {
        checkY(20);
        y += 2;
        pdf.setFillColor(236, 253, 245);
        pdf.roundedRect(M, y, CW, 16, 2, 2, "F");
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(5, 150, 105);
        pdf.text("Verificación del reporte", M + 3, y + 6);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(55, 65, 81);
        pdf.text(`ID: ${reportId}`, M + 3, y + 11);
        pdf.text(`pessy.app/verify/${reportId}`, M + 3, y + 15);
        y += 18;
      }

      // ── FOOTER EN TODAS LAS PÁGINAS ────────────────────────────────────────
      const totalPages = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFillColor(248, 249, 252);
        pdf.rect(0, 285, PW, 12, "F");
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(150, 150, 150);
        pdf.text("Generado por PESSY — pessy.app", M, 291);
        pdf.text(`Página ${i} de ${totalPages}`, PW - M, 291, { align: "right" });
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
    { id: "health" as ReportType, icon: "description", title: "Resumen Estructurado de Cuidado", subtitle: "Estado actual, recordatorios y cronologia", color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-500", dot: "bg-teal-600" },
    { id: "vaccine" as ReportType, icon: "vaccines", title: "Cartilla de Vacunación", subtitle: "Cobertura vigente y próximos refuerzos", color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-500", dot: "bg-teal-600" },
    { id: "treatment" as ReportType, icon: "medication", title: "Plan de Cuidados", subtitle: "Rutinas actuales y proximos pasos sugeridos", color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-500", dot: "bg-teal-600" },
  ];

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/60" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-xl max-h-[82vh] flex flex-col max-w-md mx-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700 cursor-pointer" onClick={onClose} />
        </div>
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-teal-50 to-white dark:from-slate-800 dark:to-slate-900">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Exportar PDF</h2>
          <p className="text-sm text-slate-500 mt-0.5">Resumen legible de tu mascota para compartir cuando lo necesites</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {options.map((opt) => {
            const selected = selectedReport === opt.id;
            return (
              <button key={opt.id} onClick={() => setSelectedReport(opt.id)}
                className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all text-left ${selected ? `${opt.border} ${opt.bg}` : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"}`}>
                <div className={`size-10 rounded-xl flex items-center justify-center ${selected ? opt.bg : "bg-slate-200 dark:bg-slate-700"}`}>
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
            className="w-full h-14 rounded-2xl bg-teal-600 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 disabled:opacity-60 active:scale-[0.98] transition-transform">
            {isGenerating
              ? <><div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Generando PDF...</span></>
              : <><MaterialIcon name="download" className="text-xl" /><span>Descargar PDF</span></>}
          </button>
        </div>
      </div>
    </>
  );
}
