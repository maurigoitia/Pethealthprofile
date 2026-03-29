/**
 * CommunityHub — Comunidad PESSY
 *
 * Unified community hub with 3 tabs:
 * 1. Perdidos — Lost pet reports + "Perdí mi mascota" form
 * 2. Encontrados — Found pet reports + "Encontré una mascota" form
 * 3. Adopción — Adoption feed + post for adoption form
 */

import { lazy, Suspense, useState } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";

const LostPetFeed = lazy(() => import("./LostPetFeed").then((m) => ({ default: m.LostPetFeed })));
const ReportLostPet = lazy(() => import("./ReportLostPet").then((m) => ({ default: m.ReportLostPet })));
const ReportFoundPet = lazy(() => import("./ReportFoundPet").then((m) => ({ default: m.ReportFoundPet })));
const AdoptionFeed = lazy(() => import("./AdoptionFeed").then((m) => ({ default: m.AdoptionFeed })));
const PostForAdoption = lazy(() => import("./PostForAdoption").then((m) => ({ default: m.PostForAdoption })));
const FoundPetFeed = lazy(() => import("./FoundPetFeed").then((m) => ({ default: m.FoundPetFeed })));

type Tab = "lost" | "found" | "adopt";
type SubView = "feed" | "report-lost" | "report-found" | "post-adoption";

interface Props {
  onBack: () => void;
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="size-8 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: string; emoji: string }[] = [
  { id: "lost", label: "Perdidos", icon: "search", emoji: "🔍" },
  { id: "found", label: "Encontrados", icon: "location_on", emoji: "📍" },
  { id: "adopt", label: "Adopción", icon: "favorite", emoji: "🐾" },
];

export function CommunityHub({ onBack }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("lost");
  const [subView, setSubView] = useState<SubView>("feed");

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSubView("feed");
  };

  // Show sub-forms fullscreen
  if (subView === "report-lost") {
    return (
      <Suspense fallback={<Spinner />}>
        <ReportLostPet onBack={() => setSubView("feed")} onSuccess={() => { setActiveTab("lost"); setSubView("feed"); }} />
      </Suspense>
    );
  }
  if (subView === "report-found") {
    return (
      <Suspense fallback={<Spinner />}>
        <ReportFoundPet onBack={() => setSubView("feed")} onSuccess={() => { setActiveTab("found"); setSubView("feed"); }} />
      </Suspense>
    );
  }
  if (subView === "post-adoption") {
    return (
      <Suspense fallback={<Spinner />}>
        <PostForAdoption onBack={() => setSubView("feed")} onSuccess={() => { setActiveTab("adopt"); setSubView("feed"); }} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0FAF9] dark:bg-[#101622] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
        <div className="px-4 pt-4 pb-0 flex items-center gap-3">
          <button
            onClick={onBack}
            className="size-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <MaterialIcon name="arrow_back" className="text-[#074738] dark:text-emerald-400" />
          </button>
          <div className="flex-1 min-w-0">
            <h1
              className="text-xl font-black text-[#074738] dark:text-white"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Comunidad
            </h1>
            <p className="text-xs text-slate-500">Pets perdidos, encontrados y en adopción</p>
          </div>
          {/* Action button per tab */}
          {activeTab === "lost" && (
            <button
              onClick={() => setSubView("report-lost")}
              className="h-[40px] px-3 rounded-2xl bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
            >
              <MaterialIcon name="add_alert" className="text-sm" />
              Perdí mi mascota
            </button>
          )}
          {activeTab === "found" && (
            <button
              onClick={() => setSubView("report-found")}
              className="h-[40px] px-3 rounded-2xl bg-[#1A9B7D] text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
            >
              <MaterialIcon name="location_on" className="text-sm" />
              Encontré una
            </button>
          )}
          {activeTab === "adopt" && (
            <button
              onClick={() => setSubView("post-adoption")}
              className="h-[40px] px-3 rounded-2xl bg-[#074738] text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
            >
              <MaterialIcon name="add" className="text-sm" />
              Publicar
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 pb-3 text-sm font-bold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#074738] text-[#074738] dark:border-emerald-400 dark:text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              <span role="img" aria-hidden>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1">
        <Suspense fallback={<Spinner />}>
          {activeTab === "lost" && (
            <LostPetFeed
              onReport={() => setSubView("report-lost")}
              onBack={onBack}
              hideHeader
            />
          )}
          {activeTab === "found" && (
            <FoundPetFeed
              onReport={() => setSubView("report-found")}
              onBack={onBack}
              hideHeader
            />
          )}
          {activeTab === "adopt" && (
            <AdoptionFeed
              onPublish={() => setSubView("post-adoption")}
              onBack={onBack}
              hideHeader
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
