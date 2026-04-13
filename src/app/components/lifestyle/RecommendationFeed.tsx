/**
 * RecommendationFeed — Real nearby places via Google Places API
 *
 * Searches 5 pet-friendly categories in parallel:
 * vet, park, cafe, shop, grooming
 * 8km radius, max 5 per category, sorted by distance.
 */

import { useState, useEffect, useCallback } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";

type PlaceCategory = "all" | "vet" | "park" | "cafe" | "shop" | "grooming";

interface NearbyPlace {
  id: string;
  name: string;
  category: PlaceCategory;
  distanceKm: number;
  rating: number;
  totalRatings: number;
  isOpen: boolean | null;
  vicinity: string;
  lat: number;
  lng: number;
}

type FeedState = "idle" | "loading" | "success" | "error" | "no_key" | "denied";

const CATEGORY_CONFIG: Record<PlaceCategory, { label: string; icon: string }> = {
  all: { label: "Todos", icon: "explore" },
  vet: { label: "Vets", icon: "medical_services" },
  park: { label: "Parques", icon: "park" },
  cafe: { label: "Cafés", icon: "local_cafe" },
  shop: { label: "Tiendas", icon: "store" },
  grooming: { label: "Grooming", icon: "content_cut" },
};

const SEARCH_CONFIGS: { category: PlaceCategory; type?: string; keyword?: string }[] = [
  { category: "vet", type: "veterinary_care" },
  { category: "park", type: "park", keyword: "perros" },
  { category: "cafe", keyword: "pet friendly cafe" },
  { category: "shop", keyword: "pet shop" },
  { category: "grooming", keyword: "peluqueria canina grooming" },
];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Props {
  onBack: () => void;
}

