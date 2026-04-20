import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { ChevronLeft, ShieldCheck, Phone, CalendarPlus, Star } from "lucide-react";
import { db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface VetDoctorProfileProps {
  onBack: () => void;
}

interface VetData {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  reviews: number;
  experience: number;
  patients: number;
  distance: string;
  verified: boolean;
}

const SPECIALTIES_LIST = [
  "Clínica general",
  "Vacunación",
  "Cirugía menor",
  "Dermatología",
  "Nutrición",
];

const BIO =
  "Médico veterinario con especialización en pequeños animales. Atiendo con turnos y urgencias. Comprometido con el bienestar animal y la tranquilidad de las familias.";

const HORARIOS = [
  { days: "Lun–Vie", hours: "9:00–18:00" },
  { days: "Sábados", hours: "9:00–13:00" },
  { days: "Domingos", hours: "Cerrado" },
];

function SectionHeader({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
      {children}
    </p>
  );
}

export default function VetDoctorProfile({ onBack }: VetDoctorProfileProps) {
  const { vetId } = useParams<{ vetId: string }>();
  const navigate = useNavigate();
  const [vet, setVet] = useState<VetData | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const MOCK_VET: VetData = {
    id: vetId ?? "1",
    name: "Dra. María González",
    specialty: "Clínica General · Pequeños Animales",
    rating: 4.8,
    reviews: 124,
    experience: 8,
    patients: 320,
    distance: "10km",
    verified: true,
  };

  useEffect(() => {
    if (!vetId) {
      setVet(MOCK_VET);
      return;
    }
    getDoc(doc(db, "vetProfiles", vetId))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<VetData, "id">;
          setVet({ id: snap.id, ...data });
        } else {
          setVet(MOCK_VET);
        }
      })
      .catch(() => setVet(MOCK_VET));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vetId]);

  function handleBack() {
    onBack();
    navigate(-1);
  }

  function showToast() {
    setToastMsg("Próximamente disponible");
    setTimeout(() => setToastMsg(null), 2000);
  }

  if (!vet) {
    return (
      <div className="min-h-screen bg-[#F0FAF9] flex items-center justify-center">
        <div className="size-10 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#F0FAF9] pb-28"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      {/* ── HERO ── */}
      <div className="relative h-48 bg-gradient-to-br from-[#074738] to-[#1A9B7D]">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Volver"
          className="absolute top-4 left-4 size-10 rounded-full bg-white/20 flex items-center justify-center active:scale-[0.97] transition-transform"
        >
          <ChevronLeft size={20} color="white" />
        </button>
      </div>

      {/* Avatar overlapping hero */}
      <div className="-mt-12 mx-auto size-24 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center w-24">
        <span
          className="text-2xl font-black text-[#074738]"
          style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
        >
          {vet.name
            .split(" ")
            .filter((w) => w.length > 0)
            .slice(0, 2)
            .map((w) => w[0].toUpperCase())
            .join("")}
        </span>
      </div>

      {/* ── PROFILE CARD ── */}
      <div className="mx-4 bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-5 mt-3">
        <p
          className="font-bold text-xl text-[#074738] text-center"
          style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
        >
          {vet.name}
        </p>
        <p className="text-sm text-[#1A9B7D] font-semibold mt-0.5 text-center">
          {vet.specialty}
        </p>

        {/* Stars */}
        <div className="flex items-center justify-center gap-1 mt-2">
          <Star size={14} fill="#F59E0B" color="#F59E0B" className="text-amber-500" />
          <span className="font-bold text-sm text-slate-800">{vet.rating}</span>
          <span className="text-xs text-slate-400">({vet.reviews} reseñas)</span>
        </div>

        {/* Stat chips */}
        <div className="flex gap-2 mt-4">
          {[
            { value: `${vet.experience} años`, label: "Exp." },
            { value: String(vet.patients), label: "Pacientes" },
            { value: vet.distance, label: "Distancia" },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="flex-1 bg-[#E0F2F1] rounded-[10px] px-3 py-2 text-center"
            >
              <p
                className="text-sm font-bold text-[#074738]"
                style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
              >
                {value}
              </p>
              <p className="text-[10px] text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Verified */}
        {vet.verified && (
          <div className="flex items-center gap-1.5 mt-4 justify-center">
            <span className="bg-[#EEEDF9] text-[#5048CA] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck size={12} color="#5048CA" />
              Verificado ✓
            </span>
          </div>
        )}
      </div>

      {/* ── SOBRE MÍ ── */}
      <div className="mt-6 px-4">
        <SectionHeader>Sobre mí</SectionHeader>
        <p className="text-sm text-slate-600 leading-relaxed">{BIO}</p>
      </div>

      {/* ── ESPECIALIDADES ── */}
      <div className="mt-4 px-4">
        <SectionHeader>Especialidades</SectionHeader>
        <div className="flex flex-wrap gap-2">
          {SPECIALTIES_LIST.map((s) => (
            <span
              key={s}
              className="bg-[#E0F2F1] text-[#074738] text-xs font-semibold px-3 py-1.5 rounded-full"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* ── HORARIOS ── */}
      <div className="mt-6 px-4">
        <SectionHeader>Horarios</SectionHeader>
        {HORARIOS.map(({ days, hours }) => (
          <div
            key={days}
            className="flex justify-between py-2 border-b border-slate-100 text-sm"
          >
            <span className="text-slate-700 font-medium">{days}</span>
            <span className={hours === "Cerrado" ? "text-slate-400" : "text-slate-600"}>
              {hours}
            </span>
          </div>
        ))}
      </div>

      {/* ── TOAST ── */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#074738] text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg">
          {toastMsg}
        </div>
      )}

      {/* ── CTA STICKY ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-3 flex gap-3">
        <button
          type="button"
          onClick={showToast}
          className="flex-1 flex items-center justify-center gap-2 border border-[#074738] text-[#074738] rounded-[14px] py-3 font-semibold text-sm active:scale-[0.97] transition-transform"
        >
          <Phone size={16} />
          Llamar
        </button>
        <button
          type="button"
          onClick={showToast}
          className="flex-1 flex items-center justify-center gap-2 bg-[#074738] text-white rounded-[14px] py-3 font-semibold text-sm shadow-[0_4px_12px_rgba(7,71,56,0.25)] active:scale-[0.97] transition-transform"
        >
          <CalendarPlus size={16} />
          Agendar turno
        </button>
      </div>
    </div>
  );
}
