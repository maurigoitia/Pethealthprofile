/**
 * AdoptionFeed — feed de mascotas en adopción con matching score.
 *
 * Reglas firmes:
 * - Solo listings reales de Firestore `adoption_listings` con `status === "active"`
 * - Solo mostrar matches con score >= 40 (label != "incompatible")
 * - Si el user NO completó su `AdopterProfile`, mostrar CTA para configurarlo
 *   (sin matching, lista con score "?" hasta que complete)
 * - Empty state honesto si no hay listings activos
 *
 * Ruta: /comunidad/adoptar (a definir en routesV2)
 */
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { MaterialIcon } from "../shared/MaterialIcon";
import { ArrowLeft } from "lucide-react";
import type {
  AdoptionListing,
  AdopterProfile,
  MatchResult,
} from "../../../domain/community/adoption.contract";
import { computeMatchScore } from "../../../domain/community/adoptionMatcher";

interface Props {
  onBack?: () => void;
  /** Si el user ya completó su perfil de adoptante. Vacío = pedir setup. */
  adopter?: AdopterProfile;
}

export function AdoptionFeed({ onBack, adopter }: Props) {
  const [listings, setListings] = useState<AdoptionListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "adoption_listings"),
      where("status", "==", "active"),
      orderBy("publishedAt", "desc"),
      limit(40),
    );
    getDocs(q)
      .then((snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AdoptionListing, "id">),
        }));
        setListings(data);
      })
      .catch((err) => {
        console.warn("[AdoptionFeed] no se pudo cargar listings:", err?.message || err);
        setListings([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Compute score per listing (si hay adopter profile)
  const scoredListings = useMemo(() => {
    if (!adopter) {
      return listings.map((l) => ({ listing: l, match: null as MatchResult | null }));
    }
    return listings
      .map((l) => ({ listing: l, match: computeMatchScore(adopter, l.petProfile) }))
      .filter((x) => x.match!.totalScore >= 40)
      .sort((a, b) => (b.match?.totalScore || 0) - (a.match?.totalScore || 0));
  }, [listings, adopter]);

  return (
    <div
      className="min-h-screen bg-[#F0FAF9]"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      {/* Header sticky Stitch */}
      <div className="sticky top-0 z-40 bg-[#F0FAF9]/85 backdrop-blur-md px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-1">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Volver"
              className="size-11 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center active:scale-[0.96] transition-transform"
              style={{ boxShadow: "0 1px 3px rgba(7,71,56,0.04)" }}
            >
              <ArrowLeft size={18} color="#074738" />
            </button>
          )}
          <h1
            className="flex-1 text-[22px] font-extrabold text-[#074738] leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}
          >
            Adopciones
          </h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4">
        {/* Setup CTA si no hay adopter profile */}
        {!adopter && !loading && (
          <div className="rounded-[16px] bg-[#E0F2F1] border border-[#1A9B7D]/30 px-4 py-3.5 mb-4">
            <div className="flex items-start gap-3">
              <MaterialIcon name="info" className="text-[#1A9B7D] text-xl mt-0.5" />
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-extrabold text-[#074738]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Completá tu perfil de adoptante
                </p>
                <p
                  className="text-xs text-[#6B7280] mt-1 leading-snug"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  Decinos cómo es tu casa y tu rutina para mostrarte mejores matches.
                </p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="size-8 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
          </div>
        ) : scoredListings.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-24 h-24 rounded-full bg-[#E0F2F1] flex items-center justify-center mx-auto mb-5">
              <MaterialIcon name="favorite" className="text-5xl text-[#1A9B7D]" />
            </div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#1A9B7D]/10 border border-[#1A9B7D]/20 mb-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1A9B7D]">
                Adopciones
              </span>
            </div>
            <h2
              className="text-2xl font-extrabold text-[#074738] mb-2 leading-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {adopter ? "Sin matches por ahora" : "Pronto verás mascotas acá"}
            </h2>
            <p className="text-sm text-[#6B7280] max-w-[280px] mx-auto leading-relaxed">
              {adopter
                ? "Estamos sumando más listings cada día. Te avisamos cuando aparezca un match cerca tuyo."
                : "Acá vas a ver las mascotas en adopción cerca tuyo, ordenadas por compatibilidad."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {scoredListings.map(({ listing, match }) => (
              <article
                key={listing.id}
                className="bg-white rounded-[16px] border border-[rgba(7,71,56,0.08)] overflow-hidden"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
              >
                {/* Foto */}
                {listing.petProfile.photoUrls?.[0] && (
                  <div className="aspect-[4/3] bg-slate-100">
                    <img
                      src={listing.petProfile.photoUrls[0]}
                      alt={listing.petProfile.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h3
                      className="text-base font-extrabold text-[#074738] leading-tight"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      {listing.petProfile.name}
                    </h3>
                    {match && (
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          match.label === "excellent"
                            ? "bg-[#1A9B7D]/15 text-[#1A9B7D]"
                            : match.label === "good"
                              ? "bg-[#FEF3C7] text-[#92400E]"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {match.totalScore}% match
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7280] mb-2">
                    {[listing.petProfile.breed, listing.petProfile.size, `${listing.petProfile.age} meses`].filter(Boolean).join(" · ")}
                  </p>
                  {match?.reason && (
                    <p className="text-[12px] text-[#374151] leading-snug bg-[#F0FAF9] rounded-[10px] px-3 py-2">
                      {match.reason}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
