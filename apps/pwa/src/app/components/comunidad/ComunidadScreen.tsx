import { useState, useEffect, useRef } from "react";
import { MapPin, MessageCircle } from "lucide-react";
import { db } from "../../../lib/firebase";
import { collection, getDocs, addDoc, query, orderBy } from "firebase/firestore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LostPet {
  id: string;
  name: string;
  breed: string;
  status: "perdido" | "encontrado";
  description: string;
  location: string;
  date: string;
  contact: string;
}

// ---------------------------------------------------------------------------
// Mock data (shown when Firestore is empty)
// ---------------------------------------------------------------------------

const MOCK: LostPet[] = [
  {
    id: "1",
    name: "Luna",
    breed: "Golden Retriever",
    status: "perdido",
    description: "Se escapó del jardín el martes por la tarde. Lleva collar azul.",
    location: "Palermo, CABA",
    date: "Hace 2 días",
    contact: "@luna_owner",
  },
  {
    id: "2",
    name: "Michi",
    breed: "Gato común",
    status: "encontrado",
    description: "Encontramos este gatito naranja cerca del parque. Muy manso.",
    location: "Belgrano, CABA",
    date: "Hace 1 día",
    contact: "@michi_found",
  },
  {
    id: "3",
    name: "Thor",
    breed: "Labrador",
    status: "perdido",
    description: "Perro grande, negro, muy amigable. Se perdió cerca de la plaza.",
    location: "Núñez, CABA",
    date: "Hoy",
    contact: "@thor_family",
  },
];

// ---------------------------------------------------------------------------
// PetCard
// ---------------------------------------------------------------------------

