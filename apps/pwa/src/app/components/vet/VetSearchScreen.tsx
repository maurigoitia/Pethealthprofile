import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Search, Star, MapPin, Stethoscope, RefreshCw, Phone, Mail, Hash } from "lucide-react";
import { db, functions } from "../../../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useExtractedVets, ExtractedVet } from "../../hooks/useExtractedVets";
import { usePet } from "../../contexts/PetContext";
import { NearbyVetsFromMaps } from "./NearbyVetsFromMaps";

interface VetSearchScreenProps {
  onBack: () => void;
}

interface VetProfile {
  id: string;
  fullName: string;
  specialty: string;
  matricula: string;
  verified: boolean;
  rating: number;
  distanceKm: number;
  patientsCount: number;
  photoUrl?: string;
}

const SPECIALTIES = ["Todos", "Clínica general", "Cardiología", "Dermatología", "Nutrición", "Cirugía"];

const extractedFlagKey = (petId: string) => `pessy_vets_extracted_${petId}`;

function getInitials(fullName: string): string {
  return fullName
    .split(" ")
    .filter((w) => w.length > 0)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-[16px] p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-full bg-slate-100 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-100 rounded w-2/3" />
          <div className="h-3 bg-slate-100 rounded w-1/3" />
          <div className="h-3 bg-slate-100 rounded w-1/2" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <div className="h-8 bg-slate-100 rounded-[10px] flex-1" />
        <div className="h-8 bg-slate-100 rounded-[10px] flex-1" />
      </div>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  const mapsUrl = `https://www.google.com/maps/search/veterinaria${query ? `+${encodeURIComponent(query)}` : ""}`;
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#E0F2F1] flex items-center justify-center mb-4">
        <Stethoscope size={28} color="#1A9B7D" />
      </div>
      <p className="font-bold text-slate-700 text-sm" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
        {query ? `Sin resultados para "${query}"` : "Sin veterinarios disponibles"}
      </p>
      <p className="text-slate-400 text-xs mt-1 mb-5" style={{ fontFamily: "Manrope, sans-serif" }}>
        {query ? "Probá con otro nombre o especialidad" : "Todavía no hay vets verificados en tu zona"}
      </p>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-5 py-3 rounded-[14px] bg-[#074738] text-white text-sm font-bold active:scale-[0.97] transition-transform"
        style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
      >
        <MapPin size={15} />
        Buscar en Google Maps
      </a>
    </div>
  );
}

