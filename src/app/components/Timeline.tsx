import { MaterialIcon } from "./MaterialIcon";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { EmptyState } from "./EmptyState";
import { usePet } from "../contexts/PetContext";
import { useMedical } from "../contexts/MedicalContext";
import { MedicalEvent, DocumentType } from "../types/medical";

interface TimelineProps {
  activePet?: {
    name: string;
    photo: string;
  };
  onExportReport?: () => void;
}

export function Timeline({ activePet: activePetProp, onExportReport }: TimelineProps) {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  
  const { activePetId } = usePet();
  const { getEventsByPetId } = useMedical();

  // Get real events from context
  const medicalEvents = getEventsByPetId(activePetId);
  const displayedEvents = showAll ? medicalEvents : medicalEvents.slice(0, 3);

  const toggleEvent = (id: string) => {
    setExpandedEvent(expandedEvent === id ? null : id);
  };

  // Map document type to display info
  const getEventTypeInfo = (docType: DocumentType, status: MedicalEvent["status"]) => {
    if (status === "processing") {
      return { 
        icon: "sync", 
        color: "text-[#2b7cee]", 
        bg: "bg-[#2b7cee]/10", 
        border: "border-[#2b7cee]", 
        animate: true 
      };
    }

    switch (docType) {
      case "vaccine":
        return { 
          icon: "vaccines", 
          color: "text-emerald-500", 
          bg: "bg-emerald-500", 
          border: "border-white", 
          animate: false 
        };
      case "lab_test":
        return { 
          icon: "biotech", 
          color: "text-purple-500", 
          bg: "bg-purple-100 dark:bg-purple-900/30", 
          border: "border-purple-200", 
          animate: false 
        };
      case "xray":
      case "echocardiogram":
      case "electrocardiogram":
        return { 
          icon: "ecg", 
          color: "text-purple-500", 
          bg: "bg-purple-100 dark:bg-purple-900/30", 
          border: "border-purple-200", 
          animate: false 
        };
      case "surgery":
        return { 
          icon: "local_hospital", 
          color: "text-red-500", 
          bg: "bg-red-100 dark:bg-red-900/30", 
          border: "border-red-200", 
          animate: false 
        };
      case "medication":
        return { 
          icon: "medication", 
          color: "text-amber-500", 
          bg: "bg-amber-100 dark:bg-amber-900/30", 
          border: "border-amber-200", 
          animate: false 
        };
      case "checkup":
        return { 
          icon: "check_circle", 
          color: "text-emerald-500", 
          bg: "bg-emerald-500", 
          border: "border-white", 
          animate: false 
        };
      default:
        return { 
          icon: "description", 
          color: "text-slate-500", 
          bg: "bg-slate-100 dark:bg-slate-800", 
          border: "border-slate-200", 
          animate: false 
        };
    }
  };

  // Format timestamp
  const formatTimestamp = (isoDate: string) => {
    const date = new Date(isoDate);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return `HOY, ${date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
    }
    
    return date.toLocaleDateString("es-ES", { 
      day: "numeric", 
      month: "short", 
      hour: "2-digit", 
      minute: "2-digit" 
    }).toUpperCase();
  };

  // Get title based on event
  const getEventTitle = (event: MedicalEvent) => {
    const typeMap: Record<DocumentType, string> = {
      vaccine: "Vacuna aplicada",
      lab_test: "Análisis de laboratorio",
      xray: "Radiografía realizada",
      echocardiogram: "Ecocardiograma realizado",
      electrocardiogram: "Electrocardiograma realizado",
      surgery: "Cirugía completada",
      medication: "Medicación prescrita",
      checkup: "Control completado",
      other: "Documento cargado",
    };

    if (event.status === "processing") {
      return `${typeMap[event.extractedData.documentType]} en proceso`;
    }

    return typeMap[event.extractedData.documentType] || "Evento médico";
  };

  // Get tags
  const getEventTags = (event: MedicalEvent) => {
    const tags: string[] = [];
    
    if (event.status === "processing") {
      tags.push("PROCESANDO");
    }
    
    if (event.ocrProcessed && event.aiProcessed) {
      tags.push("IA VERIFICADO");
    }

    const typeTag: Record<DocumentType, string> = {
      vaccine: "VACUNA",
      lab_test: "LABORATORIO",
      xray: "ESTUDIO",
      echocardiogram: "ESTUDIO",
      electrocardiogram: "ESTUDIO",
      surgery: "CIRUGÍA",
      medication: "MEDICACIÓN",
      checkup: "CONTROL",
      other: "DOCUMENTO",
    };

    tags.push(typeTag[event.extractedData.documentType]);

    return tags;
  };

  // Get details for expanded view
  const getEventDetails = (event: MedicalEvent) => {
    const details: { label: string; value: string }[] = [];
    const extracted = event.extractedData;

    if (extracted.eventDate) {
      details.push({
        label: "Fecha del evento",
        value: new Date(extracted.eventDate).toLocaleDateString("es-ES", { 
          day: "numeric", 
          month: "long", 
          year: "numeric" 
        }),
      });
    }

    if (extracted.provider) {
      details.push({
        label: "Profesional/Clínica",
        value: extracted.provider,
      });
    }

    if (extracted.diagnosis) {
      details.push({
        label: "Hallazgo registrado",
        value: extracted.diagnosis,
      });
    }

    if (extracted.measurements.length > 0) {
      extracted.measurements.forEach(m => {
        details.push({
          label: m.name,
          value: `${m.value}${m.unit ? ` ${m.unit}` : ""}${m.referenceRange ? ` (${m.referenceRange})` : ""}`,
        });
      });
    }

    if (extracted.medications.length > 0) {
      extracted.medications.forEach(med => {
        details.push({
          label: "Medicación",
          value: `${med.name}${med.dosage ? ` - ${med.dosage}` : ""}${med.frequency ? ` - ${med.frequency}` : ""}`,
        });
      });
    }

    if (extracted.nextAppointmentDate) {
      details.push({
        label: "Próxima cita",
        value: `${new Date(extracted.nextAppointmentDate).toLocaleDateString("es-ES", { 
          day: "numeric", 
          month: "long" 
        })}${extracted.nextAppointmentReason ? ` - ${extracted.nextAppointmentReason}` : ""}`,
      });
    }

    return details;
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-black flex items-center gap-2">
          <MaterialIcon name="timeline" className="text-[#2b7cee] dark:text-[#5a8aff] text-xl" />
          Historial
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onExportReport?.()}
            className="size-9 rounded-full bg-[#2b7cee]/10 dark:bg-[#2b7cee]/20 flex items-center justify-center hover:bg-[#2b7cee]/20 dark:hover:bg-[#2b7cee]/30 transition-colors"
            title="Exportar Reporte"
          >
            <MaterialIcon name="description" className="text-[#2b7cee] dark:text-[#5a8aff] text-lg" />
          </button>
          
          {medicalEvents.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-bold text-[#2b7cee] dark:text-[#5a8aff] hover:underline"
            >
              {showAll ? "Ver menos" : `Ver todo (${medicalEvents.length})`}
            </button>
          )}
        </div>
      </div>

      {medicalEvents.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <EmptyState
            icon="inbox"
            title="Sin eventos médicos"
            description="Los documentos que subas aparecerán aquí automáticamente"
            illustration="medical"
          />
        </div>
      ) : (
        <div className="relative space-y-0 before:absolute before:inset-0 before:ml-[18px] before:h-full before:w-[2px] before:bg-gradient-to-b before:from-[#2b7cee] before:via-slate-200 before:to-slate-100 dark:before:via-slate-800 dark:before:to-slate-900">
          {displayedEvents.map((event) => {
            const isExpanded = expandedEvent === event.id;
            const styling = getEventTypeInfo(event.extractedData.documentType, event.status);
            const details = getEventDetails(event);

            return (
              <motion.div
                key={event.id}
                layout
                className="relative flex items-start gap-3 pb-4"
              >
                {/* Icon Badge */}
                <div
                  className={`relative mt-1 size-9 flex items-center justify-center rounded-full border-2 z-10 shrink-0 ${styling.bg} ${styling.border}`}
                >
                  <MaterialIcon
                    name={styling.icon}
                    className={`text-lg ${styling.color} ${styling.animate ? "animate-spin" : ""}`}
                  />
                </div>

                {/* Content */}
                <button
                  onClick={() => toggleEvent(event.id)}
                  className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors shadow-sm text-left"
                >
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {formatTimestamp(event.createdAt)}
                      </span>
                      <div className="flex items-center gap-1">
                        {event.status === "processing" && (
                          <span className="flex h-2 w-2 rounded-full bg-[#2b7cee] animate-pulse" />
                        )}
                        <MaterialIcon
                          name={isExpanded ? "expand_less" : "expand_more"}
                          className="text-slate-400 text-lg"
                        />
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 leading-tight">
                      {getEventTitle(event)}
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 leading-relaxed">
                      {event.extractedData.aiGeneratedSummary || event.extractedData.observations || event.fileName}
                    </p>

                    {/* Tags */}
                    <div className="flex gap-1.5 flex-wrap">
                      {getEventTags(event).map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] font-black px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && details.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-3 pb-3 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                          {details.map((detail, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-3">
                              <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                                {detail.label}
                              </span>
                              <span className="text-xs font-semibold text-slate-900 dark:text-white text-right">
                                {detail.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}