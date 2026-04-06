import { useState, useEffect, useMemo } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { MascotPresence } from "../shared/MascotPresence";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";

type Category = {
  id: string;
  label: string;
  query: string;
  icon: string;
  emoji: string;
  urgent?: boolean; // auto-seleccionado por alerta activa
};

function buildCategories(species?: string, hasUrgentAlert?: boolean): Category[] {
  const isDog = !species || species === "dog";
  const isCat = species === "cat";

  const cats: Category[] = [
    {
      id: "veterinarias",
      label: "Veterinarias",
      query: isCat ? "veterinaria felina gatos" : isDog ? "veterinaria canina clínica veterinaria" : "veterinaria mascotas exóticas",
      icon: "local_hospital",
      emoji: "🏥",
      urgent: hasUrgentAlert,
    },
    {
      id: "grooming",
      label: "Grooming",
      query: isCat ? "grooming gatos peluquería felina" : "peluquería canina grooming perros",
      icon: "content_cut",
      emoji: "✂️",
    },
    {
      id: "tiendas",
      label: "Tiendas",
      query: isCat ? "tienda mascotas alimento gatos accesorios" : "tienda mascotas alimento perros pet shop",
      icon: "storefront",
      emoji: "🛍️",
    },
  ];

  // Categorías solo para perros
  if (isDog) {
    cats.splice(1, 0, {
      id: "parques",
      label: "Parques",
      query: "parque perros área canina",
      icon: "park",
      emoji: "🌳",
    });
    cats.push({
      id: "cafes",
      label: "Cafés",
      query: "café restaurante pet friendly perros",
      icon: "local_cafe",
      emoji: "☕",
    });
  }

  // Agregar "Comprar" al final para TODAS las especies
  cats.push({
    id: "comprar",
    label: "Comprar",
    query: isCat ? "tienda online productos gato" : "tienda online productos perro",
    icon: "shopping_bag",
    emoji: "🛒",
  });

  return cats;
}

export function RecommendationFeed({ onBack }: { onBack?: () => void }) {
  const { activePet, activePetId } = usePet();
  const { getClinicalAlertsByPetId } = useMedical();

  const species = activePet?.species;

  const hasUrgentAlert = useMemo(() => {
    if (!activePetId) return false;
    const alerts = getClinicalAlertsByPetId(activePetId).filter(a => a.status === "active");
    return alerts.some(a => a.severity === "high" || a.severity === "medium");
  }, [activePetId, getClinicalAlertsByPetId]);

  const CATEGORIES = useMemo(
    () => buildCategories(species, hasUrgentAlert),
    [species, hasUrgentAlert]
  );

  const defaultCategory = CATEGORIES.find(c => c.urgent) || CATEGORIES[0];
  const [selected, setSelected] = useState<Category>(defaultCategory);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<"loading" | "ready" | "denied" | "error">("loading");

  // Si cambia el pet o las alertas, actualizar la categoría seleccionada si hay urgencia
  useEffect(() => {
    if (hasUrgentAlert) {
      const urgentCat = CATEGORIES.find(c => c.id === "veterinarias");
      if (urgentCat) setSelected(urgentCat);
    }
  }, [hasUrgentAlert, CATEGORIES]);

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
            <p className="text-xs text-slate-500">
              {activePet?.name ? `Lugares para ${activePet.name} cerca tuyo` : "Lugares pet-friendly cerca tuyo"}
            </p>
            {/* Cork/Fizz contextual whisper */}
            <div className="mt-2 flex items-center gap-2">
              <MascotPresence species={species as "dog" | "cat"} size={18} ambient />
              <p className="text-[11px] text-[#074738]/60 font-medium">
                {selected.id === "veterinarias" && hasUrgentAlert
                  ? `${activePet?.name || "Tu mascota"} necesita atención — encontrá un vet abajo`
                  : selected.id === "veterinarias"
                  ? `Veterinarias a 5km de ${activePet?.name || "tu mascota"}`
                  : selected.id === "comprar"
                  ? `Productos directo en MercadoLibre`
                  : `Lugares pet-friendly cerca tuyo`}
              </p>
            </div>
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

      {/* Banner urgencia — Connection Rule */}
      {hasUrgentAlert && selected.id === "veterinarias" && (
        <div className="mx-4 mt-3 mb-1 bg-[#074738] rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MaterialIcon name="warning" className="text-amber-400 text-lg shrink-0" />
            <div>
              <p className="text-white text-xs font-black">Alerta activa — {activePet?.name || "tu mascota"} necesita atención</p>
              <p className="text-white/60 text-[11px] mt-0.5">Encontrá una veterinaria abajo y llamá directo</p>
            </div>
          </div>
          <a
            href={coords
              ? `https://www.google.com/maps/search/veterinaria/@${coords.lat},${coords.lng},14z`
              : "https://www.google.com/maps/search/veterinaria"}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 bg-[#1A9B7D] rounded-lg px-3 py-1.5"
          >
            <MaterialIcon name="phone" className="text-white text-sm" />
            <span className="text-white text-xs font-black">Llamar</span>
          </a>
        </div>
      )}

      {/* Map / Status area */}
      <div className="flex-1 relative min-h-[400px]">
        {/* Comprar section — when Comprar tab selected */}
        {selected.id === "comprar" && (
          <div className="absolute inset-0 overflow-y-auto px-4 py-4 z-10 bg-[#F0FAF9]">
            <p className="text-xs text-slate-500 font-medium mb-3">Búsquedas rápidas para {activePet?.name || "tu mascota"}:</p>
            {[
              { label: `Alimento ${species === "cat" ? "gatos" : "perros"}`, query: species === "cat" ? "alimento gato" : "alimento perro kibble" },
              { label: "Antipulgas y antiparasitarios", query: `antipulgas ${species === "cat" ? "gato" : "perro"}` },
              { label: "Juguetes", query: `juguetes ${species === "cat" ? "gato" : "perro"}` },
              { label: "Camas y accesorios", query: `cama accesorio ${species === "cat" ? "gato" : "perro"}` },
              { label: "Higiene y aseo", query: `shampoo higiene ${species === "cat" ? "gato" : "perro"}` },
            ].map((item) => (
              <a
                key={item.label}
                href={`https://listado.mercadolibre.com.ar/${encodeURIComponent(item.query)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-white rounded-xl px-4 py-3.5 mb-2 shadow-sm border border-slate-100 active:scale-[0.99]"
              >
                <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                <div className="flex items-center gap-1 text-[#1A9B7D]">
                  <span className="text-xs font-bold">Ver</span>
                  <MaterialIcon name="arrow_outward" className="text-sm" />
                </div>
              </a>
            ))}
            <p className="text-[10px] text-slate-400 text-center pt-2">Conectamos con MercadoLibre · Pessy no vende</p>
          </div>
        )}

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
