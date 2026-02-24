import { motion, AnimatePresence } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";
import { usePet } from "../contexts/PetContext";
import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  generateReportHash,
  generateReportId,
  formatReportDate,
  getShortHash,
  type ReportData,
} from "../utils/reportVerification";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import pessyLogo from "figma:asset/e4b9cb13fdb59713820f2da9cb50d2aa5431cc45.png";

interface HealthReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mock data
const weightData = [
  { month: "Sep", weight: 28.5 },
  { month: "Oct", weight: 29.2 },
  { month: "Nov", weight: 29.8 },
  { month: "Dec", weight: 30.1 },
  { month: "Jan", weight: 31.4 },
  { month: "Feb", weight: 31.2 },
];

const reportHistory = [
  {
    date: "14 Mar 2025",
    category: "Cardiología",
    event: "Estudio ECG & Holter",
    details:
      "Frecuencia cardíaca promedio 128 lpm. Intervalo PR 84ms. Complejo QRS 76ms. Eje QRS +80°. Se observa ritmo sinusal estable.",
    doctor: "Dr. Alejandro Gomez (MP 5421)",
  },
  {
    date: "02 Feb 2025",
    category: "Diagnóstico por Imagen",
    event: "Ecocardiograma Doppler",
    details:
      "Cardiomiopatía dilatada en fase oculta con leve regurgitación mitral. Fracción de acortamiento 22%. Se ajusta medicación: Pimobendan 5mg cada 12 horas.",
    doctor: "Clínica Veterinaria Central",
  },
  {
    date: "18 Nov 2024",
    category: "Traumatología",
    event: "Radiografía de Cadera y Miembros",
    details:
      "Displasia de cadera bilateral con signos de remodelación articular grado II. Se recomienda mantenimiento de peso y natación terapéutica.",
    doctor: "Dra. Elena Ruiz",
  },
];

const vaccineData = [
  {
    name: "Séxtuple",
    date: "12 Jun 2024",
    status: "Vigente",
    next: "12 Jun 2025",
  },
  { name: "Rabia", date: "12 Jun 2024", status: "Vigente", next: "12 Jun 2025" },
  {
    name: "KC (Tos)",
    date: "12 Jun 2024",
    status: "Vigente",
    next: "12 Jun 2025",
  },
  {
    name: "Giardia",
    date: "15 Mar 2024",
    status: "Vencido",
    next: "15 Mar 2025",
  },
];

const medicationData = [
  {
    name: "Pimobendan 5mg",
    dose: "1 comprimido / 12hs",
    type: "Cardiológico",
    duration: "Crónico",
  },
  {
    name: "Condroprotectores",
    dose: "1 medida / 24hs",
    type: "Articular",
    duration: "Mantenimiento",
  },
  {
    name: "Dieta Hipoalergénica",
    dose: "350g / día",
    type: "Nutrición",
    duration: "Permanente",
  },
];

