import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Search, Star, MapPin, ShieldCheck, Stethoscope } from "lucide-react";
import { db } from "../../../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

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

const MOCK_VETS: VetProfile[] = [
  { id: "v1", fullName: "Dra. Laura Gómez", specialty: "Clínica general", matricula: "MV-4521", verified: true, rating: 4.9, distanceKm: 0.8, patientsCount: 48 },
  { id: "v2", fullName: "Dr. Martín Sosa", specialty: "Cardiología", matricula: "MV-3312", verified: true, rating: 4.7, distanceKm: 1.4, patientsCount: 32 },
  { id: "v3", fullName: "Dra. Ana Beltrán", specialty: "Dermatología", matricula: "MV-5891", verified: false, rating: 4.5, distanceKm: 2.1, patientsCount: 19 },
  { id: "v4", fullName: "Dr. Carlos Ruiz", specialty: "Cirugía", matricula: "MV-2278", verified: true, rating: 4.8, distanceKm: 3.5, patientsCount: 67 },
];

const SPECIALTIES = ["Todos", "Clínica general", "Cardiología", "Dermatología", "Nutrición", "Cirugía"];

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

export function VetSearchScreen({ onBack }: VetSearchScreenProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSpecialty, setActiveSpecialty] = useState("Todos");
  const [vets, setVets] = useState<VetProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVets() {
      try {
        const q = query(collection(db, "vetProfiles"), where("verified", "==", true));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          setVets(MOCK_VETS);
        } else {
          const data: VetProfile[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<VetProfile, "id">),
          }));
          setVets(data);
        }
      } catch {
        setVets(MOCK_VETS);
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

  return (
    <div
      className="min-h-screen bg-[#F0FAF9]"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-[#F0FAF9]/80 backdrop-blur-md px-4 pt-4 pb-3">
        {/* Title row */}
        <div className="flex items-center mb-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 transition-all active:scale-[0.97] shrink-0"
            aria-label="Volver"
          >
            <ArrowLeft size={18} color="#074738" />
          </button>
          <h1
            className="flex-1 text-center text-[18px] font-bold text-[#074738]"
            style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            Veterinarios
          </h1>
          {/* Spacer to balance title */}
          <div className="w-10" />
        </div>

        {/* Search input */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Search size={16} className="text-slate-400" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o especialidad…"
            className="w-full rounded-[12px] border-[1.5px] border-[#E5E7EB] bg-white pl-9 pr-4 py-3 text-sm placeholder:text-slate-400 focus:border-[#1A9B7D] focus:outline-none transition-colors"
            style={{ fontFamily: "Manrope, sans-serif" }}
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {SPECIALTIES.map((specialty) => {
            const isActive = activeSpecialty === specialty;
            return (
              <button
                key={specialty}
                onClick={() => setActiveSpecialty(specialty)}
                className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wide transition-all active:scale-[0.97] ${
                  isActive
                    ? "bg-[#074738] text-white"
                    : "bg-white text-slate-500 border border-slate-200"
                }`}
              >
                {specialty}
              </button>
            );
          })}
        </div>
      </div>

      {/* VET LIST */}
      <div className="px-4 mt-4 pb-8 space-y-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filteredVets.length === 0 ? (
          <EmptyState query={searchQuery} />
        ) : (
          filteredVets.map((vet) => (
            <div
              key={vet.id}
              className="bg-white rounded-[16px] p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              {/* Main row */}
              <div className="flex items-start">
                {/* Photo / initials */}
                {vet.photoUrl ? (
                  <img
                    src={vet.photoUrl}
                    alt={vet.fullName}
                    className="w-14 h-14 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[#E0F2F1] flex items-center justify-center shrink-0">
                    <span
                      className="text-[#074738] font-black text-sm"
                      style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
                    >
                      {getInitials(vet.fullName)}
                    </span>
                  </div>
                )}

                {/* Center info */}
                <div className="flex-1 ml-3 min-w-0">
                  <p
                    className="font-bold text-slate-900 text-sm leading-tight"
                    style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
                  >
                    {vet.fullName}
                  </p>
                  <span className="inline-block mt-1 text-[10px] font-black text-[#1A9B7D] bg-[#E0F2F1] px-2 py-0.5 rounded-full">
                    {vet.specialty}
                  </span>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                      <Star size={11} fill="#F59E0B" color="#F59E0B" />
                      {vet.rating.toFixed(1)}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <MapPin size={11} />
                      {vet.distanceKm < 1
                        ? `${Math.round(vet.distanceKm * 1000)} m`
                        : `${vet.distanceKm.toFixed(1)} km`}
                    </span>
                  </div>
                </div>

                {/* Verified badge */}
                {vet.verified && (
                  <div className="shrink-0 ml-2 mt-0.5">
                    <ShieldCheck size={16} color="#1A9B7D" />
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => navigate(`/vet/${vet.id}`)}
                  className="flex-1 border border-[#074738] text-[#074738] rounded-[10px] py-2 text-[11px] font-bold transition-all active:scale-[0.97]"
                >
                  Ver perfil
                </button>
                <button className="flex-1 bg-[#074738] text-white rounded-[10px] py-2 text-[11px] font-bold shadow-[0_2px_8px_rgba(7,71,56,0.2)] transition-all active:scale-[0.97]">
                  Agendar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
