import React, { useRef, useState } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { PetPhoto } from "./PetPhoto";

interface PetLike {
  id: string;
  name: string;
  breed?: string | null;
  photo?: string | null;
}

interface Props {
  petName: string;
  petBreed?: string | null;
  petPhoto?: string | null;
  notificationCount?: number;
  pointsTotal?: number;
  onBellClick?: () => void;
  // Multi-pet swipe support (optional — backwards compatible)
  pets?: PetLike[];
  activePetId?: string;
  onPetChange?: (petId: string) => void;
}

/**
 * HomeHeaderV2 — Pessy App v2 (Épica 2A: presencia visual de la mascota)
 *
 * Hero compacto pero con presencia: avatar circular 128px centrado, nombre
 * grande, breed debajo, bell en esquina superior derecha. Si hay múltiples
 * mascotas, soporta swipe horizontal nativo (sin framer-motion) + chip
 * sutil "N de M" como indicador.
 */
export function HomeHeaderV2({
  petName,
  petBreed,
  petPhoto,
  notificationCount = 0,
  pointsTotal,
  onBellClick,
  pets,
  activePetId,
  onPetChange,
}: Props) {
  const hasMultiplePets = !!(pets && pets.length > 1 && activePetId && onPetChange);
  const totalPets = pets?.length ?? 0;
  const currentIndex = hasMultiplePets
    ? Math.max(0, pets!.findIndex((p) => p.id === activePetId))
    : 0;

  // Swipe state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const lockedAxis = useRef<"x" | "y" | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasMultiplePets) return;
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    lockedAxis.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!hasMultiplePets || touchStartX.current === null) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - (touchStartY.current ?? 0);

    // Lock axis on first significant movement
    if (lockedAxis.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        lockedAxis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
    }
    if (lockedAxis.current !== "x") return;

    // Friction for resistance feel
    setTranslateX(dx * 0.4);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!hasMultiplePets || touchStartX.current === null) {
      setIsDragging(false);
      setTranslateX(0);
      touchStartX.current = null;
      return;
    }
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (lockedAxis.current === "x" && Math.abs(dx) > 80) {
      const idx = currentIndex;
      const nextIdx =
        dx < 0
          ? (idx + 1) % totalPets
          : (idx - 1 + totalPets) % totalPets;
      onPetChange!(pets![nextIdx].id);
    }
    touchStartX.current = null;
    touchStartY.current = null;
    lockedAxis.current = null;
    setIsDragging(false);
    setTranslateX(0);
  };

  return (
    <div className="relative px-[18px] pt-1">
      {/* Bell + points (esquina superior derecha, fuera del área de swipe) */}
      <div className="absolute top-1 right-[18px] flex items-center gap-2 z-10">
        {typeof pointsTotal === "number" && pointsTotal > 0 && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-[800] text-[#074738] bg-white rounded-full px-2.5 py-1 border border-[rgba(7,71,56,0.08)]"
            style={{ boxShadow: "0 1px 3px rgba(7,71,56,0.04)" }}
          >
            <span className="text-[#F59E0B]">★</span>
            {pointsTotal}
          </span>
        )}
        <button
          type="button"
          onClick={onBellClick}
          aria-label={`Notificaciones${notificationCount > 0 ? ` (${notificationCount})` : ""}`}
          className="relative w-11 h-11 rounded-full bg-white border border-[rgba(7,71,56,0.08)] flex items-center justify-center text-[#074738] active:scale-[0.96] transition-transform"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
        >
          <MaterialIcon name="notifications" className="!text-[20px]" />
          {notificationCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-[#1A9B7D] text-white text-[9px] font-[800] flex items-center justify-center"
              style={{ border: "2px solid #F0FAF9", fontFamily: "'Manrope', sans-serif" }}
            >
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>
      </div>

      {/* Hero: avatar grande centrado + nombre + breed (zona de swipe) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="flex flex-col items-center pt-2 pb-1 select-none"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? "none" : "transform 220ms ease",
          touchAction: hasMultiplePets ? "pan-y" : "auto",
        }}
        aria-roledescription={hasMultiplePets ? "carousel" : undefined}
      >
        <div
          className="w-32 h-32 rounded-full border-[3px] border-white overflow-hidden bg-[#E0F2F1] flex items-center justify-center"
          style={{ boxShadow: "0 8px 24px rgba(7,71,56,0.18)" }}
        >
          <PetPhoto
            src={petPhoto || null}
            alt={petName}
            className="w-full h-full object-cover"
            fallbackClassName="!rounded-none !w-full !h-full"
          />
        </div>
        <div
          className="mt-3 text-[22px] font-[800] text-[#074738] text-center leading-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.025em" }}
        >
          {petName}
        </div>
        {petBreed && (
          <div
            className="text-[12px] text-[#6B7280] font-medium text-center mt-0.5"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            {petBreed}
          </div>
        )}

        {/* Chip sutil "N de M" — indicador de swipe disponible */}
        {hasMultiplePets && (
          <div className="mt-2 flex items-center gap-1.5">
            {pets!.map((p, i) => (
              <span
                key={p.id}
                className="block rounded-full transition-all"
                style={{
                  width: i === currentIndex ? 16 : 6,
                  height: 6,
                  backgroundColor: i === currentIndex ? "#1A9B7D" : "rgba(7,71,56,0.18)",
                }}
              />
            ))}
            <span
              className="ml-1.5 text-[10px] font-bold text-[#6B7280]"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              {currentIndex + 1} de {totalPets}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
