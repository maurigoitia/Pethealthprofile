import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
interface C { id:string; petName:string; species:string; breed:string; tutorName:string; reason:string; symptoms:string; diagnosis:string; treatment:string; notes:string; status:"pending"|"in_progress"|"completed"; createdAt:string; weight?:string; temperature?:string; }
interface Props { consultationId: string; onBack: () => void; }
export function VetConsultationView({ consultationId, onBack }: Props) {
  const [c, setC] = useState<C|null>(null); const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false); const [ed, setEd] = useState({ diagnosis:"", treatment:"", notes:"", weight:"", temperature:"" }); const [saving, setSaving] = useState(false);
  useEffect(() => { (async () => { try { const s = await getDoc(doc(db,"consultations",consultationId)); if(s.exists()){const d=s.data();const x:C={id:s.id,petName:d.petName||"",species:d.species||"",breed:d.breed||"",tutorName:d.tutorName||"",reason:d.reason||"",symptoms:d.symptoms||"",diagnosis:d.diagnosis||"",treatment:d.treatment||"",notes:d.notes||"",status:d.status||"pending",createdAt:d.createdAt||"",weight:d.weight||"",temperature:d.temperature||""};setC(x);setEd({diagnosis:x.diagnosis,treatment:x.treatment,notes:x.notes,weight:x.weight||"",temperature:x.temperature||""});} } catch{} finally{setLoading(false);} })(); }, [consultationId]);
  const save = async (complete=false) => { if(!c) return; setSaving(true); try { await updateDoc(doc(db,"consultations",consultationId),{...ed,status:complete?"completed":"in_progress",updatedAt:new Date().toISOString()}); setC({...c,...ed,status:complete?"completed":"in_progress"}); setEditing(false); } catch{} finally{setSaving(false);} };
  const sc:Record<string,string> = {pending:"bg-amber-100 text-amber-700",in_progress:"bg-blue-100 text-blue-700",completed:"bg-emerald-100 text-emerald-700"};
  const sl:Record<string,string> = {pending:"Pendiente",in_progress:"En curso",completed:"Completada"};
  const ic = "w-full px-4 py-3 rounded-[12px] border border-slate-200 text-sm focus:ring-2 focus:ring-[#074738] outline-none";
  if(loading) return <div className="min-h-screen flex items-center justify-center" style={{background:"#F0FAF9"}}><div className="size-8 rounded-full border-3 border-[#074738]/20 border-t-[#074738] animate-spin"/></div>;
  if(!c) return <div className="min-h-screen flex items-center justify-center px-6" style={{background:"#F0FAF9"}}><div className="text-center"><p className="font-bold text-slate-900">No encontrada</p><button onClick={onBack} className="mt-4 px-5 py-2 rounded-xl bg-[#074738] text-white font-bold text-sm">Volver</button></div></div>;
  return (
    <div className="min-h-screen" style={{background:"#F0FAF9",fontFamily:"'Manrope',sans-serif"}}><div className="max-w-md mx-auto pb-24">
      <div className="px-5 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onBack} aria-label="Volver" className="size-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm focus-visible:ring-2 focus-visible:ring-[#074738] focus-visible:ring-offset-2"><span className="material-symbols-outlined text-slate-700" style={{fontSize:"20px"}}>arrow_back</span></button>
        <div className="flex-1"><h1 className="text-lg font-black text-slate-900" style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{c.petName}</h1><p className="text-slate-500 text-xs">{c.species}{c.breed?` · ${c.breed}`:""}</p></div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${sc[c.status]}`}>{sl[c.status]}</span>
      </div>
      <div className="px-5 space-y-4">
        <div className="bg-white rounded-[16px] p-4 border border-[rgba(0,0,0,0.04)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 mb-3"><div className="size-10 rounded-full bg-[#E0F2F1] flex items-center justify-center"><span className="material-symbols-outlined text-[#074738]" style={{fontSize:"20px"}}>person</span></div><p className="font-bold text-slate-900 text-sm">{c.tutorName}</p></div>
          <div className="bg-slate-50 rounded-[12px] p-3"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Motivo</p><p className="text-sm text-slate-900">{c.reason||"No especificado"}</p></div>
          {c.symptoms && <div className="bg-slate-50 rounded-[12px] p-3 mt-2"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Síntomas</p><p className="text-sm text-slate-900">{c.symptoms}</p></div>}
        </div>
        <div className="bg-white rounded-[16px] p-4 border border-[rgba(0,0,0,0.04)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-900 text-sm">Datos clínicos</h3>{!editing && c.status!=="completed" && <button onClick={()=>setEditing(true)} className="text-[#074738] text-xs font-bold">Editar</button>}</div>
          {editing ? <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Peso (kg)</label><input value={ed.weight} onChange={e=>setEd({...ed,weight:e.target.value})} className={ic}/></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Temp (°C)</label><input value={ed.temperature} onChange={e=>setEd({...ed,temperature:e.target.value})} className={ic}/></div></div>
            <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Diagnóstico</label><textarea rows={2} value={ed.diagnosis} onChange={e=>setEd({...ed,diagnosis:e.target.value})} className={ic}/></div>
            <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Tratamiento</label><textarea rows={2} value={ed.treatment} onChange={e=>setEd({...ed,treatment:e.target.value})} className={ic}/></div>
            <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Notas</label><textarea rows={2} value={ed.notes} onChange={e=>setEd({...ed,notes:e.target.value})} className={ic}/></div>
            <div className="flex gap-2"><button onClick={()=>save(false)} disabled={saving} className="flex-1 py-3 rounded-[12px] bg-[#074738] text-white font-bold text-sm disabled:opacity-60">{saving?"Guardando...":"Guardar"}</button><button onClick={()=>save(true)} disabled={saving} className="flex-1 py-3 rounded-[12px] bg-emerald-600 text-white font-bold text-sm disabled:opacity-60">Completar</button></div>
          </div> : <div className="space-y-3">
            {(c.weight||c.temperature) && <div className="grid grid-cols-2 gap-3">{c.weight && <div className="bg-slate-50 rounded-[12px] p-3"><p className="text-[10px] font-bold text-slate-500 uppercase">Peso</p><p className="text-sm font-bold">{c.weight} kg</p></div>}{c.temperature && <div className="bg-slate-50 rounded-[12px] p-3"><p className="text-[10px] font-bold text-slate-500 uppercase">Temp</p><p className="text-sm font-bold">{c.temperature} °C</p></div>}</div>}
            {c.diagnosis ? <div className="bg-slate-50 rounded-[12px] p-3"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Diagnóstico</p><p className="text-sm">{c.diagnosis}</p></div> : <p className="text-slate-400 text-sm italic">Sin diagnóstico</p>}
            {c.treatment ? <div className="bg-slate-50 rounded-[12px] p-3"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Tratamiento</p><p className="text-sm">{c.treatment}</p></div> : <p className="text-slate-400 text-sm italic">Sin tratamiento</p>}
          </div>}
        </div>
      </div>
    </div></div>
  );
}