export function HealthReportModal({ isOpen, onClose }: HealthReportModalProps) {
  const { activePet } = usePet();

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleShare = () => {
    // TODO: Implement share functionality
    alert("Compartir reporte - To be implemented");
  };

  const [reportData, setReportData] = useState<ReportData | null>(null);

  useEffect(() => {
    if (activePet) {
      const data: ReportData = {
        petName: activePet.name,
        petBreed: activePet.breed,
        petAge: "3 Años · 2 meses",
        petSex: "Macho · Intacto",
        petMicrochip: "985141000342218",
        reportId: generateReportId(activePet.name),
        reportDate: formatReportDate(new Date()),
        reportHash: generateReportHash(activePet.name),
        reportShortHash: getShortHash(activePet.name),
        weightData,
        reportHistory,
        vaccineData,
        medicationData,
      };
      setReportData(data);
    }
  }, [activePet]);

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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-[101] bg-[#f6f6f8] dark:bg-[#101622] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-6 pb-4">
              <div className="flex items-center justify-between max-w-4xl mx-auto">
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <MaterialIcon name="arrow_back" className="text-xl" />
                  </button>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                      Reporte de Bienestar
                    </h2>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">
                      Análisis automatizado PESSY
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadPDF}
                    className="size-10 rounded-full bg-[#2b6fee]/10 dark:bg-[#2b6fee]/20 flex items-center justify-center hover:bg-[#2b6fee]/20 dark:hover:bg-[#2b6fee]/30 transition-colors"
                  >
                    <MaterialIcon name="download" className="text-[#2b6fee] text-xl" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <main className="max-w-4xl mx-auto p-6 space-y-8 pb-32">
              {/* BRANDING Y CABECERA */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-start border-b-4 border-[#2b6fee] pb-6">
                  <div>
                    <h1 className="text-3xl font-black text-[#2b6fee] tracking-tighter leading-none mb-2">
                      PESSY
                    </h1>
                    <p className="text-[10px] font-bold text-[#2b6fee]/80 uppercase tracking-[0.25em] mb-4">
                      Inteligencia en Salud Animal
                    </p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <MaterialIcon name="description" className="text-xs" />
                        <p className="text-[10px] font-medium uppercase tracking-wider">
                          Reporte Médico Digital Verificable
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="bg-slate-900 dark:bg-slate-800 text-white px-4 py-2 rounded-xl mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 leading-none mb-1">
                        ID Expediente
                      </p>
                      <p className="text-sm font-mono font-bold">
                        #PSY-2026-{activePet.name.toUpperCase()}-X92
                      </p>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Generado el
                    </p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Domingo, 22 Feb 2026
                    </p>
                    <p className="text-[9px] text-[#2b7cee] font-medium mt-1 uppercase tracking-tighter">
                      Documento generado digitalmente
                    </p>
                  </div>
                </div>
              </div>

              {/* IDENTIFICACIÓN MAESTRA */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-6">
                  <MaterialIcon name="pets" className="text-[#2b6fee] text-lg" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">
                    Datos de la Mascota
                  </h4>
                </div>
                <div className="flex gap-6 items-start">
                  <div className="w-24 h-24 rounded-3xl overflow-hidden ring-4 ring-[#2b6fee]/20 shrink-0 shadow-lg">
                    <img
                      src={activePet.photo}
                      alt={activePet.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-3 flex-1">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                        {activePet.name}
                      </h3>
                      <p className="text-sm text-[#2b6fee] font-bold uppercase tracking-tighter">
                        {activePet.breed}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          Edad
                        </p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          3 Años · 2 meses
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          Sexo
                        </p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          Macho · Intacto
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          Microchip / Tatuaje
                        </p>
                        <p className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                          985141000342218
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* MÉTRICAS DE SALUD (GRÁFICO) */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-6">
                  <div className="flex items-center gap-2">
                    <MaterialIcon name="monitoring" className="text-[#2b6fee] text-lg" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">
                      Control de Peso & Crecimiento
                    </h4>
                  </div>
                  <p className="text-[10px] text-[#2b6fee] font-bold uppercase">
                    Meta: 30.5 kg
                  </p>
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weightData}>
                      <defs>
                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2b6fee" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#2b6fee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "16px",
                          border: "none",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="weight"
                        stroke="#2b6fee"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorWeight)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* MEDICACIÓN Y ALERGIAS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Medicación */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-6">
                    <MaterialIcon name="medication" className="text-[#2b6fee] text-lg" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">
                      Tratamientos Vigentes
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {medicationData.map((med, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-transparent hover:border-[#2b6fee]/20 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {med.name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {med.type} · {med.duration}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-[#2b6fee] uppercase tracking-tighter">
                            {med.dose}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alergias */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-6">
                    <MaterialIcon name="warning" className="text-amber-500 text-lg" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">
                      Alertas & Alergias
                    </h4>
                  </div>
                  <div className="space-y-3">
                    <div className="p-4 border-2 border-amber-500/20 bg-amber-500/5 rounded-2xl">
                      <p className="text-[10px] font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest mb-1">
                        Alergia Alimentaria
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed font-medium">
                        Sensibilidad severa a la proteína de pollo y derivados. Verificar
                        etiquetas.
                      </p>
                    </div>
                    <div className="p-4 border-2 border-[#2b6fee]/20 bg-[#2b6fee]/5 rounded-2xl">
                      <p className="text-[10px] font-black text-[#2b6fee] uppercase tracking-widest mb-1">
                        Nota Cardiológica
                      </p>
                      <p className="text-xs text-[#2b6fee] leading-relaxed font-medium">
                        Sensibilidad al esfuerzo extremo. Evitar actividad física intensa en
                        horarios de calor superior a 28°C.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARTILLA DE VACUNACIÓN */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-6">
                  <MaterialIcon name="vaccines" className="text-[#2b6fee] text-lg" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">
                    Estado de Inmunización
                  </h4>
                </div>
                <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-2xl">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800 text-left border-b border-slate-100 dark:border-slate-700">
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Inmunógeno
                        </th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Última Dosis
                        </th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Estatus
                        </th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Vencimiento
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {vaccineData.map((vax, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 text-xs font-bold text-slate-900 dark:text-white">
                            {vax.name}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                            {vax.date}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${
                                vax.status === "Vigente"
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                  : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                              }`}
                            >
                              {vax.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono font-medium text-slate-900 dark:text-white">
                            {vax.next}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* HISTORIAL CLÍNICO CRONOLÓGICO */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-6">
                  <MaterialIcon name="history" className="text-[#2b7cee] text-lg" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">
                    Línea de Tiempo Médica Completa
                  </h4>
                </div>

                <div className="relative space-y-0 ml-4 border-l-2 border-slate-100 dark:border-slate-800 pl-10">
                  {reportHistory.map((item, idx) => (
                    <div key={idx} className="relative pb-12 last:pb-0">
                      {/* PUNTO DE LA LÍNEA */}
                      <div className="absolute -left-[51px] top-0 size-10 bg-white dark:bg-slate-900 rounded-full border-2 border-[#2b7cee] flex items-center justify-center shadow-sm z-10">
                        <MaterialIcon name="check_circle" className="text-[#2b7cee] text-lg" />
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 hover:border-[#2b7cee]/20 dark:hover:border-[#2b7cee]/30 transition-all group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                          <div>
                            <span className="text-[10px] font-black text-[#2b7cee] uppercase tracking-[0.2em] block mb-1">
                              {item.category}
                            </span>
                            <h5 className="text-base font-black text-slate-900 dark:text-white group-hover:text-[#2b7cee] transition-colors">
                              {item.event}
                            </h5>
                          </div>
                          <div className="text-left md:text-right">
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              {item.date}
                            </p>
                            <p className="text-[9px] text-slate-400 font-medium uppercase tracking-widest">
                              Validado · OCR
                            </p>
                          </div>
                        </div>

                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6 font-medium italic">
                          "{item.details}"
                        </p>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex items-center gap-2 text-slate-400">
                            <MaterialIcon name="local_hospital" className="text-xs" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                              {item.doctor}
                            </span>
                          </div>
                          <button className="text-[10px] font-black text-[#2b7cee] uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all cursor-pointer">
                            Ver Documento
                            <MaterialIcon name="chevron_right" className="text-xs" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* VERIFICACIÓN DIGITAL - NIVEL 1 */}
              {reportData && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border-2 border-[#2b7cee]/30 shadow-lg">
                  <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="size-12 bg-[#2b7cee] text-white rounded-xl flex items-center justify-center shadow-lg">
                      <MaterialIcon name="verified_user" className="text-2xl" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900 dark:text-white leading-none">
                        Verificación de Integridad del Documento
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1">
                        Huella digital SHA-256 generada automáticamente
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* QR Code Section */}
                    <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-2xl p-6">
                      <div className="bg-white p-4 rounded-2xl shadow-lg mb-4">
                        <QRCodeSVG
                          value={`${window.location.origin}/verify/${reportData.reportHash}`}
                          size={180}
                          level="H"
                          includeMargin={true}
                          fgColor="#2b7cee"
                        />
                      </div>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 text-center">
                        Escanear para verificar autenticidad
                      </p>
                    </div>

                    {/* Technical Details */}
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                          ID de Documento
                        </p>
                        <p className="text-sm font-mono font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 px-4 py-3 rounded-xl">
                          {reportData.reportId}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                          Timestamp ISO 8601
                        </p>
                        <p className="text-sm font-mono font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 px-4 py-3 rounded-xl">
                          {new Date().toISOString()}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                          Hash SHA-256
                        </p>
                        <p className="text-xs font-mono text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 px-4 py-3 rounded-xl break-all leading-relaxed">
                          {reportData.reportHash}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          Puede validar la integridad de este documento escaneando el código QR
                          o ingresando el hash en el sistema de verificación de PESSY.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECCIÓN DE CIERRE */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                <div className="flex justify-center mb-6">
                  <div className="size-20 bg-white rounded-3xl flex items-center justify-center shadow-2xl rotate-3 p-4">
                    <img 
                      src={pessyLogo} 
                      alt="PESSY Logo" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 max-w-2xl mx-auto">
                  <p className="text-[9px] text-slate-400 text-center leading-relaxed font-medium uppercase tracking-tighter">
                    Este reporte constituye una recopilación digital de los
                    eventos médicos de la mascota identificada como {activePet.name}. Los
                    datos aquí contenidos han sido extraídos mediante tecnología OCR y
                    validados por algoritmos de inteligencia artificial. PESSY no se
                    responsabiliza por la veracidad de los documentos físicos originales
                    cargados por el usuario.
                  </p>
                </div>

                <p className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-[0.5em] opacity-20 mt-6">
                  Fin del Reporte #PSY-2026-{activePet.name.toUpperCase()}
                </p>
              </div>
            </main>

            {/* Floating Action Buttons */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-[#101622] via-white dark:via-[#101622] to-transparent pt-10 z-50">
              <div className="max-w-md mx-auto flex gap-3">
                <button
                  onClick={handleDownloadPDF}
                  className="flex-1 py-5 bg-[#2b6fee] text-white rounded-3xl font-bold shadow-xl shadow-[#2b6fee]/20 hover:bg-[#5a8aff] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <MaterialIcon name="download" className="text-xl" />
                  Descargar PDF
                </button>
                <button
                  onClick={handleShare}
                  className="size-16 bg-slate-900 dark:bg-slate-800 text-white rounded-full shadow-xl hover:bg-black dark:hover:bg-slate-700 active:scale-[0.95] transition-all cursor-pointer flex items-center justify-center"
                >
                  <MaterialIcon name="share" className="text-2xl" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}