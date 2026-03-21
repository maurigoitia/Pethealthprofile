import React from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  ChevronRight,
  Pill,
  Smartphone,
  Zap,
  Bell
} from "lucide-react";

const BRAND_GREEN = "#074738";

export const HistoryMockup = () => (
  <div className="w-full h-full bg-slate-50 p-4 font-['Manrope'] overflow-hidden select-none">
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">IDENTIDAD DIGITAL</h4>
        <div className="size-6 rounded-full bg-white border border-slate-200 flex items-center justify-center">
          <FileText size={12} className="text-slate-400" />
        </div>
      </div>

      {[
        { title: "Documento guardado", date: "12 FEB", type: "Perfil", status: "Listo" },
        { title: "Rutina organizada", date: "05 FEB", type: "Rutinas", status: "Listo" },
        { title: "Compra por reponer", date: "28 ENE", type: "Compras", status: "Pendiente" }
      ].map((item, i) => (
        <motion.div 
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className={`size-9 rounded-xl flex items-center justify-center ${item.status === 'Pendiente' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-[#074738]'}`}>
              {item.status === 'Pendiente' ? <Clock size={16} /> : <CheckCircle2 size={16} />}
            </div>
            <div>
              <p className="text-[11px] font-black text-slate-900 leading-tight">{item.title}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.type} · {item.date}</p>
            </div>
          </div>
          <ChevronRight size={14} className="text-slate-300" />
        </motion.div>
      ))}

      <div className="mt-4 p-3 bg-[#074738] rounded-2xl text-white space-y-1 shadow-lg shadow-[#074738]/10">
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-emerald-400" />
          <p className="text-[9px] font-black uppercase tracking-widest">PESSY TE ACOMPANA</p>
        </div>
        <p className="text-[10px] font-bold leading-tight opacity-90">Su historia ya quedo ordenada dentro de su identidad digital.</p>
      </div>
    </div>
  </div>
);

export const MedicationMockup = () => (
  <div className="w-full h-full bg-slate-50 p-4 font-['Manrope'] overflow-hidden select-none">
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">RUTINAS ACTIVAS</h4>
        <Bell size={12} className="text-[#074738]" />
      </div>

      <div className="bg-white rounded-[2rem] p-4 border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <Pill className="text-[#074738]" size={24} />
          </div>
          <div>
            <h5 className="text-sm font-black text-slate-900 leading-tight">Paseo de la tarde</h5>
            <p className="text-[10px] font-black text-[#074738] uppercase tracking-wider">TODOS LOS DIAS</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">PROXIMO MOMENTO</p>
            <p className="text-xs font-black text-slate-900">20:00 HS</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">ESTADO</p>
            <p className="text-xs font-black text-slate-900">EN ORDEN</p>
          </div>
        </div>

        <button className="w-full py-2.5 bg-[#074738] text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform">
          MARCAR RUTINA
        </button>
      </div>

      <div className="bg-amber-50 rounded-2xl p-3 border border-amber-100 flex gap-3">
        <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[9px] font-bold text-amber-800 leading-tight">En 2 dias te recordamos reponer lo que usa todos los dias.</p>
      </div>
    </div>
  </div>
);

export const VaccinesMockup = () => (
  <div className="w-full h-full bg-slate-50 p-4 font-['Manrope'] overflow-hidden select-none">
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">CUIDADOS AL DIA</h4>
        <ShieldCheck size={14} className="text-emerald-500" />
      </div>

      <div className="space-y-2">
        {[
          { name: "Antirrabica", date: "15 MAR 2026", status: "Al dia", color: "emerald" },
          { name: "Quintuple", date: "02 ABR 2026", status: "Proximo", color: "amber" },
          { name: "Higiene dental", date: "20 MAY 2026", status: "Pendiente", color: "slate" }
        ].map((vac, i) => (
          <div key={i} className="bg-white rounded-2xl p-3 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`size-2 rounded-full ${vac.color === 'emerald' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : vac.color === 'amber' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-slate-300'}`} />
              <div>
                <p className="text-[11px] font-black text-slate-900">{vac.name}</p>
                <p className="text-[9px] font-bold text-slate-400">Vence: {vac.date}</p>
              </div>
            </div>
            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${vac.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : vac.color === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
              {vac.status}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 p-4 bg-white rounded-[2rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center gap-2">
        <div className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
          <Smartphone size={20} />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">Toca para generar<br/>codigo QR del carnet</p>
      </div>
    </div>
  </div>
);
