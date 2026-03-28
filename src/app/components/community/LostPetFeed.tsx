/**
 * LostPetFeed — Feed de mascotas perdidas cercanas
 *
 * Muestra mascotas perdidas en la zona ordenadas por cercanía y recencia.
 * Cada card muestra foto, nombre, raza, distancia y tiempo desde que se perdió.
 */

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { MaterialIcon } from "../shared/MaterialIcon";
import type { LostPetReport } from "../../../domain/community/lostPet.contract";
import { distanceKm, type PessyGeoPoint } from "../../../domain/community/lostPet.contract";

interface Props {
  onReport: () => void;
  onBack: () => void;
}

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

export function LostPetFeed({ onReport, onBack }: Props) {
  const [reports, setReports] = useState<LostPetReport[]>([]);
  const [userLocation, setUserLocation] = useState<PessyGeoPoint | null>(null);
  const [loading, setLoading] = useState(true);

  // Get user location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setUserLocation(null),
    );
  }, []);

  // Fetch active lost pet reports
  useEffect(() => {
    const q = query(
      collection(db, "lost_pets"),
      where("status", "==", "active"),
      orderBy("reportedAt", "desc"),
      limit(20),
    );
    getDocs(q).then((snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LostPetReport);
      setReports(data);
      setLoading(false);
    }).catch((err) => {
      console.error("LostPetFeed:", err);
      setLoading(false);
    });
  }, []);

  const sorted = userLocation
    ? [...reports].sort((a, b) =>
        distanceKm(userLocation, a.lastSeenLocation) - distanceKm(userLocation, b.lastSeenLocation)
      )
    : reports;

  return (
    <div className="min-h-screen bg-[#F0FAF9] dark:bg-[#101622]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="size-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" style={{ transition: "background 150ms ease" }}>
          <MaterialIcon name="arrow_back" className="text-[#074738] dark:text-emerald-400" />
        </button>
        <h1 className="text-lg font-bold text-[#074738] dark:text-white flex-1">Mascotas perdidas</h1>
        <button onClick={onReport} className="h-[44px] px-4 rounded-2xl bg-[#1A9B7D] text-white text-sm font-semibold flex items-center gap-2" style={{ transition: "opacity 150ms ease" }}>
          <MaterialIcon name="add_alert" className="text-lg" />
          Reportar
        </button>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="size-8 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12">
            <MaterialIcon name="pets" className="text-5xl text-[#1A9B7D]/30 mb-3" />
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No hay reportes en tu zona</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">¡Buena noticia! Todas las mascotas están a salvo.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sorted.map((r) => {
              const dist = userLocation ? distanceKm(userLocation, r.lastSeenLocation) : null;
              const ago = r.reportedAt?.toDate ? timeAgo(r.reportedAt.toDate()) : "";
              const statusBg = r.reportType === "encontrado" ? "bg-amber-100 dark:bg-amber-900/20" : r.reportType === "reunido" ? "bg-emerald-100 dark:bg-emerald-900/20" : "bg-red-100 dark:bg-red-900/20";
              const statusText = r.reportType === "encontrado" ? "text-amber-700 dark:text-amber-200" : r.reportType === "reunido" ? "text-emerald-700 dark:text-emerald-200" : "text-red-700 dark:text-red-200";
              const statusLabel = r.reportType === "encontrado" ? "Encontrado" : r.reportType === "reunido" ? "Reunido" : "Perdido";

              return (
                <div key={r.id} className="bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-800 overflow-hidden" style={{ boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)" }}>
                  {/* Photo with status badge */}
                  {r.petSnapshot.photoUrls[0] ? (
                    <div className="relative w-full h-40 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <img src={r.petSnapshot.photoUrls[0]} alt={r.petSnapshot.name} className="w-full h-full object-cover" />
                      <div className={`absolute top-2 right-2 ${statusBg} ${statusText} text-xs font-semibold px-2.5 py-1 rounded-full`}>
                        {statusLabel}
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full h-40 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <MaterialIcon name="pets" className="text-4xl text-slate-400" />
                      <div className={`absolute top-2 right-2 ${statusBg} ${statusText} text-xs font-semibold px-2.5 py-1 rounded-full`}>
                        {statusLabel}
                      </div>
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-[#074738] dark:text-white text-lg">{r.petSnapshot.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{r.petSnapshot.breed} · {r.petSnapshot.size}</p>
                      </div>
                    </div>

                    {/* Location & time */}
                    <div className="flex items-center gap-3 mb-3 text-xs">
                      <span className="text-[#1A9B7D] font-medium flex items-center gap-1">
                        <MaterialIcon name="location_on" className="text-sm" />
                        {dist !== null ? `${dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}` : r.lastSeenAddress}
                      </span>
                      <span className="text-slate-400">{ago}</span>
                      {r.sightingCount > 0 && (
                        <span className="text-amber-600 font-medium flex items-center gap-0.5">
                          <MaterialIcon name="visibility" className="text-sm" />
                          {r.sightingCount}
                        </span>
                      )}
                    </div>

                    {/* Distinctive features */}
                    {r.petSnapshot.distinctiveFeatures && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                        Características: {r.petSnapshot.distinctiveFeatures}
                      </p>
                    )}

                    {/* Contact info */}
                    {r.contactPhone && (
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                        <MaterialIcon name="phone" className="text-[#1A9B7D] text-sm" />
                        <a href={`tel:${r.contactPhone}`} className="text-xs text-[#1A9B7D] font-medium hover:underline">
                          {r.contactPhone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
