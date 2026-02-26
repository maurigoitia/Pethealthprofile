import { useState } from "react";
import { motion } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";
import { usePet } from "../contexts/PetContext";
import { useMedical } from "../contexts/MedicalContext";
import { useAuth } from "../contexts/AuthContext";
import { generateClinicalReportSynthesis } from "../services/analysisService";
import jsPDF from "jspdf";
import { formatDateSafe } from "../utils/dateUtils";

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

  const TITLE_MAP: Record<ReportType, string> = {
    health: "Reporte de Salud Completo",
    vaccine: "Carnet de Vacunación",
    treatment: "Plan de Tratamiento",
  };

  const generatePDF = async () => {
    if (!activePet) return;
    setIsGenerating(true);

    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const PW = 210;
      const M = 16;            // margen
      const CW = PW - M * 2;  // ancho de contenido
      const COL2 = M + CW / 2; // segunda columna
      let y = 0;

      const newPage = () => { pdf.addPage(); y = 20; };
      const checkY = (need = 14) => { if (y + need > 278) newPage(); };

      // ── HEADER ────────────────────────────────────────────────────────────
      pdf.setFillColor(13, 148, 136);
      pdf.rect(0, 0, PW, 28, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("PESSY", M, 17);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text("Expediente clinico certificado", M, 23);
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

      // ── SÍNTESIS IA (con timeout de seguridad) ────────────────────────────
      let executiveSummary = "";
      let clinicalNarrative = "";
      let carePlan = "";
      let reportSummaryForVerification = "";

      try {
        const synthesis = await Promise.race([
          generateClinicalReportSynthesis({
            reportType: selectedReport,
            pet: { id: activePet.id, name: activePet.name, breed: activePet.breed || "", species: activePet.species || "", age: activePet.age || "" },
            ownerName: clean(userFullName || userName || user?.email),
            events, medications, appointments,
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000)),
        ]);
        executiveSummary = clean(synthesis.executiveSummary);
        clinicalNarrative = clean(synthesis.clinicalNarrative);
        carePlan = clean(synthesis.carePlan);
      } catch {
        executiveSummary = events.length === 0
          ? `${activePet.name} aún no tiene documentos médicos cargados.`
          : `${activePet.name} tiene ${events.length} documento${events.length !== 1 ? "s" : ""} médico${events.length !== 1 ? "s" : ""}, ${medications.length} medicación${medications.length !== 1 ? "es" : ""} activa${medications.length !== 1 ? "s" : ""} y ${upcoming.length} turno${upcoming.length !== 1 ? "s" : ""} próximo${upcoming.length !== 1 ? "s" : ""}.`;
        clinicalNarrative = "La lectura se construyó con la evidencia disponible en el historial. Esta síntesis no reemplaza evaluación clínica presencial.";
        carePlan = "Mantener adherencia a medicación, registrar cambios clínicos y asistir a controles programados.";
      }
      reportSummaryForVerification = `${executiveSummary} ${clinicalNarrative} ${carePlan}`.trim();

      // ── BLOQUE RESUMEN CLÍNICO ─────────────────────────────────────────────
      checkY(20);
      pdf.setFontSize(10.5);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(13, 148, 136);
      pdf.text("Lectura clínica consolidada", M, y);
      y += 5;
      pdf.setDrawColor(13, 148, 136);
      pdf.setLineWidth(0.4);
      pdf.line(M, y, M + CW, y);
      y += 4;

      const paragraph1 = `Resumen ejecutivo: ${executiveSummary || "Sin resumen disponible."}`;
      const paragraph2 = `Narrativa clínica: ${clinicalNarrative || "Sin narrativa disponible."}`;
      const paragraph3 = `Plan de cuidado: ${carePlan || "Sin plan de cuidado disponible."}`;
      const summaryLines = [
        ...pdf.splitTextToSize(paragraph1, CW - 8),
        "",
        ...pdf.splitTextToSize(paragraph2, CW - 8),
        "",
        ...pdf.splitTextToSize(paragraph3, CW - 8),
      ];
      const summaryBoxH = Math.max(24, summaryLines.length * 4.4 + 8);
      checkY(summaryBoxH + 3);
      pdf.setFillColor(240, 253, 250);
      pdf.roundedRect(M, y, CW, summaryBoxH, 2, 2, "F");
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(55, 65, 81);
      pdf.text(summaryLines, M + 4, y + 6);
      y += summaryBoxH + 5;

      // ──────────────────────────────────────────────────────────────────────
      // REPORTE DE SALUD COMPLETO
      // ──────────────────────────────────────────────────────────────────────
      if (selectedReport === "health") {
        // Stats bar
        checkY(18);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(M, y, CW, 14, 2, 2, "F");
        const SW = CW / 3;
        const statsData = [
          { val: String(events.length), label: "Documentos" },
          { val: String(activeConditions.length), label: "Condiciones activas" },
          { val: String(activeAlerts.length), label: "Alertas activas" },
        ];
        statsData.forEach(({ val, label }, i) => {
          const cx = M + SW * i + SW / 2;
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(30, 30, 30);
          pdf.text(val, cx, y + 6, { align: "center" });
          pdf.setFontSize(7);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(120, 120, 120);
          pdf.text(label, cx, y + 11, { align: "center" });
        });
        y += 18;

        // Condiciones consolidadas (entidad viva)
        if (activeConditions.length > 0) {
          checkY(16);
          pdf.setFontSize(10.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(13, 148, 136);
          pdf.text("Condiciones clínicas activas", M, y);
          y += 5;
          pdf.setDrawColor(13, 148, 136);
          pdf.line(M, y, M + CW, y);
          y += 4;

          for (const condition of activeConditions) {
            checkY(15);
            pdf.setFillColor(240, 253, 250);
            pdf.roundedRect(M, y, CW, 13, 2, 2, "F");
            pdf.setFontSize(8.5);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(30, 30, 30);
            pdf.text(clean(condition.normalizedName).substring(0, 55), M + 3, y + 5);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7.5);
            pdf.setTextColor(90, 90, 90);
            pdf.text(`Patrón: ${condition.pattern} · Ocurrencias: ${condition.occurrencesCount}`, M + 3, y + 10);
            pdf.text(`Último hallazgo: ${fmt(condition.lastDetectedDate)}`, COL2, y + 10);
            y += 14;
          }
        }

        if (resolvedConditions.length > 0) {
          y += 2;
          checkY(16);
          pdf.setFontSize(10.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(13, 148, 136);
          pdf.text("Condiciones históricas/resueltas", M, y);
          y += 5;
          pdf.setDrawColor(13, 148, 136);
          pdf.line(M, y, M + CW, y);
          y += 4;

          for (const condition of resolvedConditions.slice(0, 8)) {
            checkY(12);
            pdf.setFillColor(248, 249, 252);
            pdf.roundedRect(M, y, CW, 10, 2, 2, "F");
            pdf.setFontSize(8);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(80, 80, 80);
            pdf.text(`${clean(condition.normalizedName)} · última vez: ${fmt(condition.lastDetectedDate)}`, M + 3, y + 6);
            y += 11;
          }
        }

        if (activeAlerts.length > 0) {
          y += 2;
          checkY(16);
          pdf.setFontSize(10.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(13, 148, 136);
          pdf.text("Alertas clínicas activas", M, y);
          y += 5;
          pdf.setDrawColor(13, 148, 136);
          pdf.line(M, y, M + CW, y);
          y += 4;

          for (const alert of activeAlerts.slice(0, 10)) {
            const rowH = 14;
            checkY(rowH + 2);
            pdf.setFillColor(254, 242, 242);
            pdf.roundedRect(M, y, CW, rowH, 2, 2, "F");
            pdf.setFontSize(8);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(153, 27, 27);
            pdf.text(`${clean(alert.title).substring(0, 62)}`, M + 3, y + 5);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(120, 120, 120);
            pdf.setFontSize(7);
            pdf.text(`${clean(alert.description).substring(0, 90)}`, M + 3, y + 10);
            y += rowH + 1;
          }
        }

        // Historial médico como índice de evidencia (no fuente principal)
        if (events.length > 0) {
          checkY(16);
          pdf.setFontSize(10.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(13, 148, 136);
          pdf.text("Índice de evidencia documental", M, y);
          y += 5;
          pdf.setDrawColor(13, 148, 136);
          pdf.line(M, y, M + CW, y);
          y += 4;

          const typeLabel: Record<string, string> = {
            vaccine: "Vacuna", lab_test: "Análisis", xray: "Radiografía", checkup: "Consulta",
            medication: "Medicación", surgery: "Cirugía", echocardiogram: "Ecocardiograma",
            electrocardiogram: "ECG", appointment: "Turno", other: "Otro",
          };

          for (const ev of events) {
            const d = ev.extractedData;
            const rowH = 20;
            checkY(rowH + 2);
            pdf.setFillColor(248, 249, 252);
            pdf.roundedRect(M, y, CW, rowH, 2, 2, "F");
            pdf.setFontSize(8.5);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(30, 30, 30);
            const evTitle = clean(ev.title || d.suggestedTitle) || typeLabel[d.documentType] || "Evento";
            pdf.text(evTitle.substring(0, 60), M + 3, y + 6);
            pdf.setFontSize(7.5);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(90, 90, 90);
            pdf.text(`Tipo: ${typeLabel[d.documentType] || "—"}`, M + 3, y + 12);
            pdf.text(`Fecha: ${fmt(d.eventDate || ev.createdAt)}`, COL2, y + 12);
            if (d.provider) {
              pdf.text(`Profesional: ${clean(d.provider).substring(0, 40)}`, M + 3, y + 17);
            }
            if (d.diagnosis && !d.provider) {
              pdf.text(`Dx: ${clean(d.diagnosis).substring(0, 60)}`, M + 3, y + 17);
            }
            y += rowH + 2;
          }
        }

        // Tratamientos activos consolidados
        if (activeTreatments.length > 0 || medications.length > 0) {
          y += 2;
          checkY(16);
          pdf.setFontSize(10.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(13, 148, 136);
          pdf.text("Tratamientos activos", M, y);
          y += 5;
          pdf.setDrawColor(13, 148, 136);
          pdf.line(M, y, M + CW, y);
          y += 4;

          const sourceTreatments = activeTreatments.length > 0
            ? activeTreatments.map((item) => ({
                name: item.normalizedName,
                dosage: item.dosage,
                frequency: item.frequency,
              }))
            : medications.map((item) => ({
                name: item.name,
                dosage: item.dosage,
                frequency: item.frequency,
              }));

          for (const med of sourceTreatments) {
            checkY(14);
            pdf.setFillColor(240, 253, 250);
            pdf.roundedRect(M, y, CW, 12, 2, 2, "F");
            pdf.setFontSize(8.5);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(30, 30, 30);
            pdf.text(clean(med.name).substring(0, 50), M + 3, y + 5);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(90, 90, 90);
            pdf.setFontSize(7.5);
            pdf.text(`${clean(med.dosage) || "—"} — ${clean(med.frequency) || "—"}`, M + 3, y + 10);
            y += 13;
          }
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
            if (d.provider) pdf.text(`Vet: ${clean(d.provider).substring(0, 30)}`, COL2, y + 12);
            if (d.nextAppointmentDate) {
              pdf.setTextColor(16, 185, 129);
              pdf.text(`Próximo refuerzo: ${fmt(d.nextAppointmentDate)}`, M + 3, y + 17);
            }
            y += rowH + 2;
          }
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

        const treatmentRows = treatments.length > 0
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
        if (upcoming.length > 0) {
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
      pdf.save(fileName);
      onClose();

    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("No se pudo generar el PDF. Intentá de nuevo.");
    } finally {
      setIsGenerating(false);
    }
  };

  const options = [
    { id: "health" as ReportType, icon: "description", title: "Reporte de Salud Narrativo", subtitle: "Lectura clínica clara y cronológica", color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-500", dot: "bg-teal-600" },
    { id: "vaccine" as ReportType, icon: "vaccines", title: "Cartilla de Vacunación", subtitle: "Cobertura vigente y próximos refuerzos", color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-500", dot: "bg-teal-600" },
    { id: "treatment" as ReportType, icon: "medication", title: "Plan de Tratamiento", subtitle: "Terapias actuales y controles sugeridos", color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-500", dot: "bg-teal-600" },
  ];

  if (!isOpen) return null;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-slate-900/60" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-xl max-h-[82vh] flex flex-col max-w-md mx-auto"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700 cursor-pointer" onClick={onClose} />
        </div>
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-teal-50 to-white dark:from-slate-800 dark:to-slate-900">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Exportar PDF</h2>
          <p className="text-sm text-slate-500 mt-0.5">Expediente clínico legible para compartir con veterinario</p>
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
      </motion.div>
    </>
  );
}
