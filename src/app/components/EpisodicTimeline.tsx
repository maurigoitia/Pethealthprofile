import { useMemo } from "react";

interface MedicalEvent {
  id: string;
  date: string;
  title: string;
  type: "vaccine" | "treatment" | "surgery" | "routine";
}

const TYPE_COLORS: Record<MedicalEvent["type"], string> = {
  vaccine: "bg-emerald-500",
  treatment: "bg-blue-500",
  surgery: "bg-red-500",
  routine: "bg-amber-500",
};

export function EpisodicTimeline({ events }: { events: MedicalEvent[] }) {
  const episodes = useMemo(() => {
    const grouped = events.reduce(
      (acc, event) => {
        const d = new Date(event.date);
        const capsule = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
        if (!acc[capsule]) acc[capsule] = [];
        acc[capsule].push(event);
        return acc;
      },
      {} as Record<string, MedicalEvent[]>,
    );

    // Ordenar eventos dentro de cada cápsula por fecha descendente
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return grouped;
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 dark:text-slate-500">
        <p className="text-sm">Sin eventos médicos registrados aún.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-20">
      {Object.entries(episodes).map(([capsuleName, capsuleEvents]) => (
        <div
          key={capsuleName}
          className="bg-white dark:bg-slate-900 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-slate-800"
        >
          <div className="flex justify-between items-center mb-4 border-b border-gray-50 dark:border-slate-800 pb-3">
            <h3 className="text-lg font-black text-[#074738] dark:text-emerald-400 capitalize">
              {capsuleName}
            </h3>
            <span className="text-xs font-bold bg-[#074738]/10 text-[#074738] dark:bg-emerald-900/30 dark:text-emerald-400 px-3 py-1 rounded-full">
              {capsuleEvents.length} {capsuleEvents.length === 1 ? "evento" : "eventos"}
            </span>
          </div>

          <div className="space-y-3">
            {capsuleEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${TYPE_COLORS[ev.type]}`} />
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{ev.title}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(ev.date).toLocaleDateString("es-AR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
