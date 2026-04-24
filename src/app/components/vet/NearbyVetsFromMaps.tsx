import { useCallback, useEffect, useState } from "react";
import { MapPin, NavigationIcon, Star, ExternalLink } from "lucide-react";

/**
 * NearbyVetsFromMaps — Fuente B de "Servicios reales".
 *
 * Muestra veterinarias cercanas usando Google Places API (cliente directo).
 * - NO se inventan vets: si no hay API key o la API falla, se muestra el fallback
 *   con un link directo a Google Maps.
 * - La posición del usuario NO se envía al backend de Pessy: solo se usa en cliente
 *   contra Google Places.
 *
 * Diseñado como sección embebida en VetSearchScreen ("Cerca tuyo"). Para la
 * pantalla full-screen, ver NearbyVetsScreen.
 */

interface PlaceResult {
  place_id: string;
  name: string;
  vicinity?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry: { location: { lat: number; lng: number } };
  distanceKm?: number;
}

type Status = "idle" | "asking" | "loading" | "success" | "denied" | "error" | "no-key";

const MAX_RESULTS = 5;
const RADIUS_M = 5000;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function openMapsSearch(coords: { lat: number; lng: number } | null) {
  const url = coords
    ? `https://www.google.com/maps/search/veterinaria/@${coords.lat},${coords.lng},14z`
    : "https://www.google.com/maps/search/veterinaria";
  window.open(url, "_blank", "noopener,noreferrer");
}

function openVetInMaps(vet: PlaceResult) {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    vet.name,
  )}&query_place_id=${vet.place_id}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function FallbackButton({ coords, label }: { coords: { lat: number; lng: number } | null; label: string }) {
  return (
    <button
      onClick={() => openMapsSearch(coords)}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[14px] bg-[#074738] text-white text-sm font-bold active:scale-[0.97] transition-transform"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <ExternalLink size={14} />
      {label}
    </button>
  );
}

function SectionHeader() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
      <NavigationIcon size={12} color="#1A9B7D" strokeWidth={2.4} />
      <p
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 10,
          fontWeight: 800,
          color: "#9CA3AF",
          textTransform: "uppercase",
          letterSpacing: ".1em",
        }}
      >
        Cerca tuyo
      </p>
    </div>
  );
}

