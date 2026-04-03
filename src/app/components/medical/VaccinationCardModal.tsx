import { MaterialIcon } from "../shared/MaterialIcon";
import { PetPhoto } from "../pet/PetPhoto";
import { loadJsPdf, savePdfWithFallback } from "../../utils/pdfExport";

interface Vaccine {
  id: number;
  name: string;
  date: string;
  nextDue: string;
  veterinarian: string;
  status: "current" | "due-soon" | "overdue";
  lotNumber?: string | null;
  serialNumber?: string | null;
}

interface VaccinationCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNearbyVets?: () => void;
  petData: {
    name: string;
    breed: string;
    birthDate: string;
    microchip: string;
    photo: string;
  };
  vaccines: Vaccine[];
}

const STATUS_CONFIG = {
  current:  { label: "Al día",   bg: "bg-emerald-500",  text: "text-emerald-700", dot: "#10b981" },
  "due-soon": { label: "Próxima", bg: "bg-amber-500",    text: "text-amber-700",   dot: "#d97706" },
  overdue:  { label: "Vencida",  bg: "bg-red-500",      text: "text-red-700",     dot: "#dc2626" },
};

export function VaccinationCardModal({ isOpen, onClose, onOpenNearbyVets, petData, vaccines }: VaccinationCardModalProps) {

  const handleDownloadPDF = async () => {
    const JsPdf = await loadJsPdf();
    const pdf = new JsPdf({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 16;
    const contentW = pageW - margin * 2;
    let y = 0;

    // Header verde
    pdf.setFillColor(27, 94, 79);
    pdf.rect(0, 0, pageW, 36, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.setFont("helvetica", "bold");
    pdf.text("Pessy", margin, 16);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text("Carnet Oficial de Vacunación", margin, 23);
    pdf.setFontSize(8);
    pdf.text(`Generado: ${new Date().toLocaleDateString("es-AR")}`, pageW - margin, 23, { align: "right" });

    y = 46;
    pdf.setTextColor(30, 30, 30);

    // Pet info block
    pdf.setFillColor(240, 253, 248);
    pdf.roundedRect(margin, y, contentW, 26, 3, 3, "F");
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(27, 94, 79);
    pdf.text(petData.name, margin + 4, y + 9);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(60, 60, 60);
    pdf.text(`Raza: ${petData.breed || "—"}`, margin + 4, y + 16);
    pdf.text(`Fecha de nacimiento: ${petData.birthDate || "—"}`, margin + 4, y + 22);
    if (petData.microchip) pdf.text(`Microchip: ${petData.microchip}`, pageW / 2, y + 16);

    y += 34;

    // Vaccines
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(27, 94, 79);
    pdf.text("Registro de Vacunas", margin, y);
    y += 5;
    pdf.setDrawColor(27, 94, 79);
    pdf.line(margin, y, margin + contentW, y);
    y += 6;

    if (vaccines.length === 0) {
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(150, 150, 150);
      pdf.text("Sin vacunas registradas.", margin, y + 6);
    }

    for (const vac of vaccines) {
      if (y + 22 > 282) { pdf.addPage(); y = 20; }
      const statusColors: Record<string, [number, number, number]> = {
        current: [16, 185, 129],
        "due-soon": [217, 119, 6],
        overdue: [220, 38, 38],
      };
      const [r, g, b] = statusColors[vac.status] || [100, 116, 139];

      pdf.setFillColor(r, g, b);
      pdf.roundedRect(margin, y, 3, 18, 1, 1, "F");

      pdf.setFillColor(249, 250, 251);
      pdf.roundedRect(margin + 5, y, contentW - 5, 18, 2, 2, "F");
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 30, 30);
      pdf.text(vac.name, margin + 9, y + 6);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Aplicada: ${vac.date}`, margin + 9, y + 12);
      pdf.text(`Próxima: ${vac.nextDue}`, pageW / 2, y + 12);
      if (vac.lotNumber) pdf.text(`Lote: ${vac.lotNumber}`, margin + 9, y + 17);
      // Status pill
      pdf.setFillColor(r, g, b);
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "bold");
      const statusLabel = STATUS_CONFIG[vac.status]?.label || "—";
      pdf.text(statusLabel.toUpperCase(), pageW - margin - 2, y + 7, { align: "right" });
      y += 22;
    }

    // Footer
    pdf.setFillColor(240, 253, 248);
    pdf.rect(0, 285, pageW, 12, "F");
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 150, 130);
    pdf.text("Generado por PESSY — pessy.app", margin, 291);
    pdf.text("Documento de uso informativo.", pageW - margin, 291, { align: "right" });

    await savePdfWithFallback(
      pdf,
      `PESSY_Carnet_Vacunacion_${petData.name}_${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  const hasOverdue = vaccines.some(v => v.status === "overdue");
  const hasDueSoon = vaccines.some(v => v.status === "due-soon");

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[60] animate-fadeIn"
      />

      {/* Modal */}
      <div className="fixed inset-4 z-[60] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-w-md mx-auto my-auto max-h-[90vh] animate-slideUp">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Carnet de Vacunación</h2>
                <p className="text-xs text-slate-500 mt-0.5">{petData.name} · {vaccines.length} vacuna{vaccines.length !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={onClose}
                className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <MaterialIcon name="close" className="text-xl" />
              </button>
            </div>

            {/* Alert banners */}
            {hasOverdue && (
              <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <MaterialIcon name="warning" className="text-red-500 text-xl shrink-0" />
                <p className="text-sm font-bold text-red-700">Hay vacunas vencidas que requieren atención</p>
              </div>
            )}
            {!hasOverdue && hasDueSoon && (
              <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <MaterialIcon name="schedule" className="text-amber-500 text-xl shrink-0" />
                <p className="text-sm font-bold text-amber-700">Hay vacunas con refuerzo próximo</p>
              </div>
            )}

            {/* Vet Booking Bridge — Connection Rule */}
        {(hasOverdue || hasDueSoon) && (
          <button
            onClick={() => { onOpenNearbyVets?.(); onClose(); }}
            className="mx-4 mt-3 w-[calc(100%-2rem)] bg-[#074738] rounded-xl px-4 py-3 flex items-center justify-between active:scale-[0.97] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-[#1A9B7D]/20 flex items-center justify-center shrink-0">
                <MaterialIcon name="local_hospital" className="text-[#1A9B7D] text-lg" />
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-bold">
                  {hasOverdue ? "Vacunas vencidas — atención urgente" : "Refuerzo próximo"}
                </p>
                <p className="text-white/70 text-xs mt-0.5">Ver veterinarias con turno disponible</p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-[#1A9B7D] rounded-lg px-3 py-1.5 shrink-0">
              <p className="text-white text-xs font-bold">Agendar</p>
              <MaterialIcon name="arrow_forward" className="text-white text-sm" />
            </div>
          </button>
        )}

        {/* Card preview + list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* Mini card oficial */}
              <div className="bg-gradient-to-br from-[#074738] to-[#1a9b7d] rounded-2xl p-5 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-xl overflow-hidden border border-white/30 bg-white/15">
                      <PetPhoto
                        src={petData.photo}
                        alt={petData.name || "Mascota"}
                        className="size-full object-cover"
                        fallbackClassName="rounded-xl"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-black tracking-widest opacity-80 uppercase">PESSY</p>
                      <p className="text-lg font-black leading-tight">{petData.name || "Mascota"}</p>
                      <p className="text-xs opacity-75">{petData.breed || "Raza no registrada"}</p>
                    </div>
                  </div>
                  <div className="size-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <MaterialIcon name="verified" className="text-white text-2xl" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/10 rounded-lg p-2">
                    <p className="text-[10px] opacity-70">Vacunas</p>
                    <p className="text-xl font-black">{vaccines.length}</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2">
                    <p className="text-[10px] opacity-70">Al día</p>
                    <p className="text-xl font-black">{vaccines.filter(v => v.status === "current").length}</p>
                  </div>
                  <div className={`rounded-lg p-2 ${hasOverdue ? "bg-red-500/40" : hasDueSoon ? "bg-amber-500/40" : "bg-white/10"}`}>
                    <p className="text-[10px] opacity-70">Vencidas</p>
                    <p className="text-xl font-black">{vaccines.filter(v => v.status === "overdue").length}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-white/10 rounded-lg p-2 text-left">
                    <p className="text-[10px] opacity-70">Nacimiento</p>
                    <p className="text-xs font-bold truncate">{petData.birthDate || "No registrado"}</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2 text-left">
                    <p className="text-[10px] opacity-70">Microchip</p>
                    <p className="text-xs font-bold truncate">{petData.microchip || "Sin chip"}</p>
                  </div>
                </div>
              </div>

              {/* Vaccine list */}
              {vaccines.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No hay vacunas registradas. Subí un documento para detectarlas.
                </div>
              ) : (
                vaccines.map((v) => {
                  const sc = STATUS_CONFIG[v.status];
                  return (
                    <div key={v.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <div className="h-1" style={{ backgroundColor: sc.dot }} />
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex-1 pr-2">{v.name}</h4>
                          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full text-white ${sc.bg}`}>
                            {sc.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">{v.veterinarian}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                            <p className="text-[10px] text-slate-400 mb-0.5">Aplicada</p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{v.date}</p>
                          </div>
                          <div className={`rounded-lg p-2 ${v.status === "overdue" ? "bg-red-50 dark:bg-red-900/20" : "bg-slate-50 dark:bg-slate-900"}`}>
                            <p className="text-[10px] text-slate-400 mb-0.5">Próxima dosis</p>
                            <p className={`text-xs font-bold ${v.status === "overdue" ? "text-red-600" : v.status === "due-soon" ? "text-amber-600" : "text-slate-700 dark:text-slate-300"}`}>
                              {v.nextDue}
                            </p>
                          </div>
                        </div>
                        {(v.lotNumber || v.serialNumber) && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {v.lotNumber && (
                              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-md px-2 py-1">
                                <MaterialIcon name="barcode_scanner" className="text-[13px] text-slate-500" />
                                <span className="text-[10px] text-slate-500 font-mono">Lote: {v.lotNumber}</span>
                              </div>
                            )}
                            {v.serialNumber && (
                              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-md px-2 py-1">
                                <MaterialIcon name="tag" className="text-[13px] text-slate-500" />
                                <span className="text-[10px] text-slate-500 font-mono">Serie: {v.serialNumber}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3">
              <button onClick={handleDownloadPDF}
                className="py-3 rounded-xl bg-[#1B5E4F] text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#1B5E4F]/30 text-sm">
                <MaterialIcon name="download" className="text-lg" />
                Descargar PDF
              </button>
              <button onClick={() => {
                const text = `Carnet de vacunación de ${petData.name} (PESSY)`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
              }}
                className="py-3 rounded-xl bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 text-sm">
                <MaterialIcon name="share" className="text-lg" />
                WhatsApp
              </button>
            </div>
      </div>
    </>
  );
}
