import { MaterialIcon } from "../shared/MaterialIcon";
import type { ClinicalProfileSnapshot } from "../../contexts/MedicalContext";

interface ClinicalProfileBlockProps {
    snapshot: ClinicalProfileSnapshot;
    petName: string;
}

function SoapLabel({ letter, label, color }: { letter: string; label: string; color: string }) {
    return (
        <div className="flex items-center gap-1.5 mb-1.5">
            <span className={`text-[9px] font-black w-5 h-5 rounded flex items-center justify-center shrink-0 ${color}`}>
                {letter}
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</span>
        </div>
    );
}

function buildFallbackNarrative(snapshot: ClinicalProfileSnapshot, petName: string): string {
    const parts: string[] = [];
    if (snapshot.activeConditions.length > 0) {
        parts.push(`${petName} tiene ${snapshot.activeConditions.length === 1 ? "un tema activo" : `${snapshot.activeConditions.length} temas activos`}: ${snapshot.activeConditions.join(", ")}`);
    }
    if (snapshot.currentMedications.length > 0) {
        const medNames = snapshot.currentMedications.map((m) => m.name).join(", ");
        parts.push(`Medicación: ${medNames}`);
    }
    if (parts.length === 0) return "";
    return parts.join(". ") + ".";
}

export function ClinicalProfileBlock({ snapshot, petName }: ClinicalProfileBlockProps) {
    const hasData =
        snapshot.activeConditions.length > 0 ||
        snapshot.currentMedications.length > 0 ||
        snapshot.allergies.length > 0 ||
        snapshot.recurrentPathologies.length > 0 ||
        snapshot.narrative;

    if (!hasData) return null;

    const narrative = snapshot.narrative || buildFallbackNarrative(snapshot, petName);

    // O — Objective: medications + allergies
    const hasMeds = snapshot.currentMedications.length > 0;
    const hasAllergies = snapshot.allergies.length > 0;
    const hasObjective = hasMeds || hasAllergies;

    // A — Assessment: active conditions + recurrent patterns
    const hasConditions = snapshot.activeConditions.length > 0;
    const hasRecurrent = snapshot.recurrentPathologies.length > 0;
    const hasAssessment = hasConditions || hasRecurrent;

    return (
        <div className="rounded-[20px] border border-[#074738]/20 bg-gradient-to-br from-[#074738]/8 to-[#074738]/3 p-4 mb-5 shadow-sm animate-fadeIn">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <div className="size-7 rounded-full bg-[#074738]/15 flex items-center justify-center shrink-0">
                    <MaterialIcon name="medical_information" className="text-[#074738] text-sm" />
                </div>
                <div className="flex-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#074738]">
                        Perfil Clínico · SOAP
                    </p>
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight">
                        {petName}
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                {/* S — Subjective */}
                {narrative && (
                    <div>
                        <SoapLabel letter="S" label="Subjetivo" color="bg-slate-100 text-slate-500" />
                        <p className="text-[12px] text-slate-700 dark:text-slate-300 leading-relaxed pl-6">
                            {narrative}
                        </p>
                    </div>
                )}

                {/* O — Objective */}
                {hasObjective && (
                    <div>
                        <SoapLabel letter="O" label="Objetivo" color="bg-blue-100 text-blue-600" />
                        <div className="pl-6 space-y-1.5">
                            {hasMeds && (
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1">Medicación activa</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {snapshot.currentMedications.map((m, i) => (
                                            <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200/60">
                                                {[m.name, m.dosage].filter(Boolean).join(" · ")}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {hasAllergies && (
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1">Alergias</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {snapshot.allergies.map((a, i) => (
                                            <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200/60">
                                                {a}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* A — Assessment */}
                {hasAssessment && (
                    <div>
                        <SoapLabel letter="A" label="Análisis Pessy" color="bg-amber-100 text-amber-600" />
                        <div className="pl-6 space-y-1.5">
                            {hasConditions && (
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1">Temas activos</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {snapshot.activeConditions.map((c, i) => (
                                            <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200/60">
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {hasRecurrent && (
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1">Patrón recurrente</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {snapshot.recurrentPathologies.map((p, i) => (
                                            <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200/60">
                                                {p}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <p className="text-[9px] text-slate-400 mt-3 text-right">
                Actualizado {new Date(snapshot.generatedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
        </div>
    );
}
