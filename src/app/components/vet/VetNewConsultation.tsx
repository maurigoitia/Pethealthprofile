import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { collection, addDoc, doc, updateDoc, increment } from "firebase/firestore";

export function VetNewConsultation() {
  const navigate = useNavigate();
  const { user, userName } = useAuth();
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("Perro");
  const [breed, setBreed] = useState("");
  const [tutorName, setTutorName] = useState("");
  const [tutorEmail, setTutorEmail] = useState("");
  const [reason, setReason] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [weight, setWeight] = useState("");
  const [temperature, setTemperature] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petName.trim()) { setError("El nombre del paciente es obligatorio."); return; }
    if (!tutorName.trim()) { setError("El nombre del tutor es obligatorio."); return; }
    if (!reason.trim()) { setError("El motivo de consulta es obligatorio."); return; }
    if (!user) return;
    setError(""); setLoading(true);    try {
      await addDoc(collection(db, "consultations"), {
        vetId: user.uid,
        vetName: userName || user.displayName || "Veterinario",
        petName: petName.trim(),
        species, breed: breed.trim(),
        tutorName: tutorName.trim(),
        tutorEmail: tutorEmail.trim().toLowerCase() || null,
        reason: reason.trim(),
        symptoms: symptoms.trim() || null,
        weight: weight.trim() || null,
        temperature: temperature.trim() || null,
        diagnosis: "", treatment: "", notes: "",
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      // Increment patient count
      try { await updateDoc(doc(db, "vetProfiles", user.uid), { patientsCount: increment(1) }); } catch {}
      navigate("/vet/dashboard");
    } catch (err) {
      console.warn("[PessyVet] Error creating consultation:", err);
      setError("No se pudo crear la consulta. Intentá nuevamente.");
    } finally { setLoading(false); }
  };

  const inputClass = "w-full px-4 py-3.5 rounded-[14px] border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none text-slate-900 placeholder:text-slate-400 text-sm";

  return (
    <div className="min-h-screen font-['Manrope',sans-serif]" style={{ background: "#F0FAF9" }}>
      <div className="max-w-md mx-auto min-h-screen flex flex-col pb-8">        {/* Header */}
        <div className="px-5 pt-12 pb-4 flex items-center gap-3">
          <button onClick={() => navigate("/vet/dashboard")}
            className="size-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-slate-700" style={{ fontSize: "20px" }}>arrow_back</span>
          </button>
          <h1 className="text-xl font-black text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            Nueva consulta
          </h1>
        </div>

        <form onSubmit={handleCreate} className="px-5 space-y-4 flex-1">
          {/* Patient section */}
          <div className="bg-white rounded-[16px] p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <h3 className="text-xs font-bold text-[#074738] uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>pets</span> Paciente
            </h3>
            <div className="space-y-3">
              <input type="text" placeholder="Nombre del paciente *" value={petName}
                onChange={(e) => setPetName(e.target.value)} className={inputClass} required />
              <div className="grid grid-cols-2 gap-3">
                <select value={species} onChange={(e) => setSpecies(e.target.value)}
                  className={`${inputClass} appearance-none bg-white cursor-pointer`}>
                  <option value="Perro">🐕 Perro</option>
                  <option value="Gato">🐈 Gato</option>
                  <option value="Ave">🐦 Ave</option>
                  <option value="Conejo">🐇 Conejo</option>
                  <option value="Otro">Otro</option>
                </select>
                <input type="text" placeholder="Raza" value={breed}
                  onChange={(e) => setBreed(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>
          {/* Tutor section */}
          <div className="bg-white rounded-[16px] p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <h3 className="text-xs font-bold text-[#074738] uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>person</span> Tutor
            </h3>
            <div className="space-y-3">
              <input type="text" placeholder="Nombre del tutor *" value={tutorName}
                onChange={(e) => setTutorName(e.target.value)} className={inputClass} required />
              <input type="email" placeholder="Email del tutor (opcional)" value={tutorEmail}
                onChange={(e) => setTutorEmail(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Consultation details */}
          <div className="bg-white rounded-[16px] p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <h3 className="text-xs font-bold text-[#074738] uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>clinical_notes</span> Consulta
            </h3>
            <div className="space-y-3">
              <input type="text" placeholder="Motivo de consulta *" value={reason}
                onChange={(e) => setReason(e.target.value)} className={inputClass} required />
              <textarea rows={3} placeholder="Síntomas observados (opcional)" value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)} className={inputClass} />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Peso (kg)" value={weight}
                  onChange={(e) => setWeight(e.target.value)} className={inputClass} />
                <input type="text" placeholder="Temp (°C)" value={temperature}
                  onChange={(e) => setTemperature(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>
          {error && <p className="text-red-500 text-sm font-semibold text-center">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-[14px] bg-[#074738] text-white font-bold shadow-[0_4px_12px_rgba(7,71,56,0.3)] disabled:opacity-60">
            {loading ? "Creando..." : "Registrar consulta"}
          </button>
        </form>
      </div>
    </div>
  );
}