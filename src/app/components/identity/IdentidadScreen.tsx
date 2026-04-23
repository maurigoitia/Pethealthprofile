import { useState, useMemo, lazy, Suspense } from "react";
import {
  ChevronLeft,
  Syringe,
  Share2,
  Pencil,
  History,
  Pill,
  CalendarDays,
  UserRound,
  Dog,
} from "lucide-react";
import { useNavigate } from "react-router";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";
import { useAppLayout } from "../layout/AppLayout";
import { formatDateSafe, parseDateSafe } from "../../utils/dateUtils";

const VaccinationCardModal = lazy(() =>
  import("../medical/VaccinationCardModal").then((m) => ({ default: m.VaccinationCardModal }))
);

interface IdentidadScreenProps {
  onBack: () => void;
}

function getAgeLabel(birthDate?: string): string {
  if (!birthDate) return "Edad desconocida";
  const birth = parseDateSafe(birthDate);
  if (!birth) return "Edad desconocida";
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (months < 1) return "Recién nacido/a";
  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "año" : "años"}`;
}

export function IdentidadScreen({ onBack }: IdentidadScreenProps) {
  const navigate = useNavigate();
  const { activePet } = usePet();
  const { activeMedications, events, getEventsByPetId } = useMedical();
  const { openExportReport, openPetProfile } = useAppLayout();

  const [showVaccCard, setShowVaccCard] = useState(false);

  const vaccines = useMemo(() => {
    if (!activePet?.id) return [];
    return getEventsByPetId(activePet.id)
      .filter(
        (e) =>
          e.extractedData.documentType === "vaccine" && e.status === "completed"
      )
      .map((e) => ({
        id: e.id,
        name:
          e.extractedData.diagnosis ||
          e.extractedData.suggestedTitle ||
          "Vacuna",
        date: e.extractedData.eventDate
          ? formatDateSafe(
              e.extractedData.eventDate,
              "es-ES",
              { day: "2-digit", month: "short", year: "numeric" },
              "Sin fecha"
            )
          : formatDateSafe(
              e.createdAt,
              "es-ES",
              { day: "2-digit", month: "short", year: "numeric" },
              "Sin fecha"
            ),
        nextDue: e.extractedData.nextAppointmentDate
          ? formatDateSafe(
              e.extractedData.nextAppointmentDate,
              "es-ES",
              { day: "2-digit", month: "short", year: "numeric" },
              "Sin fecha"
            )
          : "No especificada",
        veterinarian:
          e.extractedData.provider || "Profesional no especificado",
        lotNumber:
          (
            e.extractedData.vaccine_artifacts as Record<
              string,
              unknown
            > | null
          )?.lot_number as string | null ??
          (e.extractedData.vaccineLotNumber as string | null) ??
          null,
        serialNumber:
          (
            e.extractedData.vaccine_artifacts as Record<
              string,
              unknown
            > | null
          )?.serial_number as string | null ??
          (e.extractedData.vaccineSerialNumber as string | null) ??
          null,
        status: (() => {
          if (!e.extractedData.nextAppointmentDate)
            return "current" as const;
          const next = parseDateSafe(e.extractedData.nextAppointmentDate);
          if (!next) return "current" as const;
          const diff =
            (next.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          if (diff < 0) return "overdue" as const;
          if (diff < 30) return "due-soon" as const;
          return "current" as const;
        })(),
      }));
  }, [activePet?.id, events, getEventsByPetId]);

  // No active pet — empty state
  if (!activePet) {
    return (
      <div
        className="min-h-screen bg-[#F0FAF9] flex flex-col items-center justify-center px-6 gap-6"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        <div className="size-20 rounded-[20px] bg-[#E0F2F1] flex items-center justify-center">
          <Dog size={40} className="text-[#1A9B7D]" />
        </div>
        <div className="text-center space-y-2">
          <h2
            className="text-xl font-bold text-[#074738]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Seleccioná una mascota para continuar
          </h2>
          <p className="text-sm text-slate-500">
            Registrá tu mascota para ver su identidad digital.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/inicio")}
          className="bg-[#074738] text-white rounded-[14px] px-8 py-3 font-bold text-sm active:scale-95 transition-transform"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Ir al inicio
        </button>
      </div>
    );
  }

  const petInitial = activePet.name?.charAt(0).toUpperCase() ?? "?";
  const activeForPet = activeMedications.filter(
    (m) => m.petId === activePet.id
  );
  const petEvents = getEventsByPetId(activePet.id);

  const dataRows: { label: string; value: string }[] = [
    { label: "Especie", value: activePet.species || "—" },
    { label: "Raza", value: activePet.breed || "—" },
    {
      label: "Fecha de nacimiento",
      value: activePet.birthDate
        ? formatDateSafe(
            activePet.birthDate,
            "es-AR",
            { day: "2-digit", month: "long", year: "numeric" },
            "—"
          )
        : "—",
    },
    {
      label: "Peso",
      value: activePet.weight ? `${activePet.weight} kg` : "—",
    },
    {
      label: "Sexo",
      value: activePet.sex || "—",
    },
    {
      label: "Castrado/a",
      value:
        activePet.isNeutered === true
          ? "Sí"
          : activePet.isNeutered === false
          ? "No"
          : "—",
    },
  ];

  return (
    <div
      className="min-h-screen bg-[#F0FAF9] flex flex-col max-w-md mx-auto"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-[#F0FAF9] flex items-center gap-3 px-4 pt-12 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="size-11 rounded-full bg-white border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center text-slate-700 active:scale-95 transition-transform"
          aria-label="Volver"
        >
          <ChevronLeft size={20} />
        </button>
        <h1
          className="flex-1 text-lg font-bold text-[#074738]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Identidad
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4 pt-1">
        {/* Hero card */}
        <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col items-center gap-3">
          {/* Avatar */}
          {activePet.photo ? (
            <img
              src={activePet.photo}
              alt={activePet.name}
              className="size-24 rounded-full object-cover ring-4 ring-[#E0F2F1]"
            />
          ) : (
            <div className="size-24 rounded-full bg-[#E0F2F1] flex items-center justify-center ring-4 ring-white">
              <span
                className="text-4xl font-bold text-[#1A9B7D]"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {petInitial}
              </span>
            </div>
          )}

          {/* Name */}
          <h2
            className="text-2xl font-bold text-[#074738] text-center"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {activePet.name}
          </h2>

          {/* Chips */}
          <div className="flex flex-wrap justify-center gap-2">
            {activePet.species && (
              <span className="bg-[#E0F2F1] text-[#074738] text-xs font-semibold px-3 py-1 rounded-full">
                {activePet.species}
              </span>
            )}
            {activePet.breed && (
              <span className="bg-[#E0F2F1] text-[#074738] text-xs font-semibold px-3 py-1 rounded-full">
                {activePet.breed}
              </span>
            )}
            <span className="bg-[#E0F2F1] text-[#074738] text-xs font-semibold px-3 py-1 rounded-full">
              {getAgeLabel(activePet.birthDate)}
            </span>
            {activePet.sex && (
              <span className="bg-[#E0F2F1] text-[#074738] text-xs font-semibold px-3 py-1 rounded-full">
                {activePet.sex}
              </span>
            )}
          </div>
        </div>

        {/* Quick actions row */}
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setShowVaccCard(true)}
            className="bg-white rounded-[14px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col items-center gap-2 active:scale-95 transition-transform min-h-[80px] justify-center"
          >
            <Syringe size={22} className="text-[#1A9B7D]" />
            <span className="text-[11px] font-bold text-slate-600 text-center leading-tight">
              Carnet de vacunación
            </span>
          </button>

          <button
            type="button"
            onClick={() => openExportReport()}
            className="bg-white rounded-[14px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col items-center gap-2 active:scale-95 transition-transform min-h-[80px] justify-center"
          >
            <Share2 size={22} className="text-[#1A9B7D]" />
            <span className="text-[11px] font-bold text-slate-600 text-center leading-tight">
              Compartir con el veterinario
            </span>
          </button>

          <button
            type="button"
            onClick={() => openPetProfile()}
            className="bg-white rounded-[14px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col items-center gap-2 active:scale-95 transition-transform min-h-[80px] justify-center"
          >
            <Pencil size={22} className="text-[#1A9B7D]" />
            <span className="text-[11px] font-bold text-slate-600 text-center leading-tight">
              Editar perfil
            </span>
          </button>
        </div>

        {/* Datos esenciales */}
        <div className="bg-white rounded-[16px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-4">
            <UserRound size={16} className="text-[#1A9B7D]" />
            <span
              className="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Datos esenciales
            </span>
          </div>

          <div className="space-y-3">
            {dataRows.map((row) => (
              <div
                key={row.label}
                className="flex items-start justify-between gap-4"
              >
                <span className="text-[12px] text-slate-400 shrink-0">
                  {row.label}
                </span>
                <span className="text-[13px] font-semibold text-slate-800 text-right">
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => openPetProfile()}
            className="mt-5 w-full border border-[#1A9B7D] text-[#1A9B7D] rounded-[12px] py-2.5 text-sm font-bold active:scale-[0.97] transition-transform"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Completar ficha
          </button>
        </div>

        {/* Estado actual de salud */}
        <div className="bg-white rounded-[16px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-4">
            <Pill size={16} className="text-[#1A9B7D]" />
            <span
              className="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Salud y actividad
            </span>
          </div>

          {/* Medications */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 mb-2">
              Medicaciones activas
            </p>
            {activeForPet.length === 0 ? (
              <p className="text-sm text-slate-400">
                Sin medicaciones activas
              </p>
            ) : (
              <div className="space-y-1.5">
                {activeForPet.map((med) => (
                  <div
                    key={med.id}
                    className="flex items-center gap-2"
                  >
                    <div className="size-2 rounded-full bg-[#1A9B7D] shrink-0" />
                    <span className="text-sm font-semibold text-slate-800">
                      {med.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Events count */}
          <div className="flex items-center gap-2 mb-5">
            <CalendarDays size={14} className="text-slate-400" />
            <span className="text-sm text-slate-500">
              {petEvents.length === 0
                ? "Sin eventos registrados"
                : `${petEvents.length} ${petEvents.length === 1 ? "evento registrado" : "eventos registrados"}`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate("/historial")}
            className="w-full bg-[#074738] text-white rounded-[12px] py-3 text-sm font-bold active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            <History size={16} />
            Ver historial completo
          </button>
        </div>
      </div>

      {/* VaccinationCardModal (lazy) */}
      {showVaccCard && (
        <Suspense fallback={null}>
          <VaccinationCardModal
            isOpen={showVaccCard}
            onClose={() => setShowVaccCard(false)}
            petData={{
              name: activePet.name,
              breed: activePet.breed ?? "",
              birthDate: activePet.birthDate ?? "",
              microchip: activePet.microchip ?? "",
              photo: activePet.photo ?? "",
            }}
            vaccines={vaccines}
          />
        </Suspense>
      )}
    </div>
  );
}
