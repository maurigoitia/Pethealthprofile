import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { VetBottomNav } from "./VetBottomNav";
import { VetPatientList } from "./VetPatientList";
import { VetConsultationView } from "./VetConsultationView";
import { VetProfileScreen } from "./VetProfileScreen";
interface VP { fullName:string; specialty:string; matricula:string; verified:boolean; patientsCount:number; }
interface CS { id:string; petName:string; tutorName:string; reason:string; status:"pending"|"in_progress"|"completed"; createdAt:string; }
export default function VetDashboard() {
  const navigate = useNavigate(); const { user, loading: authLoading, userName } = useAuth();
  const [tab, setTab] = useState<"home"|"patients"|"profile">("home");
  const [vp, setVp] = useState<VP|null>(null); const [cons, setCons] = useState<CS[]>([]); const [stats, setStats] = useState({today:0,pending:0,patients:0});
  const [loadingData, setLoadingData] = useState(true); const [selCon, setSelCon] = useState<string|null>(null);
  useEffect(() => { if(!user) return; (async()=>{ try {
    const ps = await getDoc(doc(db,"vetProfiles",user.uid)); if(ps.exists()) setVp(ps.data() as VP);
    const snap = await getDocs(query(collection(db,"consultations"),where("vetId","==",user.uid),orderBy("createdAt","desc"),limit(10)));
    const list:CS[]=[]; snap.forEach(d=>{const x=d.data();list.push({id:d.id,petName:x.petName||"",tutorName:x.tutorName||"",reason:x.reason||"Consulta",status:x.status||"pending",createdAt:x.createdAt||""});});
    setCons(list); const td=new Date().toISOString().split("T")[0]; setStats({today:list.filter(c=>c.createdAt.startsWith(td)).length,pending:list.filter(c=>c.status==="pending").length,patients:ps.exists()?(ps.data().patientsCount||0):0});
  } catch{} finally{setLoadingData(false);} })(); },[user]);
  if(authLoading) return <div className="min-h-screen flex items-center justify-center" style={{background:"#F0FAF9"}}><div className="size-10 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin"/></div>;
  if(!user) return <Navigate to="/vet/login" replace/>;
  if(selCon) return <><VetConsultationView consultationId={selCon} onBack={()=>setSelCon(null)}/><VetBottomNav currentTab={tab} onTabChange={setTab}/></>;
  if(tab==="patients") return <><VetPatientList onSelectConsultation={setSelCon}/><VetBottomNav currentTab={tab} onTabChange={setTab}/></>;
  if(tab==="profile") return <><VetProfileScreen onBack={()=>setTab("home")}/><VetBottomNav currentTab={tab} onTabChange={setTab}/></>;
  const name = userName||vp?.fullName?.split(" ")[0]||"Doctor";
  const sc:Record<string,string>={pending:"bg-amber-100 text-amber-700",in_progress:"bg-blue-100 text-blue-700",completed:"bg-emerald-100 text-emerald-700"};
  const sl:Record<string,string>={pending:"Pendiente",in_progress:"En curso",completed:"Completada"};
  return (
    <div className="min-h-screen" style={{background:"#F0FAF9",fontFamily:"'Manrope',sans-serif"}}><div className="max-w-md mx-auto pb-24">
      <div className="px-5 pt-12 pb-6 rounded-b-[28px] relative overflow-hidden" style={{background:"linear-gradient(135deg,#074738 0%,#0a6b54 100%)"}}>
        <div className="absolute -right-16 -top-16 w-[200px] h-[200px] rounded-[42%_58%_65%_35%/52%_45%_55%_48%] bg-white/5 blur-xl pointer-events-none" />
        <div className="absolute -left-12 bottom-0 w-[160px] h-[160px] rounded-[58%_42%_35%_65%/45%_52%_48%_55%] bg-white/5 blur-xl pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between mb-5"><div><p className="text-white/70 text-sm">Bienvenido</p><h1 className="text-2xl font-black text-white" style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Dr. {name}</h1></div>
          <div className="flex items-center gap-2">{vp?.verified && <span className="px-2 py-1 rounded-full bg-emerald-400/20 text-emerald-300 text-xs font-bold flex items-center gap-1"><span className="material-symbols-outlined" aria-hidden="true" style={{fontSize:"14px"}}>verified</span>Verificado</span>}<div className="size-11 rounded-full bg-white/15 flex items-center justify-center"><span className="material-symbols-outlined text-white" aria-hidden="true" style={{fontSize:"22px"}}>stethoscope</span></div></div>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-[16px] p-3 text-center border border-white/5"><p className="text-2xl font-black text-white">{stats.today}</p><p className="text-white/60 text-xs font-semibold">Hoy</p></div>
          <div className="bg-white/10 backdrop-blur-sm rounded-[16px] p-3 text-center border border-white/5"><p className="text-2xl font-black text-[#1A9B7D]">{stats.pending}</p><p className="text-white/60 text-xs font-semibold">Pendientes</p></div>
          <div className="bg-white/10 backdrop-blur-sm rounded-[16px] p-3 text-center border border-white/5"><p className="text-2xl font-black text-white">{stats.patients}</p><p className="text-white/60 text-xs font-semibold">Pacientes</p></div>
        </div>
      </div>
      <div className="px-5 mt-5"><div className="grid grid-cols-2 gap-3">
        <button onClick={()=>setTab("patients")} className="bg-white rounded-[16px] p-5 text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[rgba(0,0,0,0.04)] active:translate-y-[-1px] transition-all duration-150 min-h-[140px] flex flex-col justify-center items-center gap-3"><div className="size-12 rounded-2xl bg-[#E0F2F1] flex items-center justify-center"><span className="material-symbols-outlined text-[#074738]" aria-hidden="true" style={{fontSize:"24px"}}>pets</span></div><div className="text-center"><p className="font-bold text-slate-900 text-sm">Mis pacientes</p><p className="text-slate-500 text-xs mt-0.5">Ver historial</p></div></button>
        <button onClick={()=>navigate("/vet/new-consultation")} className="bg-[#074738] rounded-[16px] p-5 text-left shadow-[0_4px_12px_rgba(7,71,56,0.3)] active:scale-[0.97] transition-all duration-150 min-h-[140px] flex flex-col justify-center items-center gap-3"><div className="size-12 rounded-2xl bg-white/10 flex items-center justify-center"><span className="material-symbols-outlined text-[#1A9B7D]" aria-hidden="true" style={{fontSize:"24px"}}>add_circle</span></div><div className="text-center"><p className="font-bold text-white text-sm">Nueva consulta</p><p className="text-white/60 text-xs mt-0.5">Registrar atención</p></div></button>
      </div></div>
      <div className="px-5 mt-6"><div className="flex items-center justify-between mb-3"><h2 className="text-lg font-black text-slate-900" style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Consultas recientes</h2><button onClick={()=>setTab("patients")} className="text-[#074738] text-sm font-bold">Ver todas</button></div>
        {loadingData ? <div className="bg-white rounded-[16px] p-6 text-center border border-slate-100"><div className="mx-auto size-8 rounded-full border-3 border-[#074738]/20 border-t-[#074738] animate-spin"/></div>
        : cons.length===0 ? <div className="bg-white rounded-[16px] p-8 text-center border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"><span className="material-symbols-outlined text-slate-300 mb-3" aria-hidden="true" style={{fontSize:"48px"}}>clinical_notes</span><h3 className="font-bold text-slate-900 mb-1">Sin consultas aún</h3><p className="text-slate-500 text-sm mb-4">Comenzá registrando tu primera consulta.</p><button onClick={()=>navigate("/vet/new-consultation")} className="px-5 py-2.5 rounded-[12px] bg-[#074738] text-white font-bold text-sm">Crear consulta</button></div>
        : <div className="space-y-3">{cons.map(c=>(
          <button key={c.id} onClick={()=>setSelCon(c.id)} className="w-full bg-white rounded-[16px] p-4 text-left border border-[rgba(0,0,0,0.04)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:translate-y-[-1px] transition-all duration-150">
            <div className="flex items-start justify-between"><div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="material-symbols-outlined text-[#074738]" aria-hidden="true" style={{fontSize:"18px"}}>pets</span><p className="font-bold text-slate-900 text-sm">{c.petName}</p></div><p className="text-slate-500 text-xs">Tutor: {c.tutorName}</p><p className="text-slate-600 text-xs mt-1">{c.reason}</p></div><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${sc[c.status]}`}>{sl[c.status]}</span></div>
          </button>
        ))}</div>}
      </div>
    </div><VetBottomNav currentTab={tab} onTabChange={setTab}/></div>
  );
}
