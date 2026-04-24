import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useMedical } from "../../contexts/MedicalContext";
import { usePet } from "../../contexts/PetContext";
import { MaterialIcon } from "../shared/MaterialIcon";
import { EmptyState } from "../shared/EmptyState";
import type { ActiveMedication, Appointment } from "../../types/medical";

export interface RoutinesScreenProps {
  onBack?: () => void;
}

type RangeTab = "week" | "month" | "all";

type RoutineCategory = "medication" | "vaccine" | "appointment";

interface RoutineItem {
  id: string;
  category: RoutineCategory;
  name: string;
  /** frequency / subtítulo directo del dato real — nunca inventado */
  frequency: string;
  /** Fecha de referencia real (ISO o YYYY-MM-DD). Puede ser null si el dato no la tiene. */
  dateRef: Date | null;
  /** día "día, DD MMM" para agrupar. Si dateRef es null → "Sin fecha". */
  groupKey: string;
  groupLabel: string;
}

const CATEGORY_STYLES: Record<
  RoutineCategory,
  { iconBg: string; iconColor: string; icon: string }
> = {
  medication: {
    iconBg: "bg-[#1A9B7D]/10",
    iconColor: "text-[#1A9B7D]",
    icon: "medication",
  },
  vaccine: {
    iconBg: "bg-[#5048CA]/10",
    iconColor: "text-[#5048CA]",
    icon: "vaccines",
  },
  appointment: {
    iconBg: "bg-[#074738]/10",
    iconColor: "text-[#074738]",
    icon: "event",
  },
};

function parseDateSafe(value: string | null | undefined): Date | null {
  if (!value) return null;
  // "YYYY-MM-DD" → tratar como local mediodía para evitar off-by-one por TZ
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  const dt = new Date(value);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatGroup(date: Date | null): { key: string; label: string } {
  if (!date) return { key: "nodate", label: "Sin fecha" };
  const day = startOfDay(date);
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

  if (day.getTime() === today.getTime()) return { key, label: "Hoy" };
  if (day.getTime() === tomorrow.getTime()) return { key, label: "Mañana" };

  const label = day
    .toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "short" })
    .replace(".", "");
  return { key, label: label.charAt(0).toUpperCase() + label.slice(1) };
}

function getStatus(date: Date | null): {
  kind: "overdue" | "today" | "upcoming" | "none";
  label: string;
  classes: string;
} {
  if (!date) {
    return { kind: "none", label: "Sin fecha", classes: "bg-slate-100 text-slate-500" };
  }
  const today = startOfDay(new Date());
  const day = startOfDay(date);
  const diffMs = day.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { kind: "overdue", label: "Atrasado", classes: "bg-amber-50 text-amber-700" };
  }
  if (diffDays === 0) {
    return { kind: "today", label: "Hoy", classes: "bg-[#1A9B7D]/10 text-[#1A9B7D]" };
  }
  return { kind: "upcoming", label: "Próximo", classes: "bg-slate-100 text-slate-500" };
}

function medicationToItem(m: ActiveMedication): RoutineItem {
  // usamos nextDoseAt si existe (real), si no startDate (real). NADA inventado.
  const ref = parseDateSafe(m.nextDoseAt ?? m.startDate ?? null);
  const group = formatGroup(ref);
  return {
    id: `med_${m.id}`,
    category: "medication",
    name: m.name,
    frequency: m.frequency || m.dosage || "",
    dateRef: ref,
    groupKey: group.key,
    groupLabel: group.label,
  };
}

function appointmentToItem(a: Appointment): RoutineItem {
  const ref = parseDateSafe(a.date);
  const group = formatGroup(ref);
  const category: RoutineCategory = a.type === "vaccine" ? "vaccine" : "appointment";
  const parts: string[] = [];
  if (a.time) parts.push(a.time);
  if (a.veterinarian) parts.push(a.veterinarian);
  else if (a.clinic) parts.push(a.clinic);
  return {
    id: `appt_${a.id}`,
    category,
    name: a.title,
    frequency: parts.join(" · "),
    dateRef: ref,
    groupKey: group.key,
    groupLabel: group.label,
  };
}

function filterByRange(items: RoutineItem[], range: RangeTab): RoutineItem[] {
  if (range === "all") return items;
  const today = startOfDay(new Date());
  const horizon = new Date(today);
  horizon.setDate(today.getDate() + (range === "week" ? 7 : 31));
  return items.filter((it) => {
    if (!it.dateRef) return range === "all";
    const d = startOfDay(it.dateRef);
    // incluimos atrasados dentro de "esta semana/mes" para que el tutor los vea
    return d.getTime() <= horizon.getTime();
  });
}

