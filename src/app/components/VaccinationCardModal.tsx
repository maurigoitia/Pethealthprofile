import { motion, AnimatePresence } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";

interface Vaccine {
  id: number;
  name: string;
  date: string;
  nextDue: string;
  veterinarian: string;
  status: "current" | "due-soon" | "overdue";
}

interface VaccinationCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  petData: {
    name: string;
    breed: string;
    birthDate: string;
    microchip: string;
    photo: string;
  };
  vaccines: Vaccine[];
}

export function VaccinationCardModal({
  isOpen,
  onClose,
  petData,
  vaccines,
}: VaccinationCardModalProps) {
  const handleDownloadPDF = () => {
    // Aquí iría la lógica para descargar el PDF
    alert("Descargando PDF...");
  };

  const handleShareWhatsApp = () => {
    // Aquí iría la lógica para compartir por WhatsApp
    const text = `Carnet de Vacunación de ${petData.name}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[60]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-4 z-[60] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-w-md mx-auto my-auto"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Carnet de Vacunación
              </h2>
              <button
                onClick={onClose}
                className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <MaterialIcon name="close" className="text-xl" />
              </button>
            </div>

            {/* Card Preview */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Official Card Design */}
              <div className="bg-gradient-to-br from-[#2b6fee] to-purple-600 rounded-2xl p-6 text-white shadow-2xl">
                {/* Header with PESSY Logo */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <MaterialIcon name="pets" className="text-white text-2xl" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black">PESSY</h3>
                      <p className="text-xs text-white/80">
                        Carnet Oficial de Vacunación
                      </p>
                    </div>
                  </div>
                  <MaterialIcon name="verified" className="text-white text-3xl" />
                </div>

                {/* Pet Info */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="size-16 rounded-xl bg-white/20 backdrop-blur-sm overflow-hidden">
                      <img
                        src={petData.photo}
                        alt={petData.name}
                        className="size-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-black mb-1">{petData.name}</h4>
                      <p className="text-sm text-white/80">{petData.breed}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-white/60 mb-0.5">Fecha de nacimiento</p>
                      <p className="font-bold">{petData.birthDate}</p>
                    </div>
                    <div>
                      <p className="text-white/60 mb-0.5">Microchip</p>
                      <p className="font-bold text-[10px]">{petData.microchip}</p>
                    </div>
                  </div>
                </div>

                {/* Vaccines Table */}
                <div className="space-y-2">
                  <h5 className="text-sm font-black text-white/80 uppercase tracking-wider mb-3">
                    Registro de Vacunas
                  </h5>
                  {vaccines.map((vaccine) => (
                    <div
                      key={vaccine.id}
                      className="bg-white/10 backdrop-blur-sm rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-bold flex-1">{vaccine.name}</p>
                        <div className="size-2 rounded-full bg-emerald-400 mt-1" />
                      </div>
                      <div className="flex justify-between text-xs text-white/70">
                        <span>Aplicada: {vaccine.date}</span>
                        <span>Próxima: {vaccine.nextDue}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-white/20 flex items-center justify-between text-xs text-white/60">
                  <span>Emitido: 24 Feb 2026</span>
                  <div className="flex items-center gap-1">
                    <MaterialIcon name="verified_user" className="text-sm" />
                    <span>Verificado</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Share Options */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h6 className="text-sm font-black text-slate-900 dark:text-white mb-3">
                Compartir Carnet
              </h6>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Download PDF */}
                <button
                  onClick={handleDownloadPDF}
                  className="py-3 px-4 rounded-xl bg-[#2b6fee] text-white font-bold hover:bg-[#5a8aff] transition-colors shadow-lg shadow-[#2b6fee]/30 flex items-center justify-center gap-2"
                >
                  <MaterialIcon name="download" className="text-xl" />
                  <span className="text-sm">Descargar</span>
                </button>

                {/* Share WhatsApp */}
                <button
                  onClick={handleShareWhatsApp}
                  className="py-3 px-4 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
                >
                  <MaterialIcon name="share" className="text-xl" />
                  <span className="text-sm">WhatsApp</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
