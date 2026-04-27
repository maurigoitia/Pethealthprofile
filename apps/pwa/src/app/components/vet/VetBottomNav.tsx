interface Props { currentTab: "home" | "patients" | "profile"; onTabChange: (tab: "home" | "patients" | "profile") => void; }
export function VetBottomNav({ currentTab, onTabChange }: Props) {
  const tabs = [{ id: "home" as const, icon: "dashboard", label: "Inicio" },{ id: "patients" as const, icon: "pets", label: "Pacientes" },{ id: "profile" as const, icon: "person", label: "Perfil" }];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40"><div className="max-w-md mx-auto bg-white border-t border-slate-200 px-6 pb-[env(safe-area-inset-bottom,8px)]"><div className="flex items-center justify-around py-2">
      {tabs.map(tab => { const a = currentTab === tab.id; return (
        <button key={tab.id} onClick={() => onTabChange(tab.id)} aria-label={tab.label} aria-current={a ? "page" : undefined} className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors ${a ? "text-[#074738]" : "text-slate-400"}`}>
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: "24px", fontVariationSettings: a ? "'FILL' 1" : "'FILL' 0" }}>{tab.icon}</span>
          <span className={`text-[10px] font-bold ${a ? "text-[#074738]" : "text-slate-400"}`}>{tab.label}</span>
        </button>
      ); })}
    </div></div></nav>
  );
}
