import { MaterialIcon } from "../shared/MaterialIcon";
import type { ClinicalProfileSnapshot } from "../../contexts/MedicalContext";

interface ClinicalProfileBlockProps {
    snapshot: ClinicalProfileSnapshot;
    petName: string;
}

function ChipList({ items, tone }: { items: string[]; tone: string }) {
    if (!items.length) return null;
    return (
        <div className="flex flex-wrap gap-1.5">
            {items.map((item, i) => (
                <span key={i} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tone}`}>
                    {item}
                </span>
            ))}
        </div>
    );
}

export function ClinicalProfileBlock({ snapshot, petName }: ClinicalProfileBlockProps) {
    const hasData =
        snapshot.activeConditions.length > 0 ||
        snapshot.currentMedications.length > 0 ||
        snapshot.narrative;

    if (!hasData) return null;

    return (
        <div className="rounded-[20px] border border-[#074738]/20 bg-gradient-to-br from-[#074738]/8 to-[#074738]/3 p-4 mb-5 shadow-sm animate-fadeIn">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <div className="size-7 rounded-full bg-[#074738]/15 flex items-center justify-center shrink-0">
                    <MaterialIcon name="medical_information" className="text-[#074738] text-sm" />
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#074738]">
                        Perfil Vivo
                    </p>
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight">
                        {petName}
                    </p>
                </div>
            </div>

            {/* Narrativa */}
            {snapshot.narrative && (
                <p className="text-[12px] text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                    {snapshot.narrative}
                </p>
            )}

            {/* Condiciones activas */}
            {snapshot.activeConditions.length > 0 && (
                <div className="mb-2">
                    <p className="text-[9px] font-black uppercase tracking-wide text-slate-400 mb-1">Temas activos</p>
                    <ChipList
                        items={snapshot.activeConditions}
                        tone="bg-blue-100 text-blue-700 border border-blue-200/60"
                    />
                </div>
            )}

            {/* Medicación actual */}
            {snapshot.currentMedications.length > 0 && (
                <div className="mb-2">
                    <p className="text-[9px] font-black uppercase tracking-wide text-slate-400 mb-1">Cuidados actuales</p>
                    <ChipList
                        items={snapshot.currentMedications.map((m) =>
                            [m.name, m.dosage].filter(Boolean).join(" · ")
                        )}
                        tone="bg-amber-100 text-amber-700 border border-amber-200/60"
                    />
                </div>
            )}

            {/* Alergias */}
            {snapshot.allergies.length > 0 && (
                <div className="mb-2">
                    <p className="text-[9px] font-black uppercase tracking-wide text-slate-400 mb-1">Alergias</p>
                    <ChipList
                        items={snapshot.allergies}
                        tone="bg-red-100 text-red-700 border border-red-200/60"
                    />
                </div>
            )}

            {/* Patologías recurrentes */}
            {snapshot.recurrentPathologies.length > 0 && (
                <div>
                    <p className="text-[9px] font-black uppercase tracking-wide text-slate-400 mb-1">Recurrentes</p>
                    <ChipList
                        items={snapshot.recurrentPathologies}
                        tone="bg-orange-100 text-orange-700 border border-orange-200/60"
                    />
                </div>
            )}

            {/* Footer */}
            <p className="text-[9px] text-slate-400 mt-3 text-right">
                Actualizado {new Date(snapshot.generatedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
        </div>
    );
}
