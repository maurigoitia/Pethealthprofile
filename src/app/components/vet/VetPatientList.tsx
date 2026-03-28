import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

interface Patient {
  id: string;
  petName: string;
  species: string;
  breed: string;
  tutorName: string;
  tutorEmail: string;
  lastVisit: string;
  consultationCount: number;
}

interface Props {
  onSelectConsultation: (id: string) => void;
}

export function VetPatientList({ onSelectConsultation }: Props) {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    if (!user) return;
    const loadPatients = async () => {
      try {
        const consRef = collection(db, "consultations");
        const q = query(consRef, where("vetId", "==", user.uid), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        // Group by petId to build patient list
        const patientMap = new Map<string, Patient>();
        snap.forEach((d) => {
          const data = d.data();
          const petId = data.petId || d.id;
          if (!patientMap.has(petId)) {
            patientMap.set(petId, {
              id: d.id,
              petName: data.petName || "Sin nombre",
              species: data.species || "No especificado",
              breed: data.breed || "",
              tutorName: data.tutorName || "Tutor",
              tutorEmail: data.tutorEmail || "",
              lastVisit: data.createdAt || "",
              consultationCount: 1,
            });
          } else {
            const existing = patientMap.get(petId)!;
            existing.consultationCount++;
          }
        });
        setPatients(Array.from(patientMap.values()));
      } catch (err) {
        console.warn("[PessyVet] Error loading patients:", err);
      } finally { setLoading(false); }
    };
    loadPatients();
  }, [user]);
  const filtered = patients.filter((p) =>
    p.petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.tutorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen font-['Manrope',sans-serif]" style={{ background: "#F0FAF9" }}>
      <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
        {/* Header */}
        <div className="px-5 pt-12 pb-5">
          <h1 className="text-2xl font-black text-slate-900 mb-1" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            Mis pacientes
          </h1>
          <p className="text-slate-500 text-sm">{patients.length} pacientes registrados</p>
        </div>

        {/* Search */}
        <div className="px-5 mb-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: "20px" }}>search</span>
            <input type="text" placeholder="Buscar paciente o tutor..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-[14px] bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#074738] outline-none shadow-[0_2px_8px_rgba(0,0,0,0.04)]" />
          </div>
        </div>
        {/* Patient list */}
        <div className="px-5 space-y-3 flex-1">
          {loading ? (
            <div className="text-center py-12">
              <div className="mx-auto size-8 rounded-full border-3 border-[#074738]/20 border-t-[#074738] animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-[16px] p-8 text-center border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="material-symbols-outlined text-slate-300 mb-3" style={{ fontSize: "48px" }}>pets</span>
              <h3 className="font-bold text-slate-900 mb-1">{searchQuery ? "Sin resultados" : "Sin pacientes"}</h3>
              <p className="text-slate-500 text-sm">
                {searchQuery ? "Probá con otro término de búsqueda." : "Los pacientes aparecerán acá cuando registres consultas."}
              </p>
            </div>
          ) : (
            filtered.map((p) => (
              <button key={p.id} onClick={() => onSelectConsultation(p.id)}
                className="w-full bg-white rounded-[16px] p-4 text-left border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-[#E0F2F1] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[#074738]" style={{ fontSize: "24px" }}>pets</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{p.petName}</p>
                    <p className="text-slate-500 text-xs">{p.species}{p.breed ? ` · ${p.breed}` : ""}</p>
                    <p className="text-slate-400 text-xs mt-0.5">Tutor: {p.tutorName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[#074738] text-xs font-bold">{p.consultationCount} consulta{p.consultationCount !== 1 ? "s" : ""}</p>
                    <span className="material-symbols-outlined text-slate-300" style={{ fontSize: "18px" }}>chevron_right</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}