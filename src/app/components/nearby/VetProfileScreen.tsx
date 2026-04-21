import { MaterialIcon } from "../shared/MaterialIcon";

interface VetClinic {
  place_id: string;
  name: string;
  vicinity: string;
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: { open_now: boolean };
  geometry: { location: { lat: number; lng: number } };
  distance?: number;
  phone?: string;
  website?: string;
  mapsUrl?: string;
  weekday_text?: string[];
  detailsLoaded?: boolean;
  detailsLoading?: boolean;
}

interface VetProfileScreenProps {
  vet: VetClinic;
  onBack: () => void;
  onBookAppointment?: (vetName: string, clinicName: string) => void;
}

export function VetProfileScreen({ vet, onBack, onBookAppointment }: VetProfileScreenProps) {
  const initial = vet.name.charAt(0).toUpperCase();

  const openInMaps = () => {
    const url = vet.mapsUrl ||
      `https://maps.google.com/?q=${encodeURIComponent(vet.name + " " + vet.vicinity)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9] flex flex-col font-['Manrope',sans-serif]">
      <div className="max-w-md mx-auto w-full flex flex-col min-h-screen">

        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="size-10 rounded-full bg-[#E0F2F1] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
          >
            <MaterialIcon name="arrow_back" className="text-[#074738]" />
          </button>
          <h2 className="flex-1 text-sm font-black text-slate-900 truncate font-['Plus_Jakarta_Sans',sans-serif]">
            {vet.name}
          </h2>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pb-32">

          {/* Hero section */}
          <div className="bg-gradient-to-br from-[#074738] to-[#1A9B7D] px-6 pt-8 pb-8 flex flex-col items-center text-center">
            {/* Initial avatar */}
            <div className="size-20 rounded-full bg-white/20 flex items-center justify-center mb-4 border-4 border-white/30">
              <span className="text-4xl font-black text-white font-['Plus_Jakarta_Sans',sans-serif]">
                {initial}
              </span>
            </div>

            <h1 className="text-xl font-black text-white leading-snug mb-3 font-['Plus_Jakarta_Sans',sans-serif]">
              {vet.name}
            </h1>

            {/* Rating + reviews */}
            {vet.rating && (
              <div className="flex items-center gap-2 mb-3">
                <MaterialIcon name="star" className="text-amber-300 !text-base" />
                <span className="text-white font-black text-sm">{vet.rating.toFixed(1)}</span>
                {vet.user_ratings_total && (
                  <span className="text-white/70 text-xs">({vet.user_ratings_total} reseñas)</span>
                )}
              </div>
            )}

            {/* Open/Closed chip */}
            {vet.opening_hours && (
              <span className={`text-xs font-black px-3 py-1 rounded-full ${
                vet.opening_hours.open_now
                  ? "bg-[#D1FAE5] text-[#065F46]"
                  : "bg-red-100 text-red-700"
              }`}>
                {vet.opening_hours.open_now ? "Abierto ahora" : "Cerrado"}
              </span>
            )}
          </div>

          <div className="px-4 py-5 space-y-4">

            {/* Info card */}
            <div className="bg-white rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 font-['Plus_Jakarta_Sans',sans-serif]">
                Información
              </h3>

              {/* Address */}
              <div className="flex items-start gap-3 min-h-[44px]">
                <div className="size-8 rounded-full bg-[#E0F2F1] flex items-center justify-center shrink-0 mt-0.5">
                  <MaterialIcon name="place" className="text-[#1A9B7D] !text-sm" />
                </div>
                <div className="flex-1 py-1">
                  <p className="text-xs font-black text-slate-500 mb-0.5">Dirección</p>
                  <p className="text-sm text-slate-800">{vet.vicinity || "No disponible"}</p>
                </div>
              </div>

              {/* Distance */}
              {vet.distance !== undefined && (
                <div className="flex items-center gap-3 min-h-[44px]">
                  <div className="size-8 rounded-full bg-[#E0F2F1] flex items-center justify-center shrink-0">
                    <MaterialIcon name="near_me" className="text-[#1A9B7D] !text-sm" />
                  </div>
                  <div className="flex-1 py-1">
                    <p className="text-xs font-black text-slate-500 mb-0.5">Distancia</p>
                    <p className="text-sm text-slate-800">
                      {vet.distance < 1
                        ? `${Math.round(vet.distance * 1000)} m`
                        : `${vet.distance.toFixed(1)} km`}
                    </p>
                  </div>
                </div>
              )}

              {/* Phone */}
              {vet.phone && (
                <a
                  href={`tel:${vet.phone.replace(/[\s\-().]/g, "")}`}
                  className="flex items-center gap-3 min-h-[44px] active:opacity-70 transition-opacity"
                >
                  <div className="size-8 rounded-full bg-[#E0F2F1] flex items-center justify-center shrink-0">
                    <MaterialIcon name="phone" className="text-[#1A9B7D] !text-sm" />
                  </div>
                  <div className="flex-1 py-1">
                    <p className="text-xs font-black text-slate-500 mb-0.5">Teléfono</p>
                    <p className="text-sm font-bold text-[#1A9B7D]">{vet.phone}</p>
                  </div>
                  <MaterialIcon name="chevron_right" className="text-slate-300 !text-lg shrink-0" />
                </a>
              )}

              {/* Website */}
              {vet.website && (
                <a
                  href={vet.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 min-h-[44px] active:opacity-70 transition-opacity"
                >
                  <div className="size-8 rounded-full bg-[#E0F2F1] flex items-center justify-center shrink-0">
                    <MaterialIcon name="language" className="text-[#1A9B7D] !text-sm" />
                  </div>
                  <div className="flex-1 py-1">
                    <p className="text-xs font-black text-slate-500 mb-0.5">Sitio web</p>
                    <p className="text-sm font-bold text-[#1A9B7D] truncate max-w-[200px]">
                      {vet.website.replace(/^https?:\/\/(www\.)?/, "")}
                    </p>
                  </div>
                  <MaterialIcon name="open_in_new" className="text-slate-300 !text-sm shrink-0" />
                </a>
              )}
            </div>

            {/* Horarios card */}
            <div className="bg-white rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 font-['Plus_Jakarta_Sans',sans-serif]">
                Horarios
              </h3>

              {vet.detailsLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                  <div className="size-3 border border-slate-300 border-t-[#1A9B7D] rounded-full animate-spin" />
                  Cargando horarios...
                </div>
              )}

              {!vet.detailsLoading && vet.weekday_text && vet.weekday_text.length > 0 ? (
                <div className="space-y-1.5">
                  {vet.weekday_text.map((line, i) => {
                    const [day, ...rest] = line.split(": ");
                    const hours = rest.join(": ");
                    return (
                      <div key={i} className="flex items-baseline justify-between gap-2 py-0.5">
                        <span className="text-xs font-bold text-slate-700 shrink-0">{day}</span>
                        <span className="text-xs text-slate-500 text-right">{hours || line}</span>
                      </div>
                    );
                  })}
                </div>
              ) : !vet.detailsLoading ? (
                <p className="text-sm text-slate-400 py-2">Horarios no disponibles</p>
              ) : null}
            </div>

          </div>
        </div>

        {/* Sticky CTA bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200 px-4 py-4 flex gap-3 max-w-md mx-auto">
          <button
            onClick={openInMaps}
            className="flex-1 py-3.5 rounded-[14px] border-2 border-[#074738] text-[#074738] font-black text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
          >
            <MaterialIcon name="map" className="!text-base" />
            Ver en Maps
          </button>
          {onBookAppointment && (
            <button
              onClick={() => onBookAppointment(vet.name, vet.name)}
              className="flex-1 py-3.5 rounded-[14px] bg-[#074738] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#074738]/25 active:scale-[0.97] transition-all"
            >
              <MaterialIcon name="calendar_add_on" className="!text-base" />
              Agendar turno
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