export function RoutinesScreen({ onBack }: RoutinesScreenProps) {
  const navigate = useNavigate();
  const { activePet } = usePet();
  const { activeMedications, appointments } = useMedical();
  const [range, setRange] = useState<RangeTab>("week");

  const petName = activePet?.name ?? "";

  const items = useMemo<RoutineItem[]>(() => {
    if (!activePet) return [];
    const meds = activeMedications
      .filter((m) => m.petId === activePet.id && m.active)
      .map(medicationToItem);
    const appts = appointments
      .filter((a) => a.petId === activePet.id && a.status === "upcoming")
      .map(appointmentToItem);
    const all = [...meds, ...appts];
    all.sort((a, b) => {
      const at = a.dateRef ? a.dateRef.getTime() : Number.POSITIVE_INFINITY;
      const bt = b.dateRef ? b.dateRef.getTime() : Number.POSITIVE_INFINITY;
      return at - bt;
    });
    return all;
  }, [activePet, activeMedications, appointments]);

  const filtered = useMemo(() => filterByRange(items, range), [items, range]);

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: RoutineItem[] }>();
    for (const it of filtered) {
      const existing = map.get(it.groupKey);
      if (existing) existing.items.push(it);
      else map.set(it.groupKey, { label: it.groupLabel, items: [it] });
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  const handleAdd = () => navigate("/rutinas-eco/nuevo");

  // ── Sin mascota activa
  if (!activePet) {
    return (
      <div className="min-h-screen bg-[#F0FAF9]">
        <div className="max-w-md mx-auto">
          <header className="sticky top-0 z-10 bg-[#F0FAF9]/95 backdrop-blur border-b border-slate-200/60 px-4 py-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Volver"
              className="size-11 rounded-full flex items-center justify-center text-[#074738] transition-all active:scale-[0.97] duration-200"
            >
              <MaterialIcon name="arrow_back" className="text-2xl" />
            </button>
            <h1
              className="text-lg font-bold text-[#074738]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Rutinas
            </h1>
          </header>
          <EmptyState
            icon="pets"
            title="Seleccioná una mascota"
            description="Para ver las rutinas, primero elegí la mascota activa desde el inicio."
            actionLabel="Ir al inicio"
            onAction={() => navigate("/inicio")}
          />
        </div>
      </div>
    );
  }

  const isEmpty = items.length === 0;

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-24" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <div className="max-w-md mx-auto">
        {/* Header sticky */}
        <header className="sticky top-0 z-10 bg-[#F0FAF9]/95 backdrop-blur border-b border-slate-200/60 px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Volver"
            className="size-11 rounded-full flex items-center justify-center text-[#074738] transition-all active:scale-[0.97] duration-200"
          >
            <MaterialIcon name="arrow_back" className="text-2xl" />
          </button>
          <h1
            className="text-lg font-bold text-[#074738] truncate"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Rutinas de {petName}
          </h1>
        </header>

        {/* Tabs */}
        <div className="px-4 pt-4">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#E0F2F1]">
            {(
              [
                { key: "week", label: "Esta semana" },
                { key: "month", label: "Este mes" },
                { key: "all", label: "Todo" },
              ] as { key: RangeTab; label: string }[]
            ).map((t) => {
              const active = range === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setRange(t.key)}
                  className={`min-h-11 px-4 rounded-full text-sm font-semibold transition-all active:scale-[0.97] duration-200 ${
                    active
                      ? "bg-[#074738] text-white shadow-sm"
                      : "text-[#074738]/70 hover:text-[#074738]"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenido */}
        <main className="px-4 pt-4">
          {isEmpty ? (
            <EmptyState
              icon="calendar_add_on"
              title="Sin rutinas todavía"
              description="Todavía no hay rutinas cargadas. Subí un documento o agregá una a mano."
              actionLabel="Agregar recordatorio"
              onAction={handleAdd}
            />
          ) : grouped.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-500">
                No hay rutinas en este rango. Probá "Todo" para ver todas las cargadas.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(([key, group]) => (
                <section key={key}>
                  <h2
                    className="text-xs font-bold uppercase tracking-wider text-[#074738]/60 mb-2 px-1"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {group.label}
                  </h2>
                  <ul className="space-y-2">
                    {group.items.map((it) => {
                      const style = CATEGORY_STYLES[it.category];
                      const status = getStatus(it.dateRef);
                      return (
                        <li
                          key={it.id}
                          className="bg-white rounded-2xl p-3 flex items-center gap-3 border border-slate-200/60 transition-all active:scale-[0.97] duration-200"
                        >
                          <div
                            className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${style.iconBg}`}
                          >
                            <MaterialIcon
                              name={style.icon}
                              className={`text-2xl ${style.iconColor}`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-bold text-[#074738] truncate"
                              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                            >
                              {it.name}
                            </p>
                            {it.frequency && (
                              <p className="text-xs text-slate-500 truncate">{it.frequency}</p>
                            )}
                          </div>
                          <span
                            className={`text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ${status.classes}`}
                          >
                            {status.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              {/* CTA siempre visible para agregar algo */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAdd}
                  className="w-full min-h-11 px-4 py-3 rounded-2xl border-2 border-dashed border-[#074738]/30 text-sm font-bold text-[#074738] flex items-center justify-center gap-2 transition-all active:scale-[0.97] duration-200 hover:border-[#074738]/60"
                >
                  <MaterialIcon name="add_circle" className="text-xl" />
                  Agregar recordatorio
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default RoutinesScreen;
