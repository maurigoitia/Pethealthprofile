/**
 * AdoptionFeed — Feed de mascotas para adoptar
 *
 * Muestra mascotas disponibles para adopción ordenadas por cercanía y recencia.
 * Cada card muestra fotos, nombre, raza, edad, tamaño, ubicación.
 */

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { MaterialIcon } from "../shared/MaterialIcon";
import type { AdoptionListing } from "../../../domain/community/adoption.contract";
import { distanceKm, type PessyGeoPoint } from "../../../domain/community/lostPet.contract";

interface Props {
  onPublish: () => void;
  onBack: () => void;
  onSelect?: (listing: AdoptionListing) => void;
}

function sizeLabel(size: string): string {
  const labels: Record<string, string> = {
    small: "Pequeño",
    medium: "Mediano",
    large: "Grande",
  };
  return labels[size] || size;
}

function energyLabel(energy: string): string {
  const labels: Record<string, string> = {
    low: "Tranquilo",
    medium: "Moderado",
    high: "Energético",
  };
  return labels[energy] || energy;
}

export function AdoptionFeed({ onPublish, onBack, onSelect }: Props) {
  const [listings, setListings] = useState<AdoptionListing[]>([]);
  const [userLocation, setUserLocation] = useState<PessyGeoPoint | null>(null);
  const [loading, setLoading] = useState(true);

  // Get user location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setUserLocation(null),
    );
  }, []);

  // Fetch active adoption listings
  useEffect(() => {
    const q = query(
      collection(db, "adoption_listings"),
      where("status", "==", "active"),
      orderBy("publishedAt", "desc"),
      limit(30),
    );
    getDocs(q)
      .then((snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdoptionListing);
        setListings(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("AdoptionFeed:", err);
        setLoading(false);
      });
  }, []);

  const sorted = userLocation
    ? [...listings].sort((a, b) =>
        distanceKm(userLocation, a.location) - distanceKm(userLocation, b.location)
      )
    : listings;

  return (
    <div className="min-h-screen bg-[#F0FAF9] dark:bg-[#101622]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="size-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          style={{ transition: "background 150ms ease" }}
        >
          <MaterialIcon name="arrow_back" className="text-[#074738] dark:text-emerald-400" />
        </button>
        <h1 className="text-lg font-bold text-[#074738] dark:text-white flex-1">Adoptar</h1>
        <button
          onClick={onPublish}
          className="h-[44px] px-4 rounded-2xl bg-[#1A9B7D] text-white text-sm font-semibold flex items-center gap-2"
          style={{ transition: "opacity 150ms ease" }}
        >
          <MaterialIcon name="add" className="text-lg" />
          Publicar
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
            <MaterialIcon name="favorite_outline" className="text-5xl text-[#1A9B7D]/30 mb-3" />
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Sin mascotas disponibles</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Vuelve pronto para ver nuevas mascotas para adoptar
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sorted.map((listing) => {
              const dist = userLocation ? distanceKm(userLocation, listing.location) : null;
              const pet = listing.petProfile;
              const primaryPhoto = pet.photoUrls[0];

              return (
                <button
                  key={listing.id}
                  onClick={() => onSelect?.(listing)}
                  className="bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-md transition-all"
                  style={{ boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)" }}
                >
                  {/* Photo */}
                  {primaryPhoto ? (
                    <div className="relative w-full h-40 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <img src={primaryPhoto} alt={pet.name} className="w-full h-full object-cover" />
                      {listing.publisherType === "shelter" && (
                        <div className="absolute top-2 right-2 bg-[#1A9B7D] text-white text-xs font-semibold px-2 py-1 rounded-full">
                          Refugio
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-40 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <MaterialIcon name="pets" className="text-4xl text-slate-400" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-[#074738] dark:text-white text-lg">{pet.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {pet.breed} · {pet.age} meses
                        </p>
                      </div>
                      {pet.species === "dog" ? (
                        <MaterialIcon name="pets" className="text-[#1A9B7D] text-xl" />
                      ) : (
                        <MaterialIcon name="favorite" className="text-[#E67E7E] text-xl" />
                      )}
                    </div>

                    {/* Characteristics */}
                    <div className="flex gap-2 mb-3 flex-wrap">
                      <span className="text-xs bg-[#E0F2F1] dark:bg-emerald-900/30 text-[#074738] dark:text-emerald-200 px-2.5 py-1 rounded-full font-medium">
                        {sizeLabel(pet.size)}
                      </span>
                      <span className="text-xs bg-[#E0F2F1] dark:bg-emerald-900/30 text-[#074738] dark:text-emerald-200 px-2.5 py-1 rounded-full font-medium">
                        {energyLabel(pet.energyLevel)}
                      </span>
                    </div>

                    {/* Temperament */}
                    {pet.temperament.length > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        {pet.temperament.slice(0, 2).join(", ")}
                      </p>
                    )}

                    {/* Location & distance */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1 text-xs text-[#1A9B7D] font-medium">
                        <MaterialIcon name="location_on" className="text-sm" />
                        {dist !== null ? `${dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}` : listing.address}
                      </div>
                      <MaterialIcon name="arrow_forward" className="text-slate-400 text-sm" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
