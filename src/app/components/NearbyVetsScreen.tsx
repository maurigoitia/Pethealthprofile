import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";

interface VetClinic {
  place_id: string;
  name: string;
  vicinity: string;
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: { open_now: boolean };
  geometry: { location: { lat: number; lng: number } };
  distance?: number;
}

interface NearbyVetsScreenProps {
  onBack: () => void;
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

export function NearbyVetsScreen({ onBack }: NearbyVetsScreenProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "denied">("idle");
  const [vets, setVets] = useState<VetClinic[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchNearbyVets = useCallback(async (lat: number, lng: number) => {
    setStatus("loading");
    try {
      // Usamos la API de Places via proxy CORS (o directamente si tenés key en env)
      const apiKey = (import.meta as any).env.VITE_GOOGLE_PLACES_KEY;

      if (!apiKey) {
        // Fallback: abrir Google Maps con búsqueda
        setStatus("error");
        return;
      }

      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=veterinary_care&language=es&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "OK") {
        const results: VetClinic[] = (data.results || []).map((p: VetClinic) => ({
          ...p,
          distance: distanceKm(lat, lng, p.geometry.location.lat, p.geometry.location.lng),
        })).sort((a: VetClinic, b: VetClinic) => (a.distance || 0) - (b.distance || 0));
        setVets(results);
        setStatus("success");
      } else if (data.status === "ZERO_RESULTS") {
        setVets([]);
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

  const openInMaps = (vet: VetClinic) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vet.name)}&query_place_id=${vet.place_id}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const callVet = (vet: VetClinic) => {
    // Abrir llamada si hay teléfono (Places API v2 lo incluye en details)
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vet.name + " " + vet.vicinity)}`, "_blank", "noopener,noreferrer");
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
    const name = (v.name || "").toLowerCase();
    const vicinity = (v.vicinity || "").toLowerCase();
    return name.includes(normalizedQuery) || vicinity.includes(normalizedQuery);
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

  return (
    <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#101622] flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col min-h-screen">

        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={onBack}
              className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <MaterialIcon name="arrow_back" className="text-xl" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">Veterinarias</h1>
              <p className="text-sm text-slate-500">
                {status === "success" ? `${filtered.length} cercanas` : "Buscando..."}
              </p>
            </div>
            <button onClick={requestLocation}
              className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <MaterialIcon name="my_location" className="text-[#2b6fee] text-xl" />
            </button>
          </div>

          {/* Buscador */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800">
              <MaterialIcon name="search" className="text-slate-400 text-lg" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar veterinaria..."
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
            </div>
            <button onClick={searchInMaps}
              className="px-4 py-3 rounded-xl bg-[#2b6fee] text-white text-sm font-bold">
              Maps
            </button>
          </div>
        </div>

        {/* Estados */}
        <div className="flex-1 overflow-y-auto p-4">

          {status === "loading" && (
            <div className="text-center py-16">
              <div className="size-16 rounded-full bg-[#2b6fee]/10 flex items-center justify-center mx-auto mb-4">
                <div className="size-8 border-2 border-[#2b6fee]/30 border-t-[#2b6fee] rounded-full animate-spin" />
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
                className="px-6 py-3 rounded-xl bg-[#2b6fee] text-white font-bold shadow-lg shadow-[#2b6fee]/30">
                Buscar en Google Maps
              </button>
            </div>
          )}

          {(status === "error") && !vets.length && (
            <div className="text-center py-16 px-4">
              <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <MaterialIcon name="local_hospital" className="text-3xl text-slate-400" />
              </div>
              <h3 className="font-black text-slate-900 dark:text-white mb-2">
                {!(import.meta as any).env.VITE_GOOGLE_PLACES_KEY
                  ? "Buscá en Google Maps"
                  : "No se encontraron resultados"}
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                {!(import.meta as any).env.VITE_GOOGLE_PLACES_KEY
                  ? "Para ver veterinarias en la app configurá VITE_GOOGLE_PLACES_KEY. Por ahora usá Maps."
                  : "Intentá de nuevo o buscá en Google Maps"}
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={requestLocation}
                  className="px-5 py-3 rounded-xl border-2 border-[#2b6fee] text-[#2b6fee] font-bold">
                  Reintentar
                </button>
                <button onClick={searchInMaps}
                  className="px-5 py-3 rounded-xl bg-[#2b6fee] text-white font-bold shadow-lg shadow-[#2b6fee]/30">
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
              {filtered.map(vet => (
                <motion.div key={vet.place_id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="h-1 bg-[#2b6fee]" />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-black text-sm text-slate-900 dark:text-white flex-1 leading-snug">
                        {vet.name}
                      </h3>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {vet.distance !== undefined && (
                          <span className="text-xs font-bold text-[#2b6fee] bg-[#2b6fee]/10 px-2 py-0.5 rounded-full">
                            {vet.distance < 1 ? `${Math.round(vet.distance * 1000)}m` : `${vet.distance.toFixed(1)}km`}
                          </span>
                        )}
                        {vet.opening_hours && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            vet.opening_hours.open_now
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {vet.opening_hours.open_now ? "Abierto" : "Cerrado"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 mb-2">
                      <MaterialIcon name="place" className="text-slate-400 text-sm" />
                      <span className="text-xs text-slate-500 truncate">{vet.vicinity || "Dirección no disponible"}</span>
                    </div>

                    {vet.rating && (
                      <div className="flex items-center gap-2 mb-3">
                        <Stars rating={vet.rating} />
                        {vet.user_ratings_total && (
                          <span className="text-xs text-slate-400">({vet.user_ratings_total} opiniones)</span>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button onClick={() => callVet(vet)}
                        className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
                        <MaterialIcon name="phone" className="text-sm" />
                        Llamar
                      </button>
                      <button onClick={() => openInMaps(vet)}
                        className="flex-1 py-2.5 rounded-xl bg-[#2b6fee] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#2b6fee]/25 active:scale-95 transition-transform">
                        <MaterialIcon name="directions" className="text-sm" />
                        Cómo llegar
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Botón ver más en Maps */}
              <button onClick={searchInMaps}
                className="w-full py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-sm flex items-center justify-center gap-2">
                <MaterialIcon name="open_in_new" className="text-sm" />
                Ver más en Google Maps
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