export function NearbyVetsFromMaps() {
  const apiKey = (import.meta as { env: Record<string, string | undefined> }).env
    .VITE_GOOGLE_PLACES_KEY;
  const [status, setStatus] = useState<Status>(apiKey ? "idle" : "no-key");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [vets, setVets] = useState<PlaceResult[]>([]);

  const fetchPlaces = useCallback(
    async (lat: number, lng: number) => {
      if (!apiKey) {
        setStatus("no-key");
        return;
      }
      setStatus("loading");
      try {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${RADIUS_M}&type=veterinary_care&language=es&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === "OK") {
          const results: PlaceResult[] = (data.results || [])
            .map((p: PlaceResult) => ({
              ...p,
              distanceKm: haversineKm(lat, lng, p.geometry.location.lat, p.geometry.location.lng),
            }))
            .sort((a: PlaceResult, b: PlaceResult) => (a.distanceKm || 0) - (b.distanceKm || 0))
            .slice(0, MAX_RESULTS);
          setVets(results);
          setStatus("success");
        } else if (data.status === "ZERO_RESULTS") {
          setVets([]);
          setStatus("success");
        } else {
          // REQUEST_DENIED, OVER_QUERY_LIMIT, INVALID_REQUEST, etc.
          console.warn("[NearbyVetsFromMaps] Places API status:", data.status);
          setStatus("error");
        }
      } catch (err) {
        console.warn("[NearbyVetsFromMaps] fetch failed:", err);
        setStatus("error");
      }
    },
    [apiKey],
  );

  const requestLocation = useCallback(() => {
    if (!apiKey) {
      setStatus("no-key");
      return;
    }
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        fetchPlaces(c.lat, c.lng);
      },
      (err) => {
        if (err.code === 1) setStatus("denied");
        else setStatus("error");
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }, [apiKey, fetchPlaces]);

  // Auto-request on mount only if API key exists. No key = static fallback.
  useEffect(() => {
    if (apiKey) requestLocation();
  }, [apiKey, requestLocation]);

  // ── Sin API key → solo el botón externo, NUNCA mock data ──────────────────
  if (status === "no-key") {
    return (
      <div className="max-w-md mx-auto">
        <SectionHeader />
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 14,
            boxShadow: "0 2px 8px rgba(0,0,0,.04)",
            border: "1px solid rgba(7,71,56,.06)",
          }}
        >
          <p style={{ fontSize: 12, color: "#64748B", marginBottom: 10, lineHeight: 1.5 }}>
            Buscá veterinarias cerca tuyo en Google Maps.
          </p>
          <FallbackButton coords={null} label="Buscar en Google Maps" />
        </div>
      </div>
    );
  }

  // ── Cargando ubicación o resultados ────────────────────────────────────────
  if (status === "asking" || status === "loading") {
    return (
      <div className="max-w-md mx-auto">
        <SectionHeader />
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 14,
            border: "1px solid rgba(7,71,56,.06)",
          }}
          className="animate-pulse"
        >
          <div style={{ height: 12, background: "#F1F5F9", borderRadius: 4, marginBottom: 8, width: "70%" }} />
          <div style={{ height: 10, background: "#F1F5F9", borderRadius: 4, width: "40%" }} />
        </div>
      </div>
    );
  }

  // ── Permiso de ubicación rechazado ─────────────────────────────────────────
  if (status === "denied") {
    return (
      <div className="max-w-md mx-auto">
        <SectionHeader />
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 14,
            boxShadow: "0 2px 8px rgba(0,0,0,.04)",
            border: "1px solid rgba(7,71,56,.06)",
          }}
        >
          <p style={{ fontSize: 12, color: "#64748B", marginBottom: 10, lineHeight: 1.5 }}>
            Activá la ubicación para ver veterinarias cerca tuyo, o buscá directamente en Google Maps.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={requestLocation}
              className="flex-1 px-4 py-3 rounded-[14px] border-2 border-[#1A9B7D] text-[#1A9B7D] text-sm font-bold active:scale-[0.97] transition-transform"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Reintentar
            </button>
            <FallbackButton coords={null} label="Abrir Maps" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error de la API (key inválida, quota, etc) ─────────────────────────────
  if (status === "error") {
    return (
      <div className="max-w-md mx-auto">
        <SectionHeader />
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 14,
            boxShadow: "0 2px 8px rgba(0,0,0,.04)",
            border: "1px solid rgba(7,71,56,.06)",
          }}
        >
          <p style={{ fontSize: 12, color: "#64748B", marginBottom: 10, lineHeight: 1.5 }}>
            No pudimos buscar veterinarias ahora. Probá en Google Maps.
          </p>
          <FallbackButton coords={coords} label="Buscar en Google Maps" />
        </div>
      </div>
    );
  }

  // ── Sin resultados a 5km ───────────────────────────────────────────────────
  if (status === "success" && vets.length === 0) {
    return (
      <div className="max-w-md mx-auto">
        <SectionHeader />
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 14,
            boxShadow: "0 2px 8px rgba(0,0,0,.04)",
            border: "1px solid rgba(7,71,56,.06)",
          }}
        >
          <p style={{ fontSize: 12, color: "#64748B", marginBottom: 10, lineHeight: 1.5 }}>
            No encontramos veterinarias en 5 km. Ampliá la búsqueda en Google Maps.
          </p>
          <FallbackButton coords={coords} label="Ver más en Google Maps" />
        </div>
      </div>
    );
  }

  // ── Resultados reales ──────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto">
      <SectionHeader />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {vets.map((vet) => (
          <div
            key={vet.place_id}
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: "12px 14px",
              boxShadow: "0 2px 8px rgba(0,0,0,.04)",
              border: "1px solid rgba(7,71,56,.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  minWidth: 36,
                  borderRadius: "50%",
                  backgroundColor: "#E0F2F1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#074738",
                }}
              >
                <MapPin size={16} strokeWidth={2.2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#0F172A",
                    lineHeight: 1.3,
                  }}
                >
                  {vet.name}
                </p>
                {vet.vicinity && (
                  <p
                    style={{
                      fontSize: 11,
                      color: "#64748B",
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {vet.vicinity}
                  </p>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 4,
                    flexWrap: "wrap",
                  }}
                >
                  {typeof vet.distanceKm === "number" && (
                    <span style={{ fontSize: 11, color: "#1A9B7D", fontWeight: 700 }}>
                      {vet.distanceKm < 1
                        ? `${Math.round(vet.distanceKm * 1000)} m`
                        : `${vet.distanceKm.toFixed(1)} km`}
                    </span>
                  )}
                  {typeof vet.rating === "number" && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        fontSize: 11,
                        color: "#374151",
                        fontWeight: 600,
                      }}
                    >
                      <Star size={11} fill="#F59E0B" color="#F59E0B" />
                      {vet.rating.toFixed(1)}
                      {vet.user_ratings_total ? (
                        <span style={{ color: "#94A3B8", fontWeight: 500 }}>
                          ({vet.user_ratings_total})
                        </span>
                      ) : null}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => openVetInMaps(vet)}
              className="w-full mt-3 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#E0F2F1] text-[#074738] text-[11px] font-bold active:scale-[0.97] transition-transform"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              <ExternalLink size={11} />
              Ver en Maps
            </button>
          </div>
        ))}
        <button
          onClick={() => openMapsSearch(coords)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] border-2 border-[#E0F2F1] text-[#074738] text-[11px] font-bold active:scale-[0.97] transition-transform"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          <ExternalLink size={11} />
          Ver más en Google Maps
        </button>
      </div>
    </div>
  );
}
