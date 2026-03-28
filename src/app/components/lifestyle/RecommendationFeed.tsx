/**
 * RecommendationFeed — Personalized place recommendations
 *
 * Extends NearbyVets concept to all place categories.
 * Scoring: preference_match + proximity + rating + pet_compat + context.
 * Gated by plan: Free=2, Premium=5.
 */

import { useState } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { usePreferences } from "../../contexts/PreferenceContext";
import { usePet } from "../../contexts/PetContext";

type PlaceCategory = "all" | "cafe" | "park" | "vet" | "shop" | "grooming" | "restaurant" | "outdoor";

interface PlaceCard {
  id: string;
  name: string;
  category: PlaceCategory;
  distance: string;
  rating: number;
  reason: string;
  photoUrl?: string;
  isOpen?: boolean;
}

const CATEGORY_CONFIG: Record<PlaceCategory, { label: string; icon: string }> = {
  all: { label: "Todos", icon: "explore" },
  cafe: { label: "Cafés", icon: "local_cafe" },
  park: { label: "Parques", icon: "park" },
  vet: { label: "Vets", icon: "medical_services" },
  shop: { label: "Tiendas", icon: "store" },
  grooming: { label: "Grooming", icon: "content_cut" },
  restaurant: { label: "Restaurantes", icon: "restaurant" },
  outdoor: { label: "Outdoor", icon: "terrain" },
};

interface Props {
  onBack: () => void;
}

export function RecommendationFeed({ onBack }: Props) {
  const { profile } = usePreferences();
  const { activePet } = usePet();
  const [activeCategory, setActiveCategory] = useState<PlaceCategory>("all");

  // Placeholder recommendations — in production, this queries Google Places API + Firestore places
  // and applies the scoring model from references/places-recommendations.md
  const placeholderCards: PlaceCard[] = [
    {
      id: "1",
      name: "Café del Parque",
      category: "cafe",
      distance: "800m",
      rating: 4.6,
      reason: profile?.tags.includes("café_lover")
        ? `Porque te gustan los cafés y ${activePet?.name ?? "tu mascota"} es bienvenido/a`
        : "Café pet-friendly con terraza amplia",
      isOpen: true,
    },
    {
      id: "2",
      name: "Dog Park Norte",
      category: "park",
      distance: "1.2km",
      rating: 4.8,
      reason: `Espacio cerrado ideal para ${activePet?.name ?? "tu mascota"}`,
      isOpen: true,
    },
    {
      id: "3",
      name: "PetShop Premium",
      category: "shop",
      distance: "2.1km",
      rating: 4.4,
      reason: profile?.tags.includes("premium_buyer")
        ? "Alimento holístico y accesorios premium"
        : "Variedad de productos y buenos precios",
    },
  ];

  const filtered = activeCategory === "all"
    ? placeholderCards
    : placeholderCards.filter((c) => c.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#F0FAF9] dark:bg-[#101622]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="size-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" style={{ transition: "background 150ms ease" }}>
          <MaterialIcon name="arrow_back" className="text-[#074738] dark:text-emerald-400" />
        </button>
        <h1 className="text-lg font-bold text-[#074738] dark:text-white">Explorar</h1>
      </div>

      {/* Category tabs */}
      <div className="px-4 py-3 overflow-x-auto flex gap-2 no-scrollbar">
        {(Object.keys(CATEGORY_CONFIG) as PlaceCategory[]).map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-4 h-[36px] rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 ${
                isActive
                  ? "bg-[#074738] text-white"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
              }`}
              style={{ transition: "all 150ms ease" }}
            >
              <MaterialIcon name={cfg.icon} className="text-base" />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      <div className="max-w-md mx-auto px-4 py-2 flex flex-col gap-3">
        {filtered.map((place) => (
          <div key={place.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-bold text-[#074738] dark:text-white text-base">{place.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[#1A9B7D] font-medium flex items-center gap-0.5">
                    <MaterialIcon name="location_on" className="text-sm" />{place.distance}
                  </span>
                  <span className="text-xs text-amber-500 font-medium flex items-center gap-0.5">
                    <MaterialIcon name="star" className="text-sm" />{place.rating}
                  </span>
                  {place.isOpen && (
                    <span className="text-xs text-emerald-600 font-medium">Abierto</span>
                  )}
                </div>
              </div>
              <div className="size-10 rounded-xl bg-[#E0F2F1] dark:bg-emerald-900/30 flex items-center justify-center">
                <MaterialIcon
                  name={CATEGORY_CONFIG[place.category]?.icon ?? "place"}
                  className="text-[#1A9B7D] text-xl"
                />
              </div>
            </div>
            {/* Personalized reason */}
            <div className="bg-[#F0FAF9] dark:bg-slate-800 rounded-xl px-3 py-2 mt-2">
              <p className="text-xs text-[#074738] dark:text-emerald-300">
                <MaterialIcon name="auto_awesome" className="text-sm mr-1 align-middle" />
                {place.reason}
              </p>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <MaterialIcon name="explore" className="text-5xl text-[#1A9B7D]/30 mb-3" />
            <p className="text-sm text-slate-500">No hay lugares en esta categoría cerca tuyo todavía.</p>
          </div>
        )}
      </div>
    </div>
  );
}