// ─── Card para vets extraídos de archivos ────────────────────────────────────
function ExtractedVetCard({ vet }: { vet: ExtractedVet }) {
  const initial = vet.name.replace(/^(Dr\.?|Dra\.?)\s*/i, "").trim().charAt(0).toUpperCase() || "V";
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: "14px 16px",
        boxShadow: "0 2px 8px rgba(0,0,0,.04)",
        border: "1px solid rgba(7,71,56,.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div
          style={{
            width: 40,
            height: 40,
            minWidth: 40,
            borderRadius: "50%",
            backgroundColor: "#E0F2F1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#074738",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 14,
              fontWeight: 700,
              color: "#0F172A",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {vet.name}
          </p>
          {vet.clinic && (
            <p style={{ fontSize: 12, color: "#64748B", marginTop: 1 }}>{vet.clinic}</p>
          )}
        </div>
        {vet.eventCount >= 2 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: "#1A9B7D",
              backgroundColor: "#E0F2F1",
              padding: "3px 8px",
              borderRadius: 999,
              whiteSpace: "nowrap",
            }}
          >
            Te atendió {vet.eventCount} veces
          </span>
        )}
      </div>
      {(vet.license || vet.phone || vet.email) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            paddingTop: 8,
            borderTop: "1px solid rgba(7,71,56,.06)",
          }}
        >
          {vet.license && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "#374151",
                fontWeight: 600,
                backgroundColor: "#F1F5F9",
                padding: "4px 8px",
                borderRadius: 8,
              }}
            >
              <Hash size={11} strokeWidth={2} color="#1A9B7D" />
              Mat. {vet.license}
            </span>
          )}
          {vet.phone && (
            <a
              href={`tel:${vet.phone}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "#074738",
                fontWeight: 600,
                backgroundColor: "#E0F2F1",
                padding: "4px 8px",
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              <Phone size={11} strokeWidth={2} />
              {vet.phone}
            </a>
          )}
          {vet.email && (
            <a
              href={`mailto:${vet.email}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "#074738",
                fontWeight: 600,
                backgroundColor: "#E0F2F1",
                padding: "4px 8px",
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              <Mail size={11} strokeWidth={2} />
              {vet.email}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sección "Tus veterinarios" ──────────────────────────────────────────────
function TreatingVetsSection({ petId, petName }: { petId: string | null; petName: string | null }) {
  const { vets, loading: vetsLoading } = useExtractedVets(petId);
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const runExtraction = useCallback(async () => {
    if (!petId) return;
    setExtracting(true);
    setExtractionError(null);
    try {
      const callable = httpsCallable<{ petId: string }, { processed: number; vetsFound: number; newlyAdded: number; alreadyExisting: number }>(
        functions,
        "extractVetsFromArchives",
      );
      await callable({ petId });
      try {
        localStorage.setItem(extractedFlagKey(petId), String(Date.now()));
      } catch {
        // localStorage no disponible (private mode) — no bloquea
      }
    } catch (err) {
      console.error("[VetSearch] extractVetsFromArchives failed:", err);
      setExtractionError("No pudimos actualizar la lista. Intentá de nuevo.");
    } finally {
      setExtracting(false);
    }
  }, [petId]);

  // Auto-trigger one-shot: primera vez que el user entra, si no hay flag
  useEffect(() => {
    if (!petId) return;
    let flag: string | null = null;
    try {
      flag = localStorage.getItem(extractedFlagKey(petId));
    } catch {
      flag = null;
    }
    if (!flag) {
      runExtraction();
    }
  }, [petId, runExtraction]);

  const handleManualRefresh = useCallback(() => {
    if (!petId) return;
    try {
      localStorage.removeItem(extractedFlagKey(petId));
    } catch {
      // ignore
    }
    runExtraction();
  }, [petId, runExtraction]);

  if (!petId) return null;

  // Decoupled rendering rules:
  // - The listener (useExtractedVets) is the source of truth for what shows
  //   on screen. The callable is a refresh trigger only — never a gate.
  // - On callable failure we degrade to an inline warning above the list,
  //   never to a blank screen or a hard error in place of content.
  // - When nothing has been extracted yet AND nothing is loading AND there
  //   is no error, we render an explicit empty state instead of hiding the
  //   whole section. The user should see why the list looks empty.
  const hasData = vets.length > 0;
  const isLoading = extracting || vetsLoading;
  const hasError = !!extractionError;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 10,
            fontWeight: 800,
            color: "#9CA3AF",
            textTransform: "uppercase",
            letterSpacing: ".1em",
          }}
        >
          {petName ? `Vets que trataron a ${petName}` : "Tus veterinarios"}
        </p>
        <button
          onClick={handleManualRefresh}
          disabled={extracting}
          className="flex items-center gap-1 text-[11px] font-bold text-[#1A9B7D] px-2 py-1 rounded-md active:scale-[0.97] transition-transform disabled:opacity-50"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          aria-label="Actualizar lista de veterinarios"
        >
          <RefreshCw size={12} strokeWidth={2.4} className={extracting ? "animate-spin" : ""} />
          {extracting ? "Actualizando…" : "Actualizar lista"}
        </button>
      </div>

      {hasError && (
        <div
          style={{
            fontSize: 11,
            color: "#92400E",
            background: "#FEF3C7",
            border: "1px solid #FCD34D",
            borderRadius: 8,
            padding: "6px 10px",
            marginBottom: 8,
          }}
          role="status"
        >
          {hasData
            ? "No pudimos actualizar contactos externos por ahora. Mostramos los profesionales detectados en el historial."
            : "No pudimos actualizar la lista. Cuando subas más documentos del vet, los nombres van a aparecer acá."}
        </div>
      )}

      {hasData && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {vets.map((v) => (
            <ExtractedVetCard key={v.id} vet={v} />
          ))}
        </div>
      )}

      {!hasData && isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!hasData && !isLoading && !hasError && (
        <p
          style={{
            fontSize: 12,
            color: "#6B7280",
            background: "#F9FAFB",
            border: "1px dashed #E5E7EB",
            borderRadius: 8,
            padding: "10px 12px",
            margin: 0,
          }}
        >
          Aún no detectamos veterinarios en el historial de tu mascota. A medida que cargues documentos, los profesionales y clínicas se van a listar acá.
        </p>
      )}
    </div>
  );
}

