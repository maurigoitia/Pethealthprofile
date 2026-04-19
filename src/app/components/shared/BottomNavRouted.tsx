/**
 * BottomNavRouted — route-based bottom navigation.
 *
 * Replaces the callback-based BottomNav with one that navigates
 * to real routes using react-router. Active tab is derived from
 * the current URL path — no more viewMode state.
 */
import React from "react";
import { useLocation, useNavigate } from "react-router";
import { Home, Shield, Plus, Heart, Compass } from "lucide-react";
import { isFocusExperienceHost } from "../../utils/runtimeFlags";

interface BottomNavRoutedProps {
  onAddDocument?: () => void;
}

type TabId = "inicio" | "identidad" | "cuidados" | "servicios";

const TAB_ROUTES: Record<TabId, string> = {
  inicio: "/inicio",
  identidad: "/identidad",
  cuidados: "/cuidados",
  servicios: "/buscar-vet",
};

function resolveActiveTab(pathname: string): TabId {
  if (pathname === "/inicio" || pathname === "/home") return "inicio";
  if (pathname.startsWith("/identidad")) return "identidad";
  if (
    pathname.startsWith("/cuidados") ||
    pathname.startsWith("/turnos") ||
    pathname.startsWith("/tratamientos") ||
    pathname.startsWith("/historial") ||
    pathname.startsWith("/rutinas-eco")
  )
    return "cuidados";
  if (
    pathname.startsWith("/buscar-vet") ||
    pathname.startsWith("/vet/") ||
    pathname.startsWith("/comunidad")
  )
    return "servicios";
  return "inicio";
}

export function BottomNavRouted({ onAddDocument }: BottomNavRoutedProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = resolveActiveTab(location.pathname);
  const focusExperienceEnabled = isFocusExperienceHost();

  const iconSize = focusExperienceEnabled ? 22 : 20;
  const strokeWidth = 1.8;

  const handleNav = (tab: TabId) => {
    if (tab === activeTab) return; // already on this tab
    navigate(TAB_ROUTES[tab]);
  };

  // ── Focus experience variant (floating pill) ──
  if (focusExperienceEnabled) {
    return (
      <nav className="fixed inset-x-0 bottom-4 z-40 pessy-fade-up" style={{ animationDelay: "200ms" }}>
        <div className="max-w-md mx-auto px-4">
          <div className="rounded-full bg-[#074738] px-5 py-3 shadow-[0_8px_32px_rgba(7,71,56,0.25)]">
            <div className="grid grid-cols-5 items-center">
              <TabButton active={activeTab === "inicio"} label="Inicio" onClick={() => handleNav("inicio")}>
                <Home size={iconSize} strokeWidth={strokeWidth} />
              </TabButton>

              <TabButton active={activeTab === "identidad"} label="Identidad" onClick={() => handleNav("identidad")}>
                <Shield size={iconSize} strokeWidth={strokeWidth} />
              </TabButton>

              {onAddDocument ? (
                <button onClick={onAddDocument} className="flex items-center justify-center" aria-label="Agregar documento">
                  <div className="size-12 rounded-[14px] bg-white text-[#074738] flex items-center justify-center shadow-[0_4px_16px_rgba(26,155,125,0.3)] hover:shadow-[0_4px_24px_rgba(26,155,125,0.45)] transition-shadow duration-150">
                    <Plus size={24} strokeWidth={2.2} />
                  </div>
                </button>
              ) : (
                <div />
              )}

              <TabButton active={activeTab === "cuidados"} label="Cuidados" onClick={() => handleNav("cuidados")}>
                <Heart size={iconSize} strokeWidth={strokeWidth} />
              </TabButton>

              <TabButton active={activeTab === "servicios"} label="Servicios" onClick={() => handleNav("servicios")}>
                <Compass size={iconSize} strokeWidth={strokeWidth} />
              </TabButton>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // ── Standard bottom nav ──
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pessy-fade-up" style={{ animationDelay: "200ms" }}>
      <div className="max-w-md mx-auto px-3 pb-[env(safe-area-inset-bottom,8px)]">
        <div className="pessy-glass rounded-2xl border border-white/40 shadow-[0_-2px_20px_rgba(7,71,56,0.08)] px-2 py-2">
          <div className="flex items-center justify-around">
            <StandardTab active={activeTab === "inicio"} label="Inicio" onClick={() => handleNav("inicio")}>
              <Home size={20} />
            </StandardTab>

            <StandardTab active={activeTab === "identidad"} label="Identidad" onClick={() => handleNav("identidad")}>
              <Shield size={20} />
            </StandardTab>

            {onAddDocument ? (
              <button onClick={onAddDocument} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150" aria-label="Agregar documento">
                <div className="size-12 rounded-[14px] bg-[#074738] text-white flex items-center justify-center shadow-[0_2px_12px_rgba(7,71,56,0.3)]">
                  <Plus size={24} strokeWidth={2.2} />
                </div>
                <span className="text-[10px] font-bold tracking-wider text-[#074738]">Agregar</span>
              </button>
            ) : (
              <div className="px-3" />
            )}

            <StandardTab active={activeTab === "cuidados"} label="Cuidados" onClick={() => handleNav("cuidados")}>
              <Heart size={20} />
            </StandardTab>

            <StandardTab active={activeTab === "servicios"} label="Servicios" onClick={() => handleNav("servicios")}>
              <Compass size={20} />
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
