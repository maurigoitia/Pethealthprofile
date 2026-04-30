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
          <div className="flex flex-col gap-3">
            {sorted.map((r) => {
              const dist = userLocation ? distanceKm(userLocation, r.lastSeenLocation) : null;
              const ago = r.reportedAt?.toDate ? timeAgo(r.reportedAt.toDate()) : "";
              return (
                <div key={r.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex gap-3">
                  {/* Photo */}
                  <div className="size-16 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                    {r.petSnapshot.photoUrls[0] ? (
                      <img src={r.petSnapshot.photoUrls[0]} alt={r.petSnapshot.name} className="size-full object-cover" />
                    ) : (
                      <div className="size-full flex items-center justify-center">
                        <MaterialIcon name="pets" className="text-2xl text-slate-400" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#074738] dark:text-white text-base truncate">{r.petSnapshot.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{r.petSnapshot.breed} · {r.petSnapshot.size}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      {dist !== null && (
                        <span className="text-xs text-[#1A9B7D] font-medium flex items-center gap-0.5">
                          <MaterialIcon name="location_on" className="text-sm" />{dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{ago}</span>
                      {r.sightingCount > 0 && (
                        <span className="text-xs text-amber-600 font-medium flex items-center gap-0.5">
                          <MaterialIcon name="visibility" className="text-sm" />{r.sightingCount}
                        </span>
                      )}
                    </div>
                    {r.petSnapshot.distinctiveFeatures && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">"{r.petSnapshot.distinctiveFeatures}"</p>
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
