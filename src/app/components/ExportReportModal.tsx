import { useState } from "react";
import { motion } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ReportType = "health" | "vaccine" | "treatment" | null;

export function ExportReportModal({ isOpen, onClose }: ExportReportModalProps) {
  const [selectedReport, setSelectedReport] = useState<ReportType>("health");

  if (!isOpen) return null;

  const options = [
    {
      id: "health" as ReportType,
      icon: "picture_as_pdf",
      title: "Reporte de Salud Completo (PDF)",
      subtitle: "Generar historial total.",
      bgColor: "bg-[#2b6fee]",
      bgLight: "bg-[#2b6fee]/5",
      borderColor: "border-[#2b6fee]",
      textColor: "text-[#2b6fee]",
    },
    {
      id: "vaccine" as ReportType,
      icon: "vaccines",
      title: "Carnet de Vacunación Digital",
      subtitle: "Solo vacunas confirmadas.",
      bgColor: "bg-slate-200 dark:bg-slate-700",
      bgLight: "bg-slate-50 dark:bg-slate-800/50",
      borderColor: "border-slate-200 dark:border-slate-800",
      textColor: "text-slate-600 dark:text-slate-300",
    },
    {
      id: "treatment" as ReportType,
      icon: "medication",
      title: "Plan de Tratamiento Actual",
      subtitle: "Dosis y frecuencias.",
      bgColor: "bg-slate-200 dark:bg-slate-700",
      bgLight: "bg-slate-50 dark:bg-slate-800/50",
      borderColor: "border-slate-200 dark:border-slate-800",
      textColor: "text-slate-600 dark:text-slate-300",
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-xl shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Handle */}
        <div className="flex w-full items-center justify-center py-3">
          <div
            className="h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 cursor-pointer"
            onClick={onClose}
          ></div>
        </div>

        {/* Header */}
        <div className="px-5 pb-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
            Opciones de exportación
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Selecciona el formato que necesitas
          </p>
        </div>

        {/* Options List */}
        <div className="px-5 space-y-3 mb-6">
          {options.map((option) => {
            const isSelected = selectedReport === option.id;

            return (
              <label
                key={option.id}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? `${option.borderColor} ${option.bgLight}`
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                }`}
              >
                <input
                  type="radio"
                  name="report-type"
                  value={option.id}
                  checked={isSelected}
                  onChange={() => setSelectedReport(option.id)}
                  className="sr-only"
                />
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-white ${
                    isSelected ? option.bgColor : "bg-slate-200 dark:bg-slate-700"
                  }`}
                >
                  <MaterialIcon
                    name={option.icon}
                    className={!isSelected ? option.textColor : ""}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-slate-900 dark:text-white font-bold text-sm">
                    {option.title}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    {option.subtitle}
                  </p>
                </div>
                <div
                  className={`size-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected
                      ? `${option.borderColor}`
                      : "border-slate-300 dark:border-slate-600"
                  }`}
                >
                  {isSelected && (
                    <div
                      className={`size-2.5 rounded-full ${
                        option.id === "health" ? "bg-[#2b6fee]" : "bg-slate-400"
                      }`}
                    ></div>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        {/* Footer Action */}
        <div className="px-5 pb-8 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-4 justify-center">
            <MaterialIcon name="info" className="text-[#2b6fee] dark:text-[#5a8aff] text-sm" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
              Los documentos se generan automáticamente basados en datos validados por IA
            </p>
          </div>
          <button className="w-full flex items-center justify-center gap-2 rounded-xl h-14 bg-[#2b6fee] text-white font-bold text-base shadow-lg shadow-[#2b6fee]/25 active:scale-95 transition-transform hover:bg-[#5a8aff]">
            <MaterialIcon name="ios_share" />
            Generar y Compartir
          </button>
        </div>
      </motion.div>
    </>
  );
}