import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { collection, addDoc, doc, updateDoc, increment } from "firebase/firestore";

// Firestore consultation schema:
// consultations/{id}: {
//   vetId, vetName, petName, species, breed, tutorName, tutorEmail,
//   soapData: {
//     s: { motivo, sintomas },
//     o: { peso, temperatura, frecuenciaCardiaca, frecuenciaRespiratoria, examenFisico },
//     a: { diagnosticoPT, diagnosticoDiferencial },
//     p: { tratamiento, medicamentos, proximosPasos, proxConsulta }
//   },
//   status: "pending" | "in_progress" | "completed",
//   createdAt, updatedAt
// }

export function VetNewConsultation() {
  const navigate = useNavigate();
  const { user, userName } = useAuth();
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("Perro");
  const [breed, setBreed] = useState("");
  const [tutorName, setTutorName] = useState("");
  const [tutorEmail, setTutorEmail] = useState("");

  // S - SUBJETIVO
  const [motivo, setMotivo] = useState("");
  const [sintomas, setSintomas] = useState("");

  // O - OBJETIVO
  const [peso, setPeso] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [frecuenciaCardiaca, setFrecuenciaCardiaca] = useState("");
  const [frecuenciaRespiratoria, setFrecuenciaRespiratoria] = useState("");
  const [examenFisico, setExamenFisico] = useState("");

  // A - ASSESSMENT
  const [diagnosticoPT, setDiagnosticoPT] = useState("");
  const [diagnosticoDiferencial, setDiagnosticoDiferencial] = useState("");

  // P - PLAN
  const [tratamiento, setTratamiento] = useState("");
  const [medicamentos, setMedicamentos] = useState("");
  const [proximosPasos, setProximosPasos] = useState("");
  const [proxConsulta, setProxConsulta] = useState("");

  const [expandedSection, setExpandedSection] = useState<"s" | "o" | "a" | "p" | null>("s");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petName.trim() || !tutorName.trim() || !motivo.trim()) {
      setError("Completá los campos obligatorios: mascota, tutor, motivo de consulta.");
      return;
    }
    if (!user) return;
    setError("");
    setLoading(true);

    try {
      await addDoc(collection(db, "consultations"), {
        vetId: user.uid,
        vetName: userName || user.displayName || "Vet",
        petName: petName.trim(),
        species,
        breed: breed.trim() || null,
        tutorName: tutorName.trim(),
        tutorEmail: tutorEmail.trim().toLowerCase() || null,
        soapData: {
          s: {
            motivo: motivo.trim(),
            sintomas: sintomas.trim() || null,
          },
          o: {
            peso: peso.trim() || null,
            temperatura: temperatura.trim() || null,
            frecuenciaCardiaca: frecuenciaCardiaca.trim() || null,
            frecuenciaRespiratoria: frecuenciaRespiratoria.trim() || null,
            examenFisico: examenFisico.trim() || null,
          },
          a: {
            diagnosticoPT: diagnosticoPT.trim() || null,
            diagnosticoDiferencial: diagnosticoDiferencial.trim() || null,
          },
          p: {
            tratamiento: tratamiento.trim() || null,
            medicamentos: medicamentos.trim() || null,
            proximosPasos: proximosPasos.trim() || null,
            proxConsulta: proxConsulta.trim() || null,
          },
        },
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      try {
        await updateDoc(doc(db, "vetProfiles", user.uid), {
          patientsCount: increment(1),
        });
      } catch {}
      navigate("/vet/dashboard");
    } catch {
      setError("No se pudo crear la consulta.");
    } finally {
      setLoading(false);
    }
  };

  const ic =
    "w-full px-4 py-3.5 rounded-[12px] border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none text-sm text-slate-900 placeholder:text-slate-400";

  const getSectionColor = (section: "s" | "o" | "a" | "p") => {
    const colors = {
      s: "bg-blue-50 border-blue-200",
      o: "bg-green-50 border-green-200",
      a: "bg-amber-50 border-amber-200",
      p: "bg-purple-50 border-purple-200",
    };
    return colors[section];
  };

  const getSectionHeaderColor = (section: "s" | "o" | "a" | "p") => {
    const colors = {
      s: "bg-blue-100 text-blue-700",
      o: "bg-green-100 text-green-700",
      a: "bg-amber-100 text-amber-700",
      p: "bg-purple-100 text-purple-700",
    };
    return colors[section];
  };

  const getSectionLabel = (section: "s" | "o" | "a" | "p") => {
    const labels = {
      s: { label: "S - SUBJETIVO", icon: "hearing" },
      o: { label: "O - OBJETIVO", icon: "stethoscope" },
      a: { label: "A - ANÁLISIS", icon: "assessment" },
      p: { label: "P - PLAN", icon: "playlist_add_check" },
    };
    return labels[section];
  };

  const toggleSection = (section: "s" | "o" | "a" | "p") => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "#F0FAF9", fontFamily: "'Manrope',sans-serif" }}
    >
      <div className="max-w-md mx-auto pb-8">
        <div className="px-5 pt-12 pb-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/vet/dashboard")}
            aria-label="Volver al dashboard"
            className="size-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm focus-visible:ring-2 focus-visible:ring-[#074738] focus-visible:ring-offset-2"
          >
            <span
              className="material-symbols-outlined text-slate-700"
              style={{ fontSize: "20px" }}
            >
              arrow_back
            </span>
          </button>
          <h1
            className="text-xl font-black text-slate-900"
            style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}
          >
            Nueva consulta
          </h1>
        </div>

        <form onSubmit={handleCreate} className="px-5 space-y-4">
          {/* Patient & Tutor Info */}
          <div className="bg-white rounded-[16px] p-4 border border-[rgba(0,0,0,0.04)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <h3 className="text-xs font-bold text-[#074738] uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                pets
              </span>
              Paciente
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nombre del paciente *"
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                className={ic}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={species}
                  onChange={(e) => setSpecies(e.target.value)}
                  className={`${ic} appearance-none bg-white`}
                >
                  <option value="Perro">🐕 Perro</option>
                  <option value="Gato">🐈 Gato</option>
                  <option value="Ave">🐦 Ave</option>
                  <option value="Otro">Otro</option>
                </select>
                <input
                  type="text"
                  placeholder="Raza"
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  className={ic}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[16px] p-4 border border-[rgba(0,0,0,0.04)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <h3 className="text-xs font-bold text-[#074738] uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                person
              </span>
              Tutor
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nombre del tutor *"
                value={tutorName}
                onChange={(e) => setTutorName(e.target.value)}
                className={ic}
                required
              />
              <input
                type="email"
                placeholder="Email (opcional)"
                value={tutorEmail}
                onChange={(e) => setTutorEmail(e.target.value)}
                className={ic}
              />
            </div>
          </div>

          {/* SOAP Sections */}

          {/* S - SUBJETIVO */}
          <div className={`rounded-[16px] border-2 ${getSectionColor("s")}`}>
            <button
              type="button"
              onClick={() => toggleSection("s")}
              className={`w-full px-4 py-3 flex items-center justify-between rounded-t-[14px] ${getSectionHeaderColor("s")} font-bold text-sm`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  {getSectionLabel("s").icon}
                </span>
                {getSectionLabel("s").label}
              </div>
              <span className="material-symbols-outlined text-lg">
                {expandedSection === "s" ? "expand_less" : "expand_more"}
              </span>
            </button>
            {expandedSection === "s" && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                    Motivo de consulta *
                  </label>
                  <input
                    type="text"
                    placeholder="¿Por qué trae a la mascota?"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className={ic}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                    Síntomas reportados
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Síntomas observados por el tutor"
                    value={sintomas}
                    onChange={(e) => setSintomas(e.target.value)}
                    className={ic}
                  />
                </div>
              </div>
            )}
          </div>

          {/* O - OBJETIVO */}
          <div className={`rounded-[16px] border-2 ${getSectionColor("o")}`}>
            <button
              type="button"
              onClick={() => toggleSection("o")}
              className={`w-full px-4 py-3 flex items-center justify-between rounded-t-[14px] ${getSectionHeaderColor("o")} font-bold text-sm`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  {getSectionLabel("o").icon}
                </span>
                {getSectionLabel("o").label}
              </div>
              <span className="material-symbols-outlined text-lg">
                {expandedSection === "o" ? "expand_less" : "expand_more"}
              </span>
            </button>
            {expandedSection === "o" && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                      Peso (kg)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 25.5"
                      value={peso}
                      onChange={(e) => setPeso(e.target.value)}
                      className={ic}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                      Temperatura (°C)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 38.5"
                      value={temperatura}
                      onChange={(e) => setTemperatura(e.target.value)}
                      className={ic}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                      Freq. cardíaca (bpm)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 90"
                      value={frecuenciaCardiaca}
                      onChange={(e) => setFrecuenciaCardiaca(e.target.value)}
                      className={ic}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                      Freq. respiratoria (rpm)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 25"
                      value={frecuenciaRespiratoria}
                      onChange={(e) => setFrecuenciaRespiratoria(e.target.value)}
                      className={ic}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                    Examen físico
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Hallazgos del examen físico"
                    value={examenFisico}
                    onChange={(e) => setExamenFisico(e.target.value)}
                    className={ic}
                  />
                </div>
              </div>
            )}
          </div>

          {/* A - ASSESSMENT */}
          <div className={`rounded-[16px] border-2 ${getSectionColor("a")}`}>
            <button
              type="button"
              onClick={() => toggleSection("a")}
              className={`w-full px-4 py-3 flex items-center justify-between rounded-t-[14px] ${getSectionHeaderColor("a")} font-bold text-sm`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  {getSectionLabel("a").icon}
                </span>
                {getSectionLabel("a").label}
              </div>
              <span className="material-symbols-outlined text-lg">
                {expandedSection === "a" ? "expand_less" : "expand_more"}
              </span>
            </button>
            {expandedSection === "a" && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                    Nota inicial
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Nota inicial"
                    value={diagnosticoPT}
                    onChange={(e) => setDiagnosticoPT(e.target.value)}
                    className={ic}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                    Consideraciones adicionales
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Otras consideraciones a revisar"
                    value={diagnosticoDiferencial}
                    onChange={(e) => setDiagnosticoDiferencial(e.target.value)}
                    className={ic}
                  />
                </div>
              </div>
            )}
          </div>

          {/* P - PLAN */}
          <div className={`rounded-[16px] border-2 ${getSectionColor("p")}`}>
            <button
              type="button"
              onClick={() => toggleSection("p")}
              className={`w-full px-4 py-3 flex items-center justify-between rounded-t-[14px] ${getSectionHeaderColor("p")} font-bold text-sm`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  {getSectionLabel("p").icon}
                </span>
                {getSectionLabel("p").label}
              </div>
              <span className="material-symbols-outlined text-lg">
                {expandedSection === "p" ? "expand_less" : "expand_more"}
              </span>
            </button>
            {expandedSection === "p" && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                    Tratamiento
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Plan de tratamiento"
                    value={tratamiento}
                    onChange={(e) => setTratamiento(e.target.value)}
                    className={ic}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                    Medicamentos
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Medicamentos prescritos (nombre, dosis, frecuencia)"
                    value={medicamentos}
                    onChange={(e) => setMedicamentos(e.target.value)}
                    className={ic}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                    Próximos pasos
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Recomendaciones y próximos pasos"
                    value={proximosPasos}
                    onChange={(e) => setProximosPasos(e.target.value)}
                    className={ic}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                    Fecha próxima consulta
                  </label>
                  <input
                    type="date"
                    value={proxConsulta}
                    onChange={(e) => setProxConsulta(e.target.value)}
                    className={ic}
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-red-500 text-sm font-semibold text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-[14px] bg-[#1A9B7D] text-white font-bold text-sm shadow-[0_4px_12px_rgba(26,155,125,0.3)] active:scale-[0.97] transition-all duration-150 disabled:opacity-60"
            style={{ fontFamily: "'Manrope',sans-serif" }}
          >
            {loading ? "Creando..." : "Registrar consulta SOAP"}
          </button>
        </form>
      </div>
    </div>
  );
}
