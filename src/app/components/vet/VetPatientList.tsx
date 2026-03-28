import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
interface Patient { id: string; petName: string; species: string; breed: string; tutorName: string; lastVisit: string; count: number; }
interface Props { onSelectConsultation: (id: string) => void; }
export function VetPatientList({ onSelectConsultation }: Props) {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]); const [loading, setLoading] = useState(true); const [search, setSearch] = useState("");
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "consultations"), where("vetId", "==", user.uid), orderBy("createdAt", "desc")));
        const map = new Map<string, Patient>();
        snap.forEach(d => { const data = d.data(); const pid = data.petId || d.id;
          if (!map.has(pid)) map.set(pid, { id: d.id, petName: data.petName || "Sin nombre", species: data.species || "", breed: data.breed || "", tutorName: data.tutorName || "Tutor", lastVisit: data.createdAt || "", count: 1 });
          else map.get(pid)!.count++;
        });
        setPatients(Array.from(map.values()));
      } catch {} finally { setLoading(false); }
    })();
  }, [user]);
  const filtered = patients.filter(p => p.petName.toLowerCase().includes(search.toLowerCase()) || p.tutorName.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="min-h-screen" style={{ background: "#F0FAF9", fontFamily: "'Manrope',sans-serif" }}>
      <div className="max-w-md mx-auto pb-24">
        <div className="px-5 pt-12 pb-4"><h1 className="text-2xl font-black text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Mis pacientes</h1><p className="text-slate-500 text-sm">{patients.length} pacientes</p></div>
        <div className="px-5 mb-4"><div className="relative"><span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: "20px" }}>search</span><input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 rounded-[12px] bg-white border border-slate-200 text-sm focus:ring-2 focus:ring-[#074738] outline-none shadow-[0_2px_8px_rgba(0,0,0,0.04)]" /></div></div>
        <div className="px-5 space-y-3">
          {loading ? <div className="text-center py-12"><div className="mx-auto size-8 rounded-full border-3 border-[#074738]/20 border-t-[#074738] animate-spin" /></div>
          : filtered.length === 0 ? <div className="bg-white rounded-[16px] p-8 text-center border border-slate-100"><span className="material-symbols-outlined text-slate-300 mb-3" style={{ fontSize: "48px" }}>pets</span><h3 className="font-bold text-slate-900 mb-1">{search ? "Sin resultados" : "Sin pacientes"}</h3><p className="text-slate-500 text-sm">{search ? "Probá otro término." : "Aparecerán cuando registres consultas."}</p></div>
          : filtered.map(p => (
            <button key={p.id} onClick={() => onSelectConsultation(p.id)} className="w-full bg-white rounded-[16px] p-4 text-left border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-[#E0F2F1] flex items-center justify-center"><span className="material-symbols-outlined text-[#074738]" style={{ fontSize: "24px" }}>pets</span></div>
                <div className="flex-1 min-w-0"><p className="font-bold text-slate-900 text-sm truncate">{p.petName}</p><p className="text-slate-500 text-xs">{p.species}{p.breed ? ` · ${p.breed}` : ""}</p><p className="text-slate-400 text-xs">Tutor: {p.tutorName}</p></div>
                <div className="text-right"><p className="text-[#074738] text-xs font-bold">{p.count} consulta{p.count !== 1 ? "s" : ""}</p></div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
