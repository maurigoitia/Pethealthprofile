import React from "react";
import { useLocation, useNavigate } from "react-router";
import { MaterialIcon } from "./MaterialIcon";
import { isFocusExperienceHost } from "../../utils/runtimeFlags";

interface BottomNavRoutedProps {
  onAddDocument?: () => void;
}

type TabId = "dia_a_dia" | "rutinas" | "comunidad" | "identidad";

const TAB_ROUTES: Record<TabId, string> = {
  dia_a_dia: "/inicio",
  rutinas: "/rutinas",
  comunidad: "/comunidad",
  identidad: "/identidad",
};

function resolveActiveTab(pathname: string): TabId {
  if (pathname === "/inicio" || pathname === "/home") return "dia_a_dia";
  if (pathname.startsWith("/comunidad")) return "comunidad";
  if (pathname.startsWith("/identidad")) return "identidad";
  if (
    pathname.startsWith("/rutinas") ||
    pathname.startsWith("/cuidados") ||
    pathname.startsWith("/turnos") ||
    pathname.startsWith("/tratamientos") ||
    pathname.startsWith("/historial") ||
    pathname.startsWith("/rutinas-eco")
  )
    return "rutinas";
  return "dia_a_dia";
}

export function BottomNavRouted({ onAddDocument }: BottomNavRoutedProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = resolveActiveTab(location.pathname);
  const focusExperienceEnabled = isFocusExperienceHost();

  const handleNav = (tab: TabId) => {
    if (tab === activeTab) return;
    navigate(TAB_ROUTES[tab]);
  };

  // ── Focus experience variant (floating pill) ──
  if (focusExperienceEnabled) {
    return (
      <nav className="fixed inset-x-0 bottom-4 z-40 pessy-fade-up" style={{ animationDelay: "200ms" }}>
        <div className="max-w-md mx-auto px-4">
          <div className="rounded-full bg-[#074738] px-5 py-3 shadow-[0_8px_32px_rgba(7,71,56,0.25)]">
            <div className="grid grid-cols-4 items-center">
              <TabButton active={activeTab === "dia_a_dia"} label="Día a Día" onClick={() => handleNav("dia_a_dia")}>
                <MaterialIcon name="home" className="text-[22px]" />
              </TabButton>

              <TabButton active={activeTab === "rutinas"} label="Rutinas" onClick={() => handleNav("rutinas")}>
                <MaterialIcon name="favorite" className="text-[22px]" />
              </TabButton>

              <TabButton active={activeTab === "comunidad"} label="Comunidad" onClick={() => handleNav("comunidad")}>
                <MaterialIcon name="groups" className="text-[22px]" />
              </TabButton>

              <TabButton active={activeTab === "identidad"} label="Identidad" onClick={() => handleNav("identidad")}>
                <MaterialIcon name="shield" className="text-[22px]" />
              </TabButton>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // ── Standard bottom nav (4 Pillars) ──
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pessy-fade-up" style={{ animationDelay: "200ms" }}>
      <div className="max-w-md mx-auto px-3 pb-[env(safe-area-inset-bottom,8px)]">
        <div className="pessy-glass rounded-2xl border border-white/40 shadow-[0_-2px_20px_rgba(7,71,56,0.08)] px-2 py-2">
          <div className="flex items-center justify-around">
            <StandardTab active={activeTab === "dia_a_dia"} label="Día a Día" onClick={() => handleNav("dia_a_dia")}>
              <MaterialIcon name="home" />
            </StandardTab>

            <StandardTab active={activeTab === "rutinas"} label="Rutinas" onClick={() => handleNav("rutinas")}>
              <MaterialIcon name="favorite" />
            </StandardTab>

            <StandardTab active={activeTab === "comunidad"} label="Comunidad" onClick={() => handleNav("comunidad")}>
              <MaterialIcon name="groups" />
            </StandardTab>

            <StandardTab active={activeTab === "identidad"} label="Identidad" onClick={() => handleNav("identidad")}>
              <MaterialIcon name="shield" />
            </StandardTab>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ── Focus tab button (floating pill variant) ──
function TabButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="flex items-center justify-center" aria-label={label} aria-current={active ? "page" : undefined}>
      <div className={`size-11 rounded-full flex items-center justify-center transition-all duration-150 ${active ? "bg-white/18 text-white" : "text-white/70"}`}>
        {children}
      </div>
    </button>
  );
}

// ── Standard tab button ──
function StandardTab({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const strokeWidth = active ? 2 : 1.5;
  const icon = React.cloneElement(children as React.ReactElement, { strokeWidth });

  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150"
      aria-label={label}
    >
      <div
        className={`size-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
          active ? "bg-[#074738] text-white shadow-[0_2px_8px_rgba(7,71,56,0.25)]" : "text-[#9CA3AF]"
        }`}
      >
        {icon}
      </div>
      <span className={`text-[10px] font-bold tracking-wider ${active ? "text-[#074738]" : "text-[#9CA3AF]"}`}>
        {label}
      </span>
    </button>
  );
}
