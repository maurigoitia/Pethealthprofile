import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
interface VP { fullName:string; email:string; specialty:string; matricula:string; clinicName?:string; phone?:string; verified:boolean; }
interface Props { onBack: () => void; }
export function VetProfileScreen({ onBack }: Props) {
  const navigate = useNavigate(); const { user, logout, userPhoto } = useAuth();
  const [profile, setProfile] = useState<VP|null>(null);
  useEffect(() => { if(!user) return; getDoc(doc(db,"vetProfiles",user.uid)).then(s => { if(s.exists()) setProfile(s.data() as VP); }).catch(()=>{}); }, [user]);
  const handleLogout = async () => { await logout(); navigate("/vet/login"); };
  const Row = ({l,v}:{l:string;v?:string}) => v ? <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"><span className="text-sm text-slate-500">{l}</span><span className="text-sm font-bold text-slate-900 text-right max-w-[60%] truncate">{v}</span></div> : null;
  return (
    <div className="min-h-screen" style={{background:"#F0FAF9",fontFamily:"'Manrope',sans-serif"}}><div className="max-w-md mx-auto pb-24">
      <div className="px-5 pt-12 pb-4"><h1 className="text-2xl font-black text-slate-900" style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Mi perfil</h1></div>
      <div className="px-5 space-y-4">
        <div className="bg-white rounded-[16px] p-5 text-center border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="size-20 mx-auto rounded-full bg-[#E0F2F1] flex items-center justify-center mb-3 overflow-hidden">{userPhoto?<img src={userPhoto} alt="" className="w-full h-full object-cover"/>:<span className="material-symbols-outlined text-[#074738]" style={{fontSize:"36px"}}>stethoscope</span>}</div>
          <h2 className="text-lg font-black text-slate-900">{profile?.fullName||user?.displayName||"Doctor"}</h2>
          <p className="text-sm text-slate-500">{profile?.specialty||"Veterinario"}</p>
          {profile?.verified && <span className="inline-flex items-center gap-1 px-3 py-1 mt-2 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold"><span className="material-symbols-outlined" style={{fontSize:"14px"}}>verified</span> Verificado</span>}
        </div>
        <div className="bg-white rounded-[16px] p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"><h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Info profesional</h3><Row l="Matrícula" v={profile?.matricula}/><Row l="Especialidad" v={profile?.specialty}/><Row l="Email" v={profile?.email||user?.email||""}/><Row l="Teléfono" v={profile?.phone}/></div>
        {profile?.clinicName && <div className="bg-white rounded-[16px] p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"><h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Clínica</h3><Row l="Nombre" v={profile.clinicName}/></div>}
        <button onClick={()=>navigate("/login")} className="w-full bg-white rounded-[16px] p-4 text-left border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center gap-3"><span className="material-symbols-outlined text-[#074738]" style={{fontSize:"24px"}}>pets</span><div><p className="font-bold text-slate-900 text-sm">¿Tenés mascota?</p><p className="text-slate-500 text-xs">Ingresá a Pessy como tutor</p></div></button>
        <button onClick={handleLogout} className="w-full py-4 rounded-[14px] bg-red-50 text-red-600 font-bold text-sm border border-red-100">Cerrar sesión</button>
      </div>
    </div></div>
  );
}
