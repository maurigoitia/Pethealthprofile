import React from "react";
import { Bell } from "lucide-react";
import { PetPhoto } from "./PetPhoto";

interface Props {
  petName: string;
  petBreed?: string | null;
  petPhoto?: string | null;
  notificationCount?: number;
  pointsTotal?: number;
  onBellClick?: () => void;
}

/**
 * HomeHeaderV2 — Pessy App v2
 * Header compacto: avatar circular 48px + nombre/breed + bell con badge.
 * Reemplaza el hero 220px con foto full-width.
 */
export function HomeHeaderV2({
  petName,
  petBreed,
  petPhoto,
  notificationCount = 0,
  pointsTotal,
  onBellClick,
}: Props) {
  return (
    <div className="flex items-center justify-between px-[18px] pt-1">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-12 h-12 rounded-full border-[2.5px] border-white shrink-0 overflow-hidden bg-[#E0F2F1] flex items-center justify-center"
          style={{ boxShadow: "0 2px 8px rgba(7,71,56,0.1)" }}
        >
          <PetPhoto
            src={petPhoto || null}
            alt={petName}
            className="w-full h-full object-cover"
            fallbackClassName="!rounded-none !w-full !h-full"
          />
        </div>
        <div className="min-w-0">
          <div
            className="text-[15px] font-[800] text-[#074738] truncate"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.025em" }}
          >
            {petName}
          </div>
          {petBreed && (
            <div className="text-[11px] text-[#6B7280] font-medium truncate">{petBreed}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
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
          <Bell size={20} strokeWidth={2} />
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
    </div>
  );
}
