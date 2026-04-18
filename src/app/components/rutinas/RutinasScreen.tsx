import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ChevronLeft,
  Pill,
  CalendarClock,
  ShieldCheck,
  Scissors,
  Plus,
  Check,
} from "lucide-react";
import { useMedical } from "../../contexts/MedicalContext";
import { usePet } from "../../contexts/PetContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RutinaItem {
  id: string;
  name: string;
  time: string;
  type: "medication" | "appointment" | "vaccine" | "grooming";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RutinasScreenProps {
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Day chips
// ---------------------------------------------------------------------------

const DAYS = ["L", "M", "X", "J", "V", "S", "D"];

function getTodayIndex(): number {
  // JS: 0=Sun,1=Mon,...,6=Sat → we want 0=Mon,...,6=Sun
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

// ---------------------------------------------------------------------------
// Mock items for dev/demo when no real data
// ---------------------------------------------------------------------------

const MOCK_ITEMS: RutinaItem[] = [
  { id: "mock-1", name: "Rimadyl 50mg", time: "08:00", type: "medication" },
  { id: "mock-2", name: "Control veterinario", time: "10:30", type: "appointment" },
  { id: "mock-3", name: "Baño y cepillado", time: "16:00", type: "grooming" },
];

// ---------------------------------------------------------------------------
// Icon box
// ---------------------------------------------------------------------------

function ItemIcon({ type }: { type: RutinaItem["type"] }) {
  const icons = {
    medication: <Pill size={20} className="text-[#074738]" />,
    appointment: <CalendarClock size={20} className="text-[#074738]" />,
    vaccine: <ShieldCheck size={20} className="text-[#074738]" />,
    grooming: <Scissors size={20} className="text-[#074738]" />,
  };
  return (
    <div className="size-11 rounded-[12px] bg-[#E0F2F1] flex items-center justify-center shrink-0">
      {icons[type]}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RutinasScreen({ onBack }: RutinasScreenProps) {
  const navigate = useNavigate();
  const { activeMedications, appointments } = useMedical();
  const { activePet } = usePet();

  const [selectedDay, setSelectedDay] = useState<number>(getTodayIndex);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // Build routine items from real data
  const realItems: RutinaItem[] = [];

  if (activePet) {
    // Medications for the active pet
    activeMedications
      .filter((m) => m.petId === activePet.id && m.active)
      .forEach((m) => {
        realItems.push({
          id: `med-${m.id}`,
          name: m.name,
          time: m.nextDoseAt
            ? new Date(m.nextDoseAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
            : "08:00",
          type: "medication",
        });
      });

    // Appointments
    appointments
      .filter((a) => a.petId === activePet.id && a.status === "upcoming")
      .forEach((a) => {
        const itemType: RutinaItem["type"] = a.type === "vaccine" ? "vaccine" : "appointment";
        realItems.push({
          id: `apt-${a.id}`,
          name: a.title,
          time: a.time || "09:00",
          type: itemType,
        });
      });
  }

  // Use mock data when there's no real data (dev/demo)
  const items: RutinaItem[] = realItems.length > 0 ? realItems : MOCK_ITEMS;

  // For a simple display, show all items for any selected day
  // (real scheduling per weekday would require cron/recurrence data not yet modelled)
  const dayItems = items;

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[#F0FAF9] flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 flex items-center h-14 gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="size-11 flex items-center justify-center rounded-[14px] active:scale-[0.97] transition-all -ml-1"
        >
          <ChevronLeft size={22} className="text-[#074738]" />
        </button>
        <h1
          className="text-lg font-bold text-[#074738] font-['Plus_Jakarta_Sans']"
        >
          Rutinas
        </h1>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-4">
        {/* Esta semana — day chips */}
        <section>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 font-['Manrope']">
            Esta semana
          </p>
          <div className="flex gap-2">
            {DAYS.map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => setSelectedDay(idx)}
                className={[
                  "flex-1 h-11 rounded-[12px] text-sm font-bold transition-all active:scale-[0.97] font-['Plus_Jakarta_Sans']",
                  selectedDay === idx
                    ? "bg-[#074738] text-white shadow-[0_2px_8px_rgba(7,71,56,0.25)]"
                    : "bg-[#E0F2F1] text-[#074738]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Routine list */}
        {dayItems.length > 0 ? (
          <section className="space-y-3">
            {dayItems.map((item) => {
              const checked = checkedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] px-4 py-3 flex items-center gap-3 min-h-[64px]"
                >
                  <ItemIcon type={item.type} />
                  <div className={`flex-1 min-w-0 transition-all duration-200 ${checked ? "opacity-50" : ""}`}>
                    <p
                      className={`text-sm font-semibold text-slate-800 font-['Plus_Jakarta_Sans'] truncate transition-all duration-200 ${checked ? "line-through" : ""}`}
                    >
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-400 font-['Manrope'] mt-0.5">
                      {item.time}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCheck(item.id)}
                    aria-label={checked ? "Desmarcar" : "Marcar como completado"}
                    className={[
                      "size-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 active:scale-[0.97]",
                      checked
                        ? "bg-[#074738]"
                        : "border-2 border-[#E0F2F1]",
                    ].join(" ")}
                  >
                    {checked && <Check size={16} className="text-white" />}
                  </button>
                </div>
              );
            })}
          </section>
        ) : (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <span className="text-4xl">🐾</span>
            <p className="text-sm text-slate-500 font-['Manrope'] text-center">
              Sin rutinas para este día
            </p>
            <button
              type="button"
              onClick={() => navigate("/turnos")}
              className="px-5 py-2.5 rounded-[14px] border-2 border-[#074738] text-[#074738] text-sm font-bold font-['Plus_Jakarta_Sans'] active:scale-[0.97] transition-all"
            >
              Agregar rutina
            </button>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => navigate("/turnos")}
        aria-label="Agregar rutina"
        className="fixed bottom-6 right-6 size-14 bg-[#074738] text-white rounded-full shadow-lg flex items-center justify-center active:scale-[0.97] transition-all z-20"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
