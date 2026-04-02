import { useState, useEffect } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";

type Category = {
  id: string;
  label: string;
  query: string;
  icon: string;
  emoji: string;
};

const CATEGORIES: Category[] = [
  { id: "parques", label: "Parques", query: "parques para perros", icon: "park", emoji: "🌳" },
  { id: "cafes", label: "Cafés", query: "cafe pet friendly", icon: "local_cafe", emoji: "☕" },
  { id: "veterinarias", label: "Veterinarias", query: "veterinaria clínica veterinaria", icon: "local_hospital", emoji: "🏥" },
  { id: "grooming", label: "Grooming", query: "peluquería canina grooming mascotas", icon: "content_cut", emoji: "✂️" },
];

export function RecommendationFeed({ onBack }: { onBack?: () => void }) {
  const [selected, setSelected] = useState<Category>(CATEGORIES[0]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<"loading" | "ready" | "denied" | "error">("loading");

  useEffect(() => {
    if (!navigator.geolocation) { setLocStatus("error"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("ready");
      },
      (err) => setLocStatus(err.code === 1 ? "denied" : "error"),
      { timeout: 12000, maximumAge: 60000 }
    );
  }, []);

  const mapSrc = coords
    ? `https://maps.google.com/maps?q=${encodeURIComponent(selected.query)}&ll=${coords.lat},${coords.lng}&z=14&output=embed`
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F0FAF9]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 pt-6 pb-3">
        <div className="flex items-center gap-3 mb-3">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Volver"
              className="size-10 rounded-full bg-[#E0F2F1] flex items-center justify-center shrink-0 focus-visible:ring-2 focus-visible:ring-[#074738] focus-visible:ring-offset-2"
            >
              <MaterialIcon name="arrow_back" className="text-[#074738]" />
            </button>
          )}
          <div className="min-w-0">
            <h1
              className="text-2xl font-black text-slate-900 leading-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Explorar
            </h1>
            <p className="text-xs text-slate-500">Lugares pet-friendly cerca tuyo</p>
          </div>
        </div>

        {/* Category tabs */}
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelected(cat)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold transition-colors ${
                selected.id === cat.id
                  ? "bg-[#074738] text-white"
                  : "bg-[#E0F2F1] text-[#074738]"
              }`}
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              <span role="img" aria-label={cat.label}>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Map / Status area */}
      <div className="flex-1 relative min-h-[400px]">
        {locStatus === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F0FAF9] z-10">
            <div className="size-12 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin mb-4" />
            <p className="text-sm font-bold text-slate-700">Obteniendo ubicación...</p>
            <p className="text-xs text-slate-400 mt-1">Un momento por favor</p>
          </div>
        )}

        {locStatus === "denied" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 bg-[#F0FAF9] z-10">
            <div className="size-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <MaterialIcon name="location_off" className="text-3xl text-amber-600" />
            </div>
            <h3
              className="font-black text-slate-900 mb-2 text-center"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Ubicación bloqueada
            </h3>
            <p className="text-sm text-slate-500 text-center mb-5 max-w-xs">
              Habilitá el acceso a la ubicación para ver {selected.label.toLowerCase()} cerca tuyo
            </p>
            <a
              href={`https://maps.google.com/maps?q=${encodeURIComponent(selected.query)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl bg-[#1A9B7D] text-white font-bold text-sm shadow-lg shadow-[#1A9B7D]/25"
            >
              Abrir Google Maps
            </a>
          </div>
        )}

        {locStatus === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 bg-[#F0FAF9] z-10">
            <div className="size-16 rounded-full bg-[#E0F2F1] flex items-center justify-center mb-4">
              <MaterialIcon name="map" className="text-3xl text-[#074738]" />
            </div>
            <h3
              className="font-black text-slate-900 mb-2"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              No se pudo obtener la ubicación
            </h3>
            <a
              href={`https://maps.google.com/maps?q=${encodeURIComponent(selected.query)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl bg-[#1A9B7D] text-white font-bold text-sm mt-4"
            >
              Abrir Google Maps
            </a>
          </div>
        )}

        {locStatus === "ready" && mapSrc && (
          <iframe
            key={`${selected.id}-${coords?.lat}-${coords?.lng}`}
            src={mapSrc}
            title={`${selected.label} cerca`}
            className="w-full h-full"
            style={{ border: 0, minHeight: "calc(100vh - 160px)" }}
            allowFullScreen
            loading="lazy"
          />
        )}
      </div>

      {/* Footer note */}
      {locStatus === "ready" && (
        <div className="bg-white border-t border-slate-100 px-4 py-2.5 flex items-center gap-2">
          <MaterialIcon name="my_location" className="text-[#1A9B7D] text-sm shrink-0" />
          <p className="text-xs text-slate-500">Mostrando {selected.label.toLowerCase()} a menos de 5km</p>
          <a
            href={mapSrc || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs font-bold text-[#1A9B7D] flex items-center gap-1 shrink-0"
          >
            <MaterialIcon name="open_in_new" className="!text-[12px]" />
            Maps
          </a>
        </div>
      )}
    </div>
  );
}