export function VetSearchScreen({ onBack }: VetSearchScreenProps) {
  const navigate = useNavigate();
  const { activePet } = usePet();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSpecialty, setActiveSpecialty] = useState("Todos");
  const [vets, setVets] = useState<VetProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVets() {
      try {
        const q = query(collection(db, "vetProfiles"), where("verified", "==", true));
        const snapshot = await getDocs(q);
        const data: VetProfile[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<VetProfile, "id">),
        }));
        setVets(data);
      } catch (err) {
        console.error("[VetSearch] fetch failed:", err);
        setVets([]);
      } finally {
        setLoading(false);
      }
    }
    fetchVets();
  }, []);

  const filteredVets = vets.filter((vet) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      vet.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vet.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpecialty =
      activeSpecialty === "Todos" ||
      vet.specialty.toLowerCase() === activeSpecialty.toLowerCase();
    return matchesSearch && matchesSpecialty;
  });

  const petName = activePet?.name || "tu mascota";
  const petPhoto = activePet?.photo || "/illustrations/dark_top_surprised_cork_head.svg";

  return (
    <div
      className="min-h-screen bg-[#F0FAF9]"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      {/* TopAppBar dark */}
      <div className="sticky top-0 z-40 bg-[#074738] px-6 py-4 h-20 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#1A9B7D] shrink-0 active:scale-95 transition-transform"
          aria-label="Volver"
        >
          <img
            src={petPhoto}
            alt={petName}
            className="w-full h-full object-cover"
          />
        </button>
        <h1
          className="flex-1 text-lg font-semibold text-[#E0F2F1] truncate"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          ¡Hola, {petName}!
        </h1>
        <button
          type="button"
          aria-label="Notificaciones"
          className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-transform"
        >
          <span
            className="material-symbols-outlined"
            style={{ color: "rgba(224,242,241,0.7)", fontSize: 24 }}
          >
            notifications
          </span>
        </button>
      </div>

      {/* Main */}
      <div className="max-w-md mx-auto px-4 pt-6">
        {/* Title block */}
        <h2
          className="text-[32px] font-bold text-[#074738] leading-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}
        >
          Explorar
        </h2>
        <p className="mt-1 text-[15px] text-[#6B7280] leading-relaxed">
          Veterinarios Pessy — Conocen el historial de {petName}
        </p>

        {/* Search + filter */}
        <div className="mt-5 flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <Search size={18} className="text-[#9CA3AF]" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar veterinarios…"
              className="w-full h-[52px] rounded-xl border border-[#E5E7EB] bg-white pl-12 pr-4 text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#1A9B7D] focus:border-[#1A9B7D] outline-none transition-all"
              style={{ fontFamily: "Manrope, sans-serif" }}
            />
          </div>
          <button
            type="button"
            aria-label="Filtros"
            className="w-[52px] h-[52px] rounded-xl bg-[#E0F2F1] flex items-center justify-center active:scale-95 transition-transform shrink-0"
          >
            <span
              className="material-symbols-outlined"
              style={{ color: "#074738", fontSize: 24 }}
            >
              tune
            </span>
          </button>
        </div>

        {/* Specialty chips */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {SPECIALTIES.map((specialty) => {
            const isActive = activeSpecialty === specialty;
            return (
              <button
                key={specialty}
                onClick={() => setActiveSpecialty(specialty)}
                className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wide transition-all active:scale-[0.97] ${
                  isActive
                    ? "bg-[#074738] text-white"
                    : "bg-white text-[#6B7280] border border-[#E5E7EB]"
                }`}
              >
                {specialty}
              </button>
            );
          })}
        </div>
      </div>

      {/* VET LIST */}
      <div className="max-w-md mx-auto px-4 mt-5 pb-10 space-y-3">
        {/* Tus veterinarios — extraídos de archivos procesados por IA.
            Auto-dispara la CF la primera vez; botón Actualizar lista siempre visible. */}
        <TreatingVetsSection
          petId={activePet?.id || null}
          petName={activePet?.name || null}
        />

        {/* Cerca tuyo — Fuente B: Google Places API (datos reales por geolocalización).
            Si no hay API key o se rechaza permiso, cae a link externo a Maps. */}
        <NearbyVetsFromMaps />

        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filteredVets.length === 0 ? (
          <EmptyState query={searchQuery} />
        ) : (
          <>
            <p
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 10,
                fontWeight: 800,
                color: "#9CA3AF",
                textTransform: "uppercase",
                letterSpacing: ".1em",
                marginBottom: 4,
                marginTop: 8,
              }}
            >
              Verificados en Pessy
            </p>
            {filteredVets.map((vet) => (
              <div
                key={vet.id}
                className="bg-white p-4 rounded-xl border border-[#E5E7EB]"
                style={{ boxShadow: "0px 4px 20px rgba(7,71,56,0.05)" }}
              >
                <div className="flex gap-4">
                  {/* Photo */}
                  {vet.photoUrl ? (
                    <img
                      src={vet.photoUrl}
                      alt={vet.fullName}
                      className="w-20 h-20 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-[#E0F2F1] flex items-center justify-center shrink-0">
                      <span
                        className="text-[#074738] font-black text-xl"
                        style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
                      >
                        {getInitials(vet.fullName)}
                      </span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3
                          className="text-xl font-bold text-[#074738] leading-tight truncate"
                          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          {vet.fullName}
                        </h3>
                        <p className="text-sm text-[#6B7280] mt-0.5 truncate">
                          {vet.specialty}
                        </p>
                      </div>
                      <div className="bg-[#F0FAF9] rounded-lg px-2 py-1 flex items-center gap-1 shrink-0">
                        <Star size={12} fill="#FFB800" color="#FFB800" />
                        <span
                          className="text-[12px] font-bold text-[#074738]"
                          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          {vet.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {vet.verified && (
                        <span
                          className="bg-[#1A9B7D]/10 text-[#1A9B7D] uppercase rounded-full px-2 py-0.5 font-bold tracking-wide"
                          style={{ fontSize: 10, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          Pessy Verified
                        </span>
                      )}
                      <span
                        className="bg-emerald-50 text-emerald-700 uppercase rounded-full px-2 py-0.5 font-bold tracking-wide"
                        style={{ fontSize: 10, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      >
                        Hoy disponible
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer: distance + agendar */}
                <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-[#E5E7EB]">
                  <span className="flex items-center gap-1 text-[12px] text-[#6B7280]">
                    <MapPin size={12} className="text-[#9CA3AF]" />
                    {vet.distanceKm < 1
                      ? `${Math.round(vet.distanceKm * 1000)} m`
                      : `${vet.distanceKm.toFixed(1)} km`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/vet/${vet.id}`)}
                      className="h-[44px] px-4 border border-[#074738] text-[#074738] rounded-xl text-[13px] font-bold active:scale-[0.97] transition-transform"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      Ver perfil
                    </button>
                    <button
                      className="h-[44px] px-5 bg-[#074738] text-white rounded-xl text-[13px] font-bold active:scale-[0.97] transition-transform"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      Agendar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
