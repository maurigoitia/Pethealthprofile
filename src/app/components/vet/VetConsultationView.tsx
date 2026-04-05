import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

interface SoapData {
  s?: { motivo?: string; sintomas?: string | null };
  o?: { 
    peso?: string | null; 
    temperatura?: string | null;
    frecuenciaCardiaca?: string | null;
    frecuenciaRespiratoria?: string | null;
    examenFisico?: string | null;
  };
  a?: { 
    diagnosticoPT?: string | null; 
    diagnosticoDiferencial?: string | null;
  };
  p?: {
    tratamiento?: string | null;
    medicamentos?: string | null;
    proximosPasos?: string | null;
    proxConsulta?: string | null;
  };
}

interface C {
  id: string;
  petName: string;
  species: string;
  breed: string;
  tutorName: string;
  reason?: string;
  symptoms?: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: string;
  weight?: string;
  temperature?: string;
  soapData?: SoapData;
}

interface Props {
  consultationId: string;
  onBack: () => void;
}

export function VetConsultationView({ consultationId, onBack }: Props) {
  const [c, setC] = useState<C | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"s" | "o" | "a" | "p" | null>(null);
  const [ed, setEd] = useState<{
    s: { motivo?: string; sintomas?: string | null };
    o: { 
      peso?: string | null;
      temperatura?: string | null;
      frecuenciaCardiaca?: string | null;
      frecuenciaRespiratoria?: string | null;
      examenFisico?: string | null;
    };
    a: { 
      diagnosticoPT?: string | null;
      diagnosticoDiferencial?: string | null;
    };
    p: {
      tratamiento?: string | null;
      medicamentos?: string | null;
      proximosPasos?: string | null;
      proxConsulta?: string | null;
    };
  }>({
    s: {},
    o: {},
    a: {},
    p: {},
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await getDoc(doc(db, "consultations", consultationId));
        if (s.exists()) {
          const d = s.data();
          const x: C = {
            id: s.id,
            petName: d.petName || "",
            species: d.species || "",
            breed: d.breed || "",
            tutorName: d.tutorName || "",
            reason: d.reason || "",
            symptoms: d.symptoms || "",
            diagnosis: d.diagnosis || "",
            treatment: d.treatment || "",
            notes: d.notes || "",
            status: d.status || "pending",
            createdAt: d.createdAt || "",
            weight: d.weight || "",
            temperature: d.temperature || "",
            soapData: d.soapData || {},
          };
          setC(x);
          setEd({
            s: d.soapData?.s || {},
            o: d.soapData?.o || {},
            a: d.soapData?.a || {},
            p: d.soapData?.p || {},
          });
        }
      } catch {}
      finally {
        setLoading(false);
      }
    })();
  }, [consultationId]);

  const save = async (complete = false) => {
    if (!c) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "consultations", consultationId), {
        soapData: ed,
        status: complete ? "completed" : "in_progress",
        updatedAt: new Date().toISOString(),
      });
      setC({
        ...c,
        soapData: ed,
        status: complete ? "completed" : "in_progress",
      });
      setEditing(false);
    } catch {}
    finally {
      setSaving(false);
    }
  };

  const sc: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700",
  };

  const sl: Record<string, string> = {
    pending: "Pendiente",
    in_progress: "En curso",
    completed: "Completada",
  };

  const ic =
    "w-full px-4 py-3 rounded-[12px] border border-slate-200 text-sm focus:ring-2 focus:ring-[#074738] outline-none";

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

  if (loading)
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#F0FAF9" }}
      >
        <div className="size-8 rounded-full border-3 border-[#074738]/20 border-t-[#074738] animate-spin" />
      </div>
    );

  if (!c)
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "#F0FAF9" }}
      >
        <div className="text-center">
          <p className="font-bold text-slate-900">No encontrada</p>
          <button
            onClick={onBack}
            className="mt-4 px-5 py-2 rounded-xl bg-[#074738] text-white font-bold text-sm"
          >
            Volver
          </button>
        </div>
      </div>
    );

  return (
    <div
      className="min-h-screen"
      style={{ background: "#F0FAF9", fontFamily: "'Manrope',sans-serif" }}
    >
      <div className="max-w-md mx-auto pb-24">
        <div className="px-5 pt-12 pb-4 flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Volver"
            className="size-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm focus-visible:ring-2 focus-visible:ring-[#074738] focus-visible:ring-offset-2"
          >
            <span
              className="material-symbols-outlined text-slate-700"
              style={{ fontSize: "20px" }}
            >
              arrow_back
            </span>
          </button>
          <div className="flex-1">
            <h1
              className="text-lg font-black text-slate-900"
              style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}
            >
              {c.petName}
            </h1>
            <p className="text-slate-500 text-xs">
              {c.species}
              {c.breed ? ` · ${c.breed}` : ""}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${sc[c.status]}`}>
            {sl[c.status]}
          </span>
        </div>

        <div className="px-5 space-y-4">
          {/* Tutor & Reason (Summary) */}
          <div className="bg-white rounded-[16px] p-4 border border-[rgba(0,0,0,0.04)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-full bg-[#E0F2F1] flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[#074738]"
                  style={{ fontSize: "20px" }}
                >
                  person
                </span>
              </div>
              <p className="font-bold text-slate-900 text-sm">{c.tutorName}</p>
            </div>
            {c.soapData?.s?.motivo && (
              <div className="bg-slate-50 rounded-[12px] p-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Motivo
                </p>
                <p className="text-sm text-slate-900">{c.soapData.s.motivo}</p>
              </div>
            )}
            {c.soapData?.s?.sintomas && (
              <div className="bg-slate-50 rounded-[12px] p-3 mt-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Síntomas
                </p>
                <p className="text-sm text-slate-900">{c.soapData.s.sintomas}</p>
              </div>
            )}
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
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "18px" }}
                >
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
                {editing ? (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                        Motivo
                      </label>
                      <input
                        type="text"
                        value={ed.s.motivo || ""}
                        onChange={(e) =>
                          setEd({
                            ...ed,
                            s: { ...ed.s, motivo: e.target.value },
                          })
                        }
                        className={ic}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                        Síntomas
                      </label>
                      <textarea
                        rows={3}
                        value={ed.s.sintomas || ""}
                        onChange={(e) =>
                          setEd({
                            ...ed,
                            s: { ...ed.s, sintomas: e.target.value },
                          })
                        }
                        className={ic}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {c.soapData?.s?.motivo && (
                      <div className="bg-slate-50 rounded-[12px] p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Motivo
                        </p>
                        <p className="text-sm">{c.soapData.s.motivo}</p>
                      </div>
                    )}
                    {c.soapData?.s?.sintomas && (
                      <div className="bg-slate-50 rounded-[12px] p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Síntomas
                        </p>
                        <p className="text-sm">{c.soapData.s.sintomas}</p>
                      </div>
                    )}
                  </>
                )}
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
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "18px" }}
                >
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
                {editing ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                          Peso (kg)
                        </label>
                        <input
                          type="text"
                          value={ed.o.peso || ""}
                          onChange={(e) =>
                            setEd({
                              ...ed,
                              o: { ...ed.o, peso: e.target.value },
                            })
                          }
                          className={ic}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                          Temp (°C)
                        </label>
                        <input
                          type="text"
                          value={ed.o.temperatura || ""}
                          onChange={(e) =>
                            setEd({
                              ...ed,
                              o: { ...ed.o, temperatura: e.target.value },
                            })
                          }
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
                          value={ed.o.frecuenciaCardiaca || ""}
                          onChange={(e) =>
                            setEd({
                              ...ed,
                              o: {
                                ...ed.o,
                                frecuenciaCardiaca: e.target.value,
                              },
                            })
                          }
                          className={ic}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                          Freq. respiratoria (rpm)
                        </label>
                        <input
                          type="text"
                          value={ed.o.frecuenciaRespiratoria || ""}
                          onChange={(e) =>
                            setEd({
                              ...ed,
                              o: {
                                ...ed.o,
                                frecuenciaRespiratoria: e.target.value,
                              },
                            })
                          }
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
                        value={ed.o.examenFisico || ""}
                        onChange={(e) =>
                          setEd({
                            ...ed,
                            o: { ...ed.o, examenFisico: e.target.value },
                          })
                        }
                        className={ic}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {(c.soapData?.o?.peso || c.soapData?.o?.temperatura) && (
                      <div className="grid grid-cols-2 gap-3">
                        {c.soapData.o.peso && (
                          <div className="bg-slate-50 rounded-[12px] p-3">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">
                              Peso
                            </p>
                            <p className="text-sm font-bold">
                              {c.soapData.o.peso} kg
                            </p>
                          </div>
                        )}
                        {c.soapData.o.temperatura && (
                          <div className="bg-slate-50 rounded-[12px] p-3">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">
                              Temp
                            </p>
                            <p className="text-sm font-bold">
                              {c.soapData.o.temperatura} °C
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {(c.soapData?.o?.frecuenciaCardiaca ||
                      c.soapData?.o?.frecuenciaRespiratoria) && (
                      <div className="grid grid-cols-2 gap-3">
                        {c.soapData.o.frecuenciaCardiaca && (
                          <div className="bg-slate-50 rounded-[12px] p-3">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">
                              FC
                            </p>
                            <p className="text-sm font-bold">
                              {c.soapData.o.frecuenciaCardiaca} bpm
                            </p>
                          </div>
                        )}
                        {c.soapData.o.frecuenciaRespiratoria && (
                          <div className="bg-slate-50 rounded-[12px] p-3">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">
                              FR
                            </p>
                            <p className="text-sm font-bold">
                              {c.soapData.o.frecuenciaRespiratoria} rpm
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {c.soapData?.o?.examenFisico && (
                      <div className="bg-slate-50 rounded-[12px] p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Examen físico
                        </p>
                        <p className="text-sm">{c.soapData.o.examenFisico}</p>
                      </div>
                    )}
                  </>
                )}
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
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "18px" }}
                >
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
                {editing ? (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                        Nota inicial
                      </label>
                      <textarea
                        rows={2}
                        value={ed.a.diagnosticoPT || ""}
                        onChange={(e) =>
                          setEd({
                            ...ed,
                            a: { ...ed.a, diagnosticoPT: e.target.value },
                          })
                        }
                        className={ic}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                        Consideraciones adicionales
                      </label>
                      <textarea
                        rows={2}
                        value={ed.a.diagnosticoDiferencial || ""}
                        onChange={(e) =>
                          setEd({
                            ...ed,
                            a: {
                              ...ed.a,
                              diagnosticoDiferencial: e.target.value,
                            },
                          })
                        }
                        className={ic}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {c.soapData?.a?.diagnosticoPT ? (
                      <div className="bg-slate-50 rounded-[12px] p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Diagnóstico
                        </p>
                        <p className="text-sm">{c.soapData.a.diagnosticoPT}</p>
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm italic">
                        Sin nota inicial
                      </p>
                    )}
                    {c.soapData?.a?.diagnosticoDiferencial && (
                      <div className="bg-slate-50 rounded-[12px] p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Diferencial
                        </p>
                        <p className="text-sm">
                          {c.soapData.a.diagnosticoDiferencial}
                        </p>
                      </div>
                    )}
                  </>
                )}
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
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "18px" }}
                >
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
                {editing ? (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                        Tratamiento
                      </label>
                      <textarea
                        rows={2}
                        value={ed.p.tratamiento || ""}
                        onChange={(e) =>
                          setEd({
                            ...ed,
                            p: { ...ed.p, tratamiento: e.target.value },
                          })
                        }
                        className={ic}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                        Medicamentos
                      </label>
                      <textarea
                        rows={2}
                        value={ed.p.medicamentos || ""}
                        onChange={(e) =>
                          setEd({
                            ...ed,
                            p: { ...ed.p, medicamentos: e.target.value },
                          })
                        }
                        className={ic}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                        Próximos pasos
                      </label>
                      <textarea
                        rows={2}
                        value={ed.p.proximosPasos || ""}
                        onChange={(e) =>
                          setEd({
                            ...ed,
                            p: { ...ed.p, proximosPasos: e.target.value },
                          })
                        }
                        className={ic}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                        Próxima consulta
                      </label>
                      <input
                        type="date"
                        value={ed.p.proxConsulta || ""}
                        onChange={(e) =>
                          setEd({
                            ...ed,
                            p: { ...ed.p, proxConsulta: e.target.value },
                          })
                        }
                        className={ic}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {c.soapData?.p?.tratamiento && (
                      <div className="bg-slate-50 rounded-[12px] p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Tratamiento
                        </p>
                        <p className="text-sm">
                          {c.soapData.p.tratamiento}
                        </p>
                      </div>
                    )}
                    {c.soapData?.p?.medicamentos && (
                      <div className="bg-slate-50 rounded-[12px] p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Medicamentos
                        </p>
                        <p className="text-sm">
                          {c.soapData.p.medicamentos}
                        </p>
                      </div>
                    )}
                    {c.soapData?.p?.proximosPasos && (
                      <div className="bg-slate-50 rounded-[12px] p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Próximos pasos
                        </p>
                        <p className="text-sm">
                          {c.soapData.p.proximosPasos}
                        </p>
                      </div>
                    )}
                    {c.soapData?.p?.proxConsulta && (
                      <div className="bg-slate-50 rounded-[12px] p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Próxima consulta
                        </p>
                        <p className="text-sm">
                          {new Date(
                            c.soapData.p.proxConsulta
                          ).toLocaleDateString("es-AR")}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Edit/Save buttons */}
          {!editing && c.status !== "completed" && (
            <button
              onClick={() => setEditing(true)}
              className="w-full py-3 rounded-[12px] bg-[#074738] text-white font-bold text-sm"
            >
              Editar consulta
            </button>
          )}

          {editing && (
            <div className="flex gap-2">
              <button
                onClick={() => save(false)}
                disabled={saving}
                className="flex-1 py-3 rounded-[12px] bg-[#074738] text-white font-bold text-sm disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => save(true)}
                disabled={saving}
                className="flex-1 py-3 rounded-[12px] bg-emerald-600 text-white font-bold text-sm disabled:opacity-60"
              >
                Completar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
