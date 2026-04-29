import { useState } from "react";
import { useNavigate } from "react-router";
import { auth, db } from "../../../lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { COUNTRIES } from "../../data/countries";

const SPECIALTIES = ["Medicina general","Cirugía","Dermatología","Cardiología","Oftalmología","Oncología","Neurología","Traumatología","Odontología","Nutrición","Comportamiento","Medicina felina","Animales exóticos","Otra"];

export function VetRegisterScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1|2>(1);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [country, setCountry] = useState("");
  const [matricula, setMatricula] = useState(""); const [specialty, setSpecialty] = useState(""); const [clinicName, setClinicName] = useState(""); const [phone, setPhone] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);

  const handleStep1 = (e: React.FormEvent) => { e.preventDefault(); setError(""); if (password.length < 6) { setError("Mínimo 6 caracteres."); return; } setStep(2); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!matricula.trim()) { setError("La matrícula es obligatoria."); return; }
    if (!specialty) { setError("Seleccioná tu especialidad."); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      await updateProfile(cred.user, { displayName: name.trim() });
      await setDoc(doc(db, "users", cred.user.uid), { fullName: name.trim(), name: name.trim(), email: email.trim().toLowerCase(), country: country || null, role: "vet", createdAt: new Date().toISOString() });
      await setDoc(doc(db, "vetProfiles", cred.user.uid), { uid: cred.user.uid, fullName: name.trim(), email: email.trim().toLowerCase(), matricula: matricula.trim(), specialty, clinicName: clinicName.trim() || null, phone: phone.trim() || null, country: country || null, verified: false, createdAt: new Date().toISOString(), patientsCount: 0 });
      navigate("/vet/dashboard");
    } catch (err: any) {
      if (err?.code === "auth/email-already-in-use") setError("Ese correo ya está registrado.");
      else if (err?.code === "auth/weak-password") setError("Contraseña muy débil.");
      else setError("No se pudo crear la cuenta.");
    } finally { setLoading(false); }
  };

  const ic = "w-full px-4 py-3.5 rounded-[12px] border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none text-sm text-slate-900 placeholder:text-slate-400";

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "linear-gradient(135deg, #074738 0%, #0a6b54 50%, #1A9B7D 100%)" }}>
      <div className="w-full max-w-md bg-white rounded-[24px] shadow-2xl px-6 py-8">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#074738]" aria-hidden="true" style={{ fontSize: "24px" }}>stethoscope</span>
            <h1 className="text-xl font-black text-[#074738]" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Pessy Vet</h1>
          </div>
          <p className="text-slate-500 text-xs">Registro profesional veterinario</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className={`h-1.5 w-12 rounded-full ${step >= 1 ? "bg-[#074738]" : "bg-slate-200"}`} />
            <div className={`h-1.5 w-12 rounded-full ${step >= 2 ? "bg-[#074738]" : "bg-slate-200"}`} />
          </div>
        </div>
        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-3">
            <input type="text" placeholder="Nombre completo" value={name} onChange={e => setName(e.target.value)} className={ic} required />
            <input type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} className={ic} required />
            <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} className={ic} required />
            <select value={country} onChange={e => setCountry(e.target.value)} className={`${ic} appearance-none bg-white`}><option value="">🌍 País</option>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}</select>
            {error && <p className="text-red-500 text-xs font-semibold text-center">{error}</p>}
            <button type="submit" className="w-full py-3.5 rounded-[14px] bg-[#074738] text-white font-bold text-sm">Siguiente</button>
            <button type="button" onClick={() => navigate("/vet/login")} className="w-full py-3 rounded-[14px] border-2 border-[#074738] text-[#074738] font-bold text-sm">Ya tengo cuenta</button>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={handleCreate} className="space-y-3">
            <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Matrícula profesional *</label><input type="text" placeholder="Ej: MP 12345" value={matricula} onChange={e => setMatricula(e.target.value)} className={ic} required /></div>
            <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Especialidad *</label><select value={specialty} onChange={e => setSpecialty(e.target.value)} className={`${ic} appearance-none bg-white`}><option value="">Seleccioná</option>{SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <input type="text" placeholder="Clínica (opcional)" value={clinicName} onChange={e => setClinicName(e.target.value)} className={ic} />
            <input type="tel" placeholder="Teléfono (opcional)" value={phone} onChange={e => setPhone(e.target.value)} className={ic} />
            {error && <p className="text-red-500 text-xs font-semibold text-center">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-[14px] bg-[#074738] text-white font-bold text-sm disabled:opacity-60">{loading ? "Creando..." : "Crear cuenta profesional"}</button>
            <button type="button" onClick={() => { setStep(1); setError(""); }} className="w-full py-2 text-[#074738] font-bold text-sm">← Volver</button>
          </form>
        )}
      </div>
    </div>
  );
}