function PetCard({ pet }: { pet: LostPet }) {
  const isPerdido = pet.status === "perdido";

  return (
    <div className="bg-white rounded-[16px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      {/* Top row */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2.5 py-1 ${
            isPerdido
              ? "bg-red-50 text-red-600"
              : "bg-emerald-50 text-emerald-600"
          }`}
        >
          <span>{isPerdido ? "🔴" : "🟢"}</span>
          {isPerdido ? "Perdido" : "Encontrado"}
        </span>
        <span className="text-xs text-slate-400">{pet.date}</span>
      </div>

      {/* Name + breed */}
      <p className="font-semibold text-slate-800 leading-tight">{pet.name}</p>
      <p className="text-xs text-slate-500 mt-0.5">{pet.breed}</p>

      {/* Description */}
      <p
        className="text-sm text-slate-600 mt-1 overflow-hidden"
        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
      >
        {pet.description}
      </p>

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-3">
        <span className="inline-flex items-center gap-1 bg-[#E0F2F1] text-[#074738] text-[10px] rounded-full px-2 py-0.5">
          <MapPin size={10} />
          {pet.location}
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#074738] border border-[#074738] rounded-full px-3 py-1 active:scale-[0.97] transition-transform"
        >
          <MessageCircle size={11} />
          Contactar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ComunidadScreen
// ---------------------------------------------------------------------------

type FilterChip = "todos" | "perdido" | "encontrado";

interface ComunidadScreenProps {
  onBack?: () => void;
}

export function ComunidadScreen(_props: ComunidadScreenProps) {
  const [filter, setFilter] = useState<FilterChip>("todos");
  const [pets, setPets] = useState<LostPet[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [nombre, setNombre] = useState("");
  const [raza, setRaza] = useState("");
  const [estado, setEstado] = useState<"perdido" | "encontrado">("perdido");
  const [ubicacion, setUbicacion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [contacto, setContacto] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  // Load from Firestore on mount
  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, "lost_pets"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        if (snap.empty) {
          setPets(MOCK);
        } else {
          const items: LostPet[] = snap.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<LostPet, "id">),
          }));
          setPets(items);
        }
      } catch {
        setPets(MOCK);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const filteredPets =
    filter === "todos" ? pets : pets.filter((p) => p.status === filter);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !raza.trim() || !ubicacion.trim() || !descripcion.trim() || !contacto.trim()) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "lost_pets"), {
        name: nombre.trim(),
        breed: raza.trim(),
        status: estado,
        location: ubicacion.trim(),
        description: descripcion.trim(),
        contact: contacto.trim(),
        date: "Recién publicado",
        createdAt: new Date(),
      });
      setSubmitted(true);
      setNombre(""); setRaza(""); setUbicacion(""); setDescripcion(""); setContacto("");
    } catch {
      // silent — user can retry
    } finally {
      setSubmitting(false);
    }
  }

  const chips: { key: FilterChip; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "perdido", label: "Perdidos" },
    { key: "encontrado", label: "Encontrados" },
  ];

  const inputClass =
    "w-full border border-slate-200 rounded-[12px] px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A9B7D]/40 bg-[#F0FAF9]";

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-24" style={{ fontFamily: "'Manrope', sans-serif" }}>

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1
          className="font-bold text-[#074738] text-lg"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Comunidad
        </h1>
        <button
          type="button"
          onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="border border-[#074738] text-[#074738] text-xs font-bold rounded-full px-4 py-1.5 active:scale-[0.97] transition-transform"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Reportar
        </button>
      </div>

      {/* Hero callout */}
      <div className="mx-4 mt-4 bg-gradient-to-br from-[#074738] to-[#1A9B7D] rounded-[20px] p-5 text-white">
        <div className="text-3xl mb-2">🐾</div>
        <h2 className="font-bold text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Mascotas perdidas y encontradas
        </h2>
        <p className="text-sm opacity-80 mt-1">Ayudá a reunir familias en tu comunidad.</p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto scrollbar-hide">
        {chips.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
              filter === key
                ? "bg-[#074738] text-white"
                : "bg-[#E0F2F1] text-[#074738]"
            }`}
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Timeline list */}
      <div className="mt-4 px-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="size-8 rounded-full border-2 border-[#074738]/20 border-t-[#074738] animate-spin" />
          </div>
        ) : filteredPets.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            No hay publicaciones en esta categoría aún.
          </div>
        ) : (
          filteredPets.map((pet) => <PetCard key={pet.id} pet={pet} />)
        )}
      </div>

      {/* Report form */}
      <div ref={formRef} className="mt-8 mx-4 pb-24">
        <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <h2
            className="font-bold text-[#074738]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            ¿Encontraste o perdiste una mascota?
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Publicá en la comunidad y recibí ayuda de vecinos cercanos.
          </p>

          {submitted ? (
            <div className="mt-6 flex flex-col items-center text-center gap-2 py-4">
              <span className="text-4xl">✅</span>
              <p className="font-bold text-[#074738]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                ¡Publicado!
              </p>
              <p className="text-sm text-slate-500">La comunidad puede ayudarte.</p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-2 text-xs text-[#1A9B7D] font-bold underline"
              >
                Publicar otra
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => { void handleSubmit(e); }} className="mt-4 space-y-3">
              <input
                type="text"
                placeholder="Nombre de la mascota"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={inputClass}
                required
              />
              <input
                type="text"
                placeholder="Raza"
                value={raza}
                onChange={(e) => setRaza(e.target.value)}
                className={inputClass}
                required
              />
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as "perdido" | "encontrado")}
                className={inputClass}
              >
                <option value="perdido">Perdido</option>
                <option value="encontrado">Encontrado</option>
              </select>
              <input
                type="text"
                placeholder="Ubicación (barrio, ciudad)"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                className={inputClass}
                required
              />
              <textarea
                placeholder="Descripción (características, circunstancias...)"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                className={`${inputClass} resize-none`}
                required
              />
              <input
                type="text"
                placeholder="Contacto (usuario o teléfono)"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                className={inputClass}
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-[14px] bg-[#074738] text-white font-bold text-sm shadow-[0_4px_12px_rgba(26,155,125,0.3)] active:scale-[0.97] transition-transform disabled:opacity-60"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {submitting ? "Publicando…" : "Publicar en la comunidad"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
