import { useState } from "react";
import { useNavigate } from "react-router";
import { auth, db } from "../../../lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { COUNTRIES } from "../../data/countries";

const VET_SPECIALTIES = [
  "Medicina general",
  "Cirugía",
  "Dermatología",
  "Cardiología",
  "Oftalmología",
  "Oncología",
  "Neurología",
  "Traumatología",
  "Odontología",
  "Nutrición",
  "Comportamiento",
  "Medicina felina",
  "Animales exóticos",
  "Otra",
];

export function VetRegisterScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  // Step 2 — professional info
  const [matricula, setMatricula] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !password) {
      setError("Completá todos los campos.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setStep(2);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!matricula.trim()) { setError("La matrícula profesional es obligatoria."); return; }
    if (!specialty) { setError("Seleccioná tu especialidad."); return; }
    setLoading(true);    const cleanEmail = email.trim().toLowerCase();
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = cred.user;
      await updateProfile(user, { displayName: name.trim() });

      // Save user doc with role=vet
      await setDoc(doc(db, "users", user.uid), {
        fullName: name.trim(),
        name: name.trim(),
        email: cleanEmail,
        country: country || null,
        role: "vet",
        createdAt: new Date().toISOString(),
      });

      // Save vet professional profile
      await setDoc(doc(db, "vetProfiles", user.uid), {
        uid: user.uid,
        fullName: name.trim(),
        email: cleanEmail,
        matricula: matricula.trim(),
        specialty,
        clinicName: clinicName.trim() || null,
        clinicAddress: clinicAddress.trim() || null,
        phone: phone.trim() || null,
        country: country || null,
        verified: false, // Admin verifies later
        createdAt: new Date().toISOString(),
        patientsCount: 0,
      });
      navigate("/vet/dashboard");
    } catch (err: any) {
      if (err?.code === "auth/email-already-in-use") setError("Ese correo ya está registrado.");
      else if (err?.code === "auth/weak-password") setError("Contraseña muy débil (mínimo 6 caracteres).");
      else if (err?.code === "auth/network-request-failed") setError("Sin conexión.");
      else setError("No se pudo crear la cuenta. Intentá nuevamente.");
    } finally { setLoading(false); }
  };

  const inputClass = "w-full px-4 py-4 rounded-[14px] border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none text-slate-900 placeholder:text-slate-400";

  return (
    <div className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundImage: "linear-gradient(135deg, #074738 0%, #0a6b54 50%, #1A9B7D 100%)" }}>
      <div className="w-full max-w-md bg-white rounded-[24px] shadow-2xl px-6 pt-8 pb-8">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#074738]" style={{ fontSize: "28px" }}>stethoscope</span>
            <h1 className="text-2xl font-black text-[#074738]" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Pessy Vet</h1>
          </div>
          <p className="text-slate-500 text-sm">Registro profesional veterinario</p>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className={`h-1.5 w-12 rounded-full transition-colors ${step >= 1 ? "bg-[#074738]" : "bg-slate-200"}`} />
            <div className={`h-1.5 w-12 rounded-full transition-colors ${step >= 2 ? "bg-[#074738]" : "bg-slate-200"}`} />
          </div>
        </div>
        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-4">
            <input type="text" placeholder="Nombre completo" value={name}
              onChange={(e) => setName(e.target.value)} className={inputClass} required />
            <input type="email" placeholder="Correo electrónico profesional" value={email}
              onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
            <input type="password" placeholder="Contraseña" value={password}
              onChange={(e) => setPassword(e.target.value)} className={inputClass} required />
            <div className="relative">
              <select value={country} onChange={(e) => setCountry(e.target.value)}
                className={`${inputClass} appearance-none bg-white cursor-pointer`}>
                <option value="">🌍 País</option>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">▾</div>
            </div>
            {error && <p className="text-red-500 text-sm font-semibold text-center">{error}</p>}
            <button type="submit" className="w-full py-4 rounded-[14px] bg-[#074738] text-white font-bold">
              Siguiente
            </button>
            <button type="button" onClick={() => navigate("/vet/login")}
              className="w-full py-4 rounded-[14px] border-2 border-[#074738] text-[#074738] font-bold hover:bg-[#074738]/5 transition-all">
              Ya tengo cuenta
            </button>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">Matrícula profesional *</label>
              <input type="text" placeholder="Ej: MP 12345" value={matricula}
                onChange={(e) => setMatricula(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">Especialidad *</label>
              <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}
                className={`${inputClass} appearance-none bg-white cursor-pointer`}>
                <option value="">Seleccioná tu especialidad</option>
                {VET_SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <input type="text" placeholder="Nombre de clínica (opcional)" value={clinicName}
              onChange={(e) => setClinicName(e.target.value)} className={inputClass} />
            <input type="text" placeholder="Dirección de clínica (opcional)" value={clinicAddress}
              onChange={(e) => setClinicAddress(e.target.value)} className={inputClass} />
            <input type="tel" placeholder="Teléfono profesional (opcional)" value={phone}
              onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            {error && <p className="text-red-500 text-sm font-semibold text-center">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-4 rounded-[14px] bg-[#074738] text-white font-bold disabled:opacity-60">
              {loading ? "Creando cuenta..." : "Crear cuenta profesional"}
            </button>
            <button type="button" onClick={() => { setStep(1); setError(""); }}
              className="w-full py-3 rounded-[14px] text-[#074738] font-bold hover:bg-slate-50 transition-all">
              ← Volver
            </button>
          </form>
        )}
      </div>
    </div>
  );
}