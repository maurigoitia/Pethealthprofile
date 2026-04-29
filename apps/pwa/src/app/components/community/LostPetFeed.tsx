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
    getDocs(q)
      .then((snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LostPetReport);
        setReports(data);
      })
      .catch((err) => {
        // Si falta index, permission, etc. → empty state honesto en vez de pantalla blanca
        console.warn("[LostPetFeed] no se pudo cargar reportes:", err?.message || err);
        setReports([]);
      })
      .finally(() => {
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
      <div className="sticky top-0 z-30 bg-[#F0FAF9]/85 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Volver"
          className="size-11 flex items-center justify-center rounded-full bg-white border border-[#E5E7EB] active:scale-[0.96] transition-transform"
          style={{ boxShadow: "0 1px 3px rgba(7,71,56,0.04)" }}
        >
          <MaterialIcon name="arrow_back" className="text-[#074738]" />
        </button>
        <h1
          className="text-lg font-extrabold text-[#074738] flex-1"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}
        >
          Mascotas perdidas
        </h1>
        <button
          onClick={onReport}
          className="h-11 px-4 rounded-full bg-[#1A9B7D] text-white text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 active:scale-[0.97] transition-transform shadow-[0_4px_14px_rgba(26,155,125,0.25)]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          <MaterialIcon name="add_alert" className="text-base" />
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
          <div className="text-center py-12 px-4">
            {/* Stitch-style empty state con illustration */}
            <div className="w-24 h-24 rounded-full bg-[#E0F2F1] flex items-center justify-center mx-auto mb-5">
              <MaterialIcon name="pets" className="text-5xl text-[#1A9B7D]" />
            </div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#1A9B7D]/10 border border-[#1A9B7D]/20 mb-4">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1A9B7D]"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Comunidad
              </span>
            </div>
            <h2
              className="text-2xl font-extrabold text-[#074738] mb-2 leading-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Todo en orden por acá
            </h2>
            <p
              className="text-sm text-[#6B7280] max-w-[280px] mx-auto leading-relaxed mb-6"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              No hay reportes activos en tu zona. Si encontrás o perdés una mascota, podés reportarlo.
            </p>
            <button
              type="button"
              onClick={onReport}
              className="px-6 py-3 rounded-full bg-[#074738] hover:bg-[#0e5c49] text-white text-sm font-bold shadow-[0_4px_14px_rgba(7,71,56,0.18)] active:scale-[0.97] transition-transform"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Reportar mascota perdida
            </button>
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
