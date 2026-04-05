/**
 * FoundPetFeed — Feed of found pets near you
 *
 * Shows found pet reports sorted by proximity.
 * These are LEADS to reunite pets with owners, NOT adoption listings.
 */

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { MaterialIcon } from "../shared/MaterialIcon";

interface FoundPetReport {
  id: string;
  finderUserId: string;
  status: "active" | "resolved";
  photoUrl?: string | null;
  description?: string;
  foundAddress?: string;
  foundLocation?: { latitude: number; longitude: number } | null;
  foundAt?: { toDate: () => Date };
  hasCollar?: boolean | null;
  contactName?: string;
  contactPhone?: string;
  reportedAt?: { toDate: () => Date };
}

interface Props {
  onReport: () => void;
  onBack: () => void;
  hideHeader?: boolean;
}

function distKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371;
  const dLat = (b.latitude - a.latitude) * (Math.PI / 180);
  const dLng = (b.longitude - a.longitude) * (Math.PI / 180);
  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * (Math.PI / 180)) *
      Math.cos(b.latitude * (Math.PI / 180)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

export function FoundPetFeed({ onReport, onBack, hideHeader }: Props) {
  const [reports, setReports] = useState<FoundPetReport[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setUserLocation(null)
    );
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "found_pets"),
      where("status", "==", "active"),
      orderBy("reportedAt", "desc"),
      limit(20)
    );
    getDocs(q)
      .then((snap) => {
        setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FoundPetReport));
        setLoading(false);
      })
      .catch((err) => {
        console.error("FoundPetFeed:", err);
        setLoading(false);
      });
  }, []);

  const sorted = userLocation
    ? [...reports].sort((a, b) => {
        const dA = a.foundLocation ? distKm(userLocation, a.foundLocation) : 999;
        const dB = b.foundLocation ? distKm(userLocation, b.foundLocation) : 999;
        return dA - dB;
      })
    : reports;

  return (
    <div className="min-h-screen bg-[#F0FAF9] dark:bg-[#101622]">
      {!hideHeader && (
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="size-[44px] flex items-center justify-center rounded-full hover:bg-slate-100">
            <MaterialIcon name="arrow_back" className="text-[#074738] dark:text-emerald-400" />
          </button>
          <h1 className="text-lg font-bold text-[#074738] dark:text-white flex-1">Mascotas encontradas</h1>
          <button
            onClick={onReport}
            className="h-[44px] px-4 rounded-2xl bg-[#1A9B7D] text-white text-sm font-semibold flex items-center gap-2"
          >
            <MaterialIcon name="add" className="text-lg" />
            Encontré una
          </button>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-4">
        {/* Info banner */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 mb-4 flex gap-2.5">
          <MaterialIcon name="info" className="text-amber-600 text-lg flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            Estas mascotas fueron encontradas por personas que quieren ayudar a reunirlas con sus dueños. Si reconocés a tu mascota, contactá al finder.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="size-8 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12">
            <MaterialIcon name="location_searching" className="text-5xl text-[#1A9B7D]/30 mb-3" />
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No hay reportes en tu zona</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Si encontraste una mascota extraviada, reportala para ayudar a su dueño.
            </p>
            <button
              onClick={onReport}
              className="mt-4 px-5 py-3 rounded-2xl bg-[#1A9B7D] text-white font-bold text-sm"
            >
              Reportar mascota encontrada
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sorted.map((r) => {
              const dist = userLocation && r.foundLocation ? distKm(userLocation, r.foundLocation) : null;
              const ago = r.reportedAt?.toDate ? timeAgo(r.reportedAt.toDate()) : "";

              return (
                <div
                  key={r.id}
                  className="bg-white dark:bg-slate-900 rounded-[16px] border border-amber-200 dark:border-amber-800/40 overflow-hidden"
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                >
                  {/* Photo */}
                  {r.photoUrl ? (
                    <div className="relative w-full h-40 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <img src={r.photoUrl} alt="Mascota encontrada" className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        Encontrada
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full h-24 bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                      <MaterialIcon name="pets" className="text-4xl text-amber-400" />
                      <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        Encontrada
                      </div>
                    </div>
                  )}

                  <div className="p-4">
                    {/* Description */}
                    {r.description && (
                      <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 line-clamp-2">
                        {r.description}
                      </p>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {r.hasCollar === true && (
                        <span className="text-xs bg-[#E0F2F1] text-[#074738] px-2 py-0.5 rounded-full font-medium">Con collar</span>
                      )}
                      {r.hasCollar === false && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">Sin collar</span>
                      )}
                    </div>

                    {/* Location & time */}
                    <div className="flex items-center gap-3 mb-3 text-xs">
                      {r.foundAddress && (
                        <span className="text-[#1A9B7D] font-medium flex items-center gap-1 min-w-0 truncate">
                          <MaterialIcon name="location_on" className="text-sm shrink-0" />
                          {dist !== null ? (dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`) : r.foundAddress}
                        </span>
                      )}
                      <span className="text-slate-400 shrink-0">{ago}</span>
                    </div>

                    {/* Contact */}
                    {r.contactPhone && (
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-xs text-slate-500 mb-1.5">
                          {r.contactName ? `Contactar a ${r.contactName}:` : "Contacto:"}
                        </p>
                        <a
                          href={`tel:${r.contactPhone}`}
                          className="flex items-center gap-2 text-sm font-bold text-[#1A9B7D]"
                        >
                          <MaterialIcon name="phone" className="text-sm" />
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