export function RecommendationFeed({ onBack }: Props) {
  const [state, setState] = useState<FeedState>("idle");
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [activeCategory, setActiveCategory] = useState<PlaceCategory>("all");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchPlaces = useCallback(async () => {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_KEY;
    if (!apiKey) {
      setState("no_key");
      return;
    }

    setState("loading");

    let lat: number;
    let lng: number;

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      setState("denied");
      return;
    }

    try {
      const results = await Promise.all(
        SEARCH_CONFIGS.map(async (cfg) => {
          const params = new URLSearchParams({
            location: `${lat},${lng}`,
            radius: "8000",
            key: apiKey,
          });
          if (cfg.type) params.set("type", cfg.type);
          if (cfg.keyword) params.set("keyword", cfg.keyword);

          const res = await fetch(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`
          );
          const data = await res.json();

          if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
            console.warn(`Places API (${cfg.category}):`, data.status);
            return [];
          }

          return (data.results || []).slice(0, 5).map((p: any) => ({
            id: p.place_id,
            name: p.name,
            category: cfg.category,
            distanceKm: haversine(lat, lng, p.geometry.location.lat, p.geometry.location.lng),
            rating: p.rating || 0,
            totalRatings: p.user_ratings_total || 0,
            isOpen: p.opening_hours?.open_now ?? null,
            vicinity: p.vicinity || "",
            lat: p.geometry.location.lat,
            lng: p.geometry.location.lng,
          }));
        })
      );

      const all = results.flat().sort((a, b) => a.distanceKm - b.distanceKm);
      setPlaces(all);
      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
      setState("error");
    }
  }, []);

  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  const filtered = activeCategory === "all" ? places : places.filter((p) => p.category === activeCategory);

  const openMaps = (place: NearbyPlace) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9] font-['Manrope',sans-serif]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-[#E5E7EB] px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="size-10 flex items-center justify-center rounded-full hover:bg-[#E0F2F1] transition-colors">
          <MaterialIcon name="arrow_back" className="text-[#074738]" />
        </button>
        <h1 className="text-lg font-[800] text-[#074738]">Explorar</h1>
      </div>

      {/* Category tabs */}
      <div className="px-4 py-3 overflow-x-auto flex gap-2 scrollbar-hide">
        {(Object.keys(CATEGORY_CONFIG) as PlaceCategory[]).map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-4 h-9 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? "bg-[#074738] text-white"
                  : "bg-white text-[#6B7280] border border-[#E5E7EB]"
              }`}
            >
              <MaterialIcon name={cfg.icon} className="text-base" />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* States */}
      {state === "loading" && (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-2 border-[#1A9B7D] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#6B7280]">Buscando lugares cerca tuyo...</p>
        </div>
      )}

      {state === "no_key" && (
        <div className="text-center py-16 px-6">
          <MaterialIcon name="vpn_key" className="text-4xl text-[#9CA3AF] mb-3" />
          <p className="text-sm text-[#6B7280]">Falta la API key de Google Places (VITE_GOOGLE_PLACES_KEY)</p>
        </div>
      )}

      {state === "denied" && (
        <div className="text-center py-16 px-6">
          <MaterialIcon name="location_off" className="text-4xl text-[#9CA3AF] mb-3" />
          <p className="text-sm font-bold text-[#074738] mb-1">Ubicación no disponible</p>
          <p className="text-xs text-[#6B7280] mb-4">Necesitamos tu ubicación para mostrar lugares cercanos.</p>
          <button
            onClick={() => window.open("https://www.google.com/maps/search/veterinaria+cerca", "_blank")}
            className="rounded-full bg-[#074738] px-5 py-2.5 text-xs font-bold text-white"
          >
            Buscar en Google Maps
          </button>
        </div>
      )}

      {state === "error" && (
        <div className="text-center py-16 px-6">
          <MaterialIcon name="error_outline" className="text-4xl text-[#D97706] mb-3" />
          <p className="text-sm text-[#6B7280]">{errorMsg || "Error al buscar lugares"}</p>
          <button onClick={fetchPlaces} className="mt-3 rounded-full bg-[#074738] px-5 py-2 text-xs font-bold text-white">
            Reintentar
          </button>
        </div>
      )}

      {/* Results */}
      {state === "success" && (
        <div className="max-w-md mx-auto px-4 py-2 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <MaterialIcon name="explore" className="text-5xl text-[#1A9B7D]/30 mb-3" />
              <p className="text-sm text-[#6B7280]">No hay lugares en esta categoría cerca tuyo.</p>
            </div>
          ) : (
            filtered.map((place) => (
              <div key={place.id} className="rounded-3xl border border-[#E5E7EB] bg-white p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-[800] text-[#074738] truncate">{place.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-[#1A9B7D] font-medium flex items-center gap-0.5">
                        <MaterialIcon name="location_on" className="!text-sm" />
                        {place.distanceKm.toFixed(1)} km
                      </span>
                      {place.rating > 0 && (
                        <span className="text-xs text-amber-500 font-medium flex items-center gap-0.5">
                          <MaterialIcon name="star" className="!text-sm" />
                          {place.rating} ({place.totalRatings})
                        </span>
                      )}
                      {place.isOpen !== null && (
                        <span className={`text-xs font-medium ${place.isOpen ? "text-[#1A9B7D]" : "text-[#D97706]"}`}>
                          {place.isOpen ? "Abierto" : "Cerrado"}
                        </span>
                      )}
                    </div>
                    {place.vicinity && (
                      <p className="text-[11px] text-[#9CA3AF] mt-1 truncate">{place.vicinity}</p>
                    )}
                  </div>
                  <div className="size-10 rounded-xl bg-[#E0F2F1] flex items-center justify-center shrink-0 ml-2">
                    <MaterialIcon
                      name={CATEGORY_CONFIG[place.category]?.icon ?? "place"}
                      className="text-[#1A9B7D] text-xl"
                    />
                  </div>
                </div>
                <button
                  onClick={() => openMaps(place)}
                  className="mt-2 w-full rounded-full border border-[#E5E7EB] bg-[#F0FAF9] py-2 text-xs font-bold text-[#074738] hover:bg-[#E0F2F1] transition-colors"
                >
                  Cómo llegar →
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
