import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

interface Consultation {
  id: string;
  petName: string;
  species: string;
  breed: string;
  tutorName: string;
  tutorEmail: string;
  reason: string;
  symptoms: string;
  diagnosis: string;
  treatment: string;
  notes: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: string;
  weight?: string;
  temperature?: string;
}

interface Props {
  consultationId: string;
  onBack: () => void;
}

export function VetConsultationView({ consultationId, onBack }: Props) {
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ diagnosis: "", treatment: "", notes: "", weight: "", temperature: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "consultations", consultationId));
        if (snap.exists()) {
          const data = snap.data();
          const c: Consultation = {
            id: snap.id, petName: data.petName || "", species: data.species || "",
            breed: data.breed || "", tutorName: data.tutorName || "", tutorEmail: data.tutorEmail || "",
            reason: data.reason || "", symptoms: data.symptoms || "", diagnosis: data.diagnosis || "",
            treatment: data.treatment || "", notes: data.notes || "",
            status: data.status || "pending", createdAt: data.createdAt || "",
            weight: data.weight || "", temperature: data.temperature || "",
          };
          setConsultation(c);
          setEditData({ diagnosis: c.diagnosis, treatment: c.treatment, notes: c.notes, weight: c.weight || "", temperature: c.temperature || "" });
        }
      } catch (err) { console.warn("[PessyVet] Error loading consultation:", err); }
      finally { setLoading(false); }
    };
    load();
  }, [consultationId]);

  const handleSave = async () => {
    if (!consultation) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "consultations", consultationId), {
        ...editData, status: "in_progress", updatedAt: new Date().toISOString(),
      });
      setConsultation({ ...consultation, ...editData, status: "in_progress" });
      setEditing(false);
    } catch (err) { console.warn("[PessyVet] Error saving:", err); }
    finally { setSaving(false); }
  };
  const handleComplete = async () => {
    if (!consultation) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "consultations", consultationId), {
        ...editData, status: "completed", completedAt: new Date().toISOString(),
      });
      setConsultation({ ...consultation, ...editData, status: "completed" });
      setEditing(false);
    } catch (err) { console.warn("[PessyVet] Error completing:", err); }
    finally { setSaving(false); }
  };

  const statusColor = { pending: "bg-amber-100 text-amber-700", in_progress: "bg-blue-100 text-blue-700", completed: "bg-emerald-100 text-emerald-700" };
  const statusLabel = { pending: "Pendiente", in_progress: "En curso", completed: "Completada" };
  const inputClass = "w-full px-4 py-3 rounded-[12px] border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#074738] outline-none text-sm";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F0FAF9" }}>
        <div className="mx-auto size-8 rounded-full border-3 border-[#074738]/20 border-t-[#074738] animate-spin" />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#F0FAF9" }}>
        <div className="text-center">
          <p className="font-bold text-slate-900">Consulta no encontrada</p>
          <button onClick={onBack} className="mt-4 px-5 py-2 rounded-xl bg-[#074738] text-white font-bold text-sm">Volver</button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen font-['Manrope',sans-serif]" style={{ background: "#F0FAF9" }}>
      <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
        {/* Header */}
        <div className="px-5 pt-12 pb-4 flex items-center gap-3">
          <button onClick={onBack} className="size-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-slate-700" style={{ fontSize: "20px" }}>arrow_back</span>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
              {consultation.petName}
            </h1>
            <p className="text-slate-500 text-xs">{consultation.species}{consultation.breed ? ` · ${consultation.breed}` : ""}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColor[consultation.status]}`}>
            {statusLabel[consultation.status]}
          </span>
        </div>

        <div className="px-5 space-y-4 flex-1">
          {/* Patient info card */}
          <div className="bg-white rounded-[16px] p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-full bg-[#E0F2F1] flex items-center justify-center">
                <span className="material-symbols-outlined text-[#074738]" style={{ fontSize: "20px" }}>person</span>
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">{consultation.tutorName}</p>
                <p className="text-slate-500 text-xs">{consultation.tutorEmail || "Sin email"}</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-[12px] p-3">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Motivo de consulta</p>
              <p className="text-sm text-slate-900">{consultation.reason || "No especificado"}</p>
            </div>            {consultation.symptoms && (
              <div className="bg-slate-50 rounded-[12px] p-3 mt-2">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Síntomas reportados</p>
                <p className="text-sm text-slate-900">{consultation.symptoms}</p>
              </div>
            )}
          </div>

          {/* Clinical data — editable */}
          <div className="bg-white rounded-[16px] p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm">Datos clínicos</h3>
              {!editing && consultation.status !== "completed" && (
                <button onClick={() => setEditing(true)} className="text-[#074738] text-xs font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit</span> Editar
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Peso (kg)</label>
                    <input type="text" placeholder="Ej: 5.2" value={editData.weight}
                      onChange={(e) => setEditData({ ...editData, weight: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Temperatura (°C)</label>
                    <input type="text" placeholder="Ej: 38.5" value={editData.temperature}
                      onChange={(e) => setEditData({ ...editData, temperature: e.target.value })} className={inputClass} />
                  </div>
                </div>                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Diagnóstico</label>
                  <textarea rows={2} placeholder="Diagnóstico presuntivo o definitivo" value={editData.diagnosis}
                    onChange={(e) => setEditData({ ...editData, diagnosis: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Tratamiento</label>
                  <textarea rows={2} placeholder="Indicaciones y medicación" value={editData.treatment}
                    onChange={(e) => setEditData({ ...editData, treatment: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Notas</label>
                  <textarea rows={2} placeholder="Observaciones adicionales" value={editData.notes}
                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })} className={inputClass} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-3 rounded-[12px] bg-[#074738] text-white font-bold text-sm disabled:opacity-60">
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                  <button onClick={handleComplete} disabled={saving}
                    className="flex-1 py-3 rounded-[12px] bg-emerald-600 text-white font-bold text-sm disabled:opacity-60">
                    Completar
                  </button>
                </div>
                <button onClick={() => setEditing(false)} className="w-full py-2 text-slate-500 text-sm font-bold">Cancelar</button>
              </div>
            ) : (
              <div className="space-y-3">
                {(consultation.weight || consultation.temperature) && (
                  <div className="grid grid-cols-2 gap-3">
                    {consultation.weight && <div className="bg-slate-50 rounded-[12px] p-3"><p className="text-[10px] font-bold text-slate-500 uppercase">Peso</p><p className="text-sm font-bold text-slate-900">{consultation.weight} kg</p></div>}
                    {consultation.temperature && <div className="bg-slate-50 rounded-[12px] p-3"><p className="text-[10px] font-bold text-slate-500 uppercase">Temp</p><p className="text-sm font-bold text-slate-900">{consultation.temperature} °C</p></div>}
                  </div>
                )}                {consultation.diagnosis ? (
                  <div className="bg-slate-50 rounded-[12px] p-3"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Diagnóstico</p><p className="text-sm text-slate-900">{consultation.diagnosis}</p></div>
                ) : <p className="text-slate-400 text-sm italic">Sin diagnóstico registrado</p>}
                {consultation.treatment ? (
                  <div className="bg-slate-50 rounded-[12px] p-3"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Tratamiento</p><p className="text-sm text-slate-900">{consultation.treatment}</p></div>
                ) : <p className="text-slate-400 text-sm italic">Sin tratamiento registrado</p>}
                {consultation.notes && (
                  <div className="bg-slate-50 rounded-[12px] p-3"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Notas</p><p className="text-sm text-slate-900">{consultation.notes}</p></div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}