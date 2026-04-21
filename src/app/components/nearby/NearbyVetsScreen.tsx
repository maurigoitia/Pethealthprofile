import { useState, useEffect, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../lib/firebase";
import { MaterialIcon } from "../shared/MaterialIcon";
import { VetProfileScreen } from "./VetProfileScreen";

interface VetClinic {
  place_id: string;
  name: string;
  vicinity: string;
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: { open_now: boolean };
  geometry: { location: { lat: number; lng: number } };
  distance?: number;
  // Loaded on-demand via getVetDetails
  phone?: string;
  website?: string;
  mapsUrl?: string;
  weekday_text?: string[];
  detailsLoaded?: boolean;
  detailsLoading?: boolean;
}

/** Optional context passed from VaccineAlertBanner or other CTAs */
export interface NearbyVetsContext {
  petName: string;
  reason: string;     // e.g. "Vacuna Antirrábica vence el 15 abr"
  urgency?: "normal" | "urgent";
}

interface NearbyVetsScreenProps {
  onBack: () => void;
  context?: NearbyVetsContext;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function NearbyVetsScreen({ onBack, context }: NearbyVetsScreenProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "denied">("idle");
  const [vets, setVets] = useState<VetClinic[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [expandedVetId, setExpandedVetId] = useState<string | null>(null);
  const [selectedVet, setSelectedVet] = useState<VetClinic | null>(null);

  const fetchNearbyVets = useCallback(async (lat: number, lng: number) => {
    setStatus("loading");
    try {
      const nearbyVetsFunction = httpsCallable<
        { lat: number; lng: number; radius?: number; type?: string },
        { success: boolean; results?: VetClinic[]; error?: string }
      >(functions, "nearbyVets");

      const response = await nearbyVetsFunction({ lat, lng, radius: 5000, type: "veterinary_care" });

      if (response.data.success && response.data.results) {
        const results: VetClinic[] = response.data.results.map((p: VetClinic) => ({
          ...p,
          distance: distanceKm(lat, lng, p.geometry.location.lat, p.geometry.location.lng),
        })).sort((a: VetClinic, b: VetClinic) => (a.distance || 0) - (b.distance || 0));
        setVets(results);
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setStatus("error"); return; }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        fetchNearbyVets(coords.lat, coords.lng);
      },
      err => {
        if (err.code === 1) setStatus("denied");
        else setStatus("error");
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [fetchNearbyVets]);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  // Keep selectedVet in sync when details finish loading
  useEffect(() => {
    if (selectedVet) {
      const updated = vets.find(v => v.place_id === selectedVet.place_id);
      if (updated) setSelectedVet(updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vets]);

  /** Fetch phone + website for a specific vet on demand */
  const loadVetDetails = useCallback(async (placeId: string) => {
    setVets(prev => prev.map(v =>
      v.place_id === placeId ? { ...v, detailsLoading: true } : v
    ));

    try {
      const getDetails = httpsCallable<
        { place_id: string },
        { success: boolean; details?: { formatted_phone_number?: string; international_phone_number?: string; website?: string; url?: string; opening_hours?: { weekday_text?: string[] } } }
      >(functions, "getVetDetails");

      const res = await getDetails({ place_id: placeId });

      if (res.data.success && res.data.details) {
        const d = res.data.details;
        setVets(prev => prev.map(v =>
          v.place_id === placeId
            ? {
                ...v,
                phone: d.formatted_phone_number || d.international_phone_number,
                website: d.website,
                mapsUrl: d.url,
                weekday_text: d.opening_hours?.weekday_text,
                detailsLoaded: true,
                detailsLoading: false,
              }
            : v
        ));
      } else {
        setVets(prev => prev.map(v =>
          v.place_id === placeId ? { ...v, detailsLoaded: true, detailsLoading: false } : v
        ));
      }
    } catch {
      setVets(prev => prev.map(v =>
        v.place_id === placeId ? { ...v, detailsLoaded: true, detailsLoading: false } : v
      ));
    }
  }, []);

  const handleExpandVet = (vet: VetClinic) => {
    const isExpanding = expandedVetId !== vet.place_id;
    setExpandedVetId(isExpanding ? vet.place_id : null);
    // Load details when expanding for the first time
    if (isExpanding && !vet.detailsLoaded && !vet.detailsLoading) {
      loadVetDetails(vet.place_id);
    }
  };

  const handleOpenProfile = (vet: VetClinic) => {
    setSelectedVet(vet);
    if (!vet.detailsLoaded && !vet.detailsLoading) {
      loadVetDetails(vet.place_id);
    }
  };

  const callVet = (vet: VetClinic) => {
    if (vet.phone) {
      // Clean phone number and open tel: link
      const clean = vet.phone.replace(/[\s\-().]/g, "");
      window.location.href = `tel:${clean}`;
    } else {
      // Fallback: Google Maps with call intent
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vet.name)}&query_place_id=${vet.place_id}`,
        "_blank", "noopener,noreferrer"
      );
    }
  };

  const openInMaps = (vet: VetClinic) => {
    const url = vet.mapsUrl ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vet.name)}&query_place_id=${vet.place_id}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const searchInMaps = () => {
    const q = searchQuery.trim() || "veterinaria";
    if (userCoords) {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(q)}/@${userCoords.lat},${userCoords.lng},14z`, "_blank", "noopener,noreferrer");
    } else {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(q)}`, "_blank", "noopener,noreferrer");
    }
  };

  const normalizedQuery = searchQuery.toLowerCase();
  const filtered = vets.filter((v) => {
    if (!searchQuery) return true;
    return (v.name || "").toLowerCase().includes(normalizedQuery) ||
           (v.vicinity || "").toLowerCase().includes(normalizedQuery);
  });

  const Stars = ({ rating }: { rating?: number }) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-1">
        <MaterialIcon name="star" className="text-amber-400 text-sm" />
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{rating.toFixed(1)}</span>
      </div>
    );
  };

  if (selectedVet) {
    return (
      <VetProfileScreen
        vet={selectedVet}
        onBack={() => setSelectedVet(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F0FAF9] dark:bg-[#101622] flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col min-h-screen">

        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={onBack}
              className="size-10 rounded-full bg-[#E0F2F1] dark:bg-slate-800 flex items-center justify-center">
              <MaterialIcon name="arrow_back" className="text-[#074738]" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">Veterinarias</h1>
              <p className="text-sm text-slate-500">
                {status === "success" ? `${filtered.length} cercanas` : "Buscando..."}
              </p>
            </div>
            <div className="flex rounded-xl bg-[#E0F2F1] dark:bg-slate-800 p-1 gap-1">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${viewMode === "list" ? "bg-[#074738] text-white" : "text-[#074738]"}`}
              >
                Lista
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${viewMode === "map" ? "bg-[#074738] text-white" : "text-[#074738]"}`}
              >
                Mapa
              </button>
            </div>
            <button onClick={requestLocation}
              className="size-10 rounded-full bg-[#E0F2F1] dark:bg-slate-800 flex items-center justify-center">
              <MaterialIcon name="my_location" className="text-[#074738] text-xl" />
            </button>
          </div>

          {/* Context banner — shown when coming from vaccine alert or other CTA */}
          {context && (
            <div className={`mb-3 rounded-[12px] px-4 py-3 flex items-start gap-2.5 ${
              context.urgency === "urgent"
                ? "bg-red-50 border border-red-200"
                : "bg-amber-50 border border-amber-200"
            }`}>
              <MaterialIcon
                name="vaccines"
                className={`!text-lg shrink-0 mt-0.5 ${context.urgency === "urgent" ? "text-red-500" : "text-amber-500"}`}
              />
              <div>
                <p className="text-xs font-black text-slate-800 leading-tight">{context.petName}</p>
                <p className="text-xs text-slate-600">{context.reason}</p>
              </div>
            </div>
          )}

          {/* Buscador */}
          {viewMode === "list" && (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-[12px] bg-[#E0F2F1] dark:bg-slate-800">
                <MaterialIcon name="search" className="text-slate-400 text-lg" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar veterinaria..."
                  className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                />
              </div>
              <button onClick={searchInMaps}
                className="px-4 py-3 rounded-[12px] bg-[#1A9B7D] text-white text-sm font-bold">
                Maps
              </button>
            </div>
          )}
        </div>

        {/* Map view */}
        {viewMode === "map" && (
          <div className="flex-1 relative">
            {userCoords ? (
              <>
                <iframe
                  key={`map-${userCoords.lat}-${userCoords.lng}`}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent("veterinaria clínica veterinaria")}&ll=${userCoords.lat},${userCoords.lng}&z=14&output=embed`}
                  title="Veterinarias cerca"
                  className="w-full h-full"
                  style={{ border: 0, minHeight: "calc(100vh - 200px)" }}
                  allowFullScreen
                  loading="lazy"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center gap-2">
                  <MaterialIcon name="my_location" className="text-[#1A9B7D] text-sm shrink-0" />
                  <p className="text-xs text-slate-500">Veterinarias a menos de 5km</p>
                  <button onClick={searchInMaps} className="ml-auto text-xs font-bold text-[#1A9B7D] flex items-center gap-1">
                    <MaterialIcon name="open_in_new" className="!text-[12px]" />
                    Maps
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16 px-6">
                {status === "loading" ? (
                  <>
                    <div className="size-12 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin mb-4" />
                    <p className="text-sm font-bold text-slate-700 dark:text-white">Obteniendo ubicación...</p>
                  </>
                ) : (
                  <>
                    <div className="size-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                      <MaterialIcon name="location_off" className="text-3xl text-amber-600" />
                    </div>
                    <h3 className="font-black text-slate-900 dark:text-white mb-2">Sin ubicación</h3>
                    <button onClick={requestLocation} className="px-5 py-3 rounded-[14px] bg-[#1A9B7D] text-white font-bold text-sm mt-2">
                      Activar ubicación
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Lista */}
        {viewMode === "list" && (
          <div className="flex-1 overflow-y-auto p-4">

            {status === "loading" && (
              <div className="text-center py-16">
                <div className="size-16 rounded-full bg-[#E0F2F1] flex items-center justify-center mx-auto mb-4">
                  <div className="size-8 border-2 border-[#1A9B7D]/30 border-t-[#1A9B7D] rounded-full animate-spin" />
                </div>
                <p className="font-bold text-slate-900 dark:text-white">Buscando veterinarias</p>
                <p className="text-sm text-slate-500 mt-1">Usando tu ubicación actual...</p>
              </div>
            )}

            {status === "denied" && (
              <div className="text-center py-16 px-4">
                <div className="size-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <MaterialIcon name="location_off" className="text-3xl text-amber-600" />
                </div>
                <h3 className="font-black text-slate-900 dark:text-white mb-2">Ubicación bloqueada</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Habilitá el acceso a la ubicación para encontrar veterinarias cercanas
                </p>
                <button onClick={searchInMaps}
                  className="px-6 py-3 rounded-[14px] bg-[#1A9B7D] text-white font-bold shadow-lg shadow-[#1A9B7D]/30">
                  Buscar en Google Maps
                </button>
              </div>
            )}

            {status === "error" && !vets.length && (
              <div className="text-center py-16 px-4">
                <div className="size-16 rounded-full bg-[#E0F2F1] dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <MaterialIcon name="local_hospital" className="text-3xl text-[#074738]" />
                </div>
                <h3 className="font-black text-slate-900 dark:text-white mb-2">Buscá veterinarias cerca tuyo</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Usá Google Maps para encontrar veterinarias cercanas a tu ubicación.
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={requestLocation}
                    className="px-5 py-3 rounded-[14px] border-2 border-[#1A9B7D] text-[#1A9B7D] font-bold">
                    Reintentar
                  </button>
                  <button onClick={searchInMaps}
                    className="px-5 py-3 rounded-[14px] bg-[#1A9B7D] text-white font-bold shadow-lg shadow-[#1A9B7D]/30">
                    Abrir Maps
                  </button>
                </div>
              </div>
            )}

            {status === "success" && (
              <div className="space-y-3">
                {filtered.length === 0 && (
                  <p className="text-center text-slate-500 py-8">Sin resultados para "{searchQuery}"</p>
                )}

                {filtered.map(vet => {
                  const isExpanded = expandedVetId === vet.place_id;
                  return (
                    <div key={vet.place_id}
                      className="bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                      <div className="h-1 bg-[#1A9B7D]" />
                      <div className="p-4">
                        {/* Name + badges */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-black text-sm text-slate-900 dark:text-white flex-1 leading-snug">
                            {vet.name}
                          </h3>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {vet.distance !== undefined && (
                              <span className="text-xs font-bold text-[#1A9B7D] bg-[#E0F2F1] px-2 py-0.5 rounded-full">
                                {vet.distance < 1 ? `${Math.round(vet.distance * 1000)}m` : `${vet.distance.toFixed(1)}km`}
                              </span>
                            )}
                            {vet.opening_hours && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                vet.opening_hours.open_now
                                  ? "bg-[#D1FAE5] text-[#1A9B7D]"
                                  : "bg-red-100 text-red-700"
                              }`}>
                                {vet.opening_hours.open_now ? "Abierto" : "Cerrado"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Address */}
                        <div className="flex items-center gap-1.5 mb-2">
                          <MaterialIcon name="place" className="text-slate-400 text-sm" />
                          <span className="text-xs text-slate-500 truncate">{vet.vicinity || "Dirección no disponible"}</span>
                        </div>

                        {/* Rating */}
                        {vet.rating && (
                          <div className="flex items-center gap-2 mb-3">
                            <Stars rating={vet.rating} />
                            {vet.user_ratings_total && (
                              <span className="text-xs text-slate-400">({vet.user_ratings_total} opiniones)</span>
                            )}
                          </div>
                        )}

                        {/* Expanded details — phone, hours, website */}
                        {isExpanded && (
                          <div className="mb-3 rounded-[10px] bg-[#F8FAFB] dark:bg-slate-800/50 p-3 space-y-2">
                            {vet.detailsLoading && (
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <div className="size-3 border border-slate-300 border-t-[#1A9B7D] rounded-full animate-spin" />
                                Cargando info...
                              </div>
                            )}
                            {vet.detailsLoaded && !vet.detailsLoading && (
                              <>
                                {vet.phone && (
                                  <div className="flex items-center gap-2">
                                    <MaterialIcon name="phone" className="text-[#1A9B7D] !text-sm" />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{vet.phone}</span>
                                  </div>
                                )}
                                {vet.website && (
                                  <div className="flex items-center gap-2">
                                    <MaterialIcon name="language" className="text-[#1A9B7D] !text-sm" />
                                    <a href={vet.website} target="_blank" rel="noopener noreferrer"
                                      className="text-xs font-bold text-[#1A9B7D] underline truncate max-w-[220px]">
                                      Sitio web
                                    </a>
                                  </div>
                                )}
                                {vet.weekday_text && vet.weekday_text.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Horarios</p>
                                    {vet.weekday_text.map((line, i) => (
                                      <p key={i} className="text-[11px] text-slate-600 dark:text-slate-400">{line}</p>
                                    ))}
                                  </div>
                                )}
                                {!vet.phone && !vet.website && !vet.weekday_text && (
                                  <p className="text-xs text-slate-400">Sin info adicional disponible</p>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* CTA buttons */}
                        <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <button
                            onClick={() => handleExpandVet(vet)}
                            className="px-3 py-2.5 rounded-[12px] bg-[#E0F2F1] dark:bg-slate-800 text-[#074738] dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-transform"
                          >
                            <MaterialIcon name={isExpanded ? "expand_less" : "info"} className="text-sm" />
                            {isExpanded ? "Ocultar" : "Info"}
                          </button>
                          <button
                            onClick={() => handleOpenProfile(vet)}
                            className="px-3 py-2.5 rounded-[12px] bg-[#E0F2F1] dark:bg-slate-800 text-[#074738] dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-transform"
                          >
                            <MaterialIcon name="open_in_full" className="text-sm" />
                            Perfil
                          </button>
                          <button
                            onClick={() => callVet(vet)}
                            className={`flex-1 py-2.5 rounded-[12px] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform ${
                              vet.phone
                                ? "bg-[#1A9B7D] text-white shadow-lg shadow-[#1A9B7D]/25"
                                : "bg-[#E0F2F1] dark:bg-slate-800 text-[#074738] dark:text-slate-300"
                            }`}
                          >
                            <MaterialIcon name="phone" className="text-sm" />
                            {vet.phone ? "Llamar" : "Buscar tel."}
                          </button>
                          <button
                            onClick={() => openInMaps(vet)}
                            className="flex-1 py-2.5 rounded-[12px] bg-[#074738] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#074738]/20 active:scale-95 transition-transform">
                            <MaterialIcon name="directions" className="text-sm" />
                            Cómo llegar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <button onClick={searchInMaps}
                  className="w-full py-3 rounded-[14px] border-2 border-[#E0F2F1] dark:border-slate-700 text-[#074738] dark:text-slate-400 font-bold text-sm flex items-center justify-center gap-2">
                  <MaterialIcon name="open_in_new" className="text-sm" />
                  Ver más en Google Maps
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
