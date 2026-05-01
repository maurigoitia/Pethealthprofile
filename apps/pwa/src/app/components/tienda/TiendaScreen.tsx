import { useState, useEffect } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

interface TiendaScreenProps {
  onBack: () => void;
}

interface CategoryCardProps {
  emoji: string;
  label: string;
  icon: React.ReactNode;
  onTap: () => void;
}

function CategoryCard({ emoji, label, icon, onTap }: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="bg-white rounded-[16px] p-5 flex flex-col items-center gap-2 shadow-[0_1px_4px_rgba(0,0,0,0.04)] active:scale-[0.97] transition-all cursor-pointer text-left w-full"
    >
      <div className="size-12 rounded-[14px] bg-[#E0F2F1] flex items-center justify-center">
        {icon}
      </div>
      <span className="text-2xl">{emoji}</span>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
    </button>
  );
}

export function TiendaScreen({ onBack }: TiendaScreenProps) {
  const [toastVisible, setToastVisible] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState("Alimentos");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const showToast = () => {
    setToastVisible(true);
  };

  useEffect(() => {
    if (toastVisible) {
      const timer = setTimeout(() => setToastVisible(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [toastVisible]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "store_interest"), {
        name: name.trim(),
        email: email.trim(),
        type,
        createdAt: new Date(),
        source: "app",
      });
      setSubmitted(true);
    } catch (err) {
      console.error("[Pessy] Error al guardar interés en tienda:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [
    {
      emoji: "🥩",
      label: "Alimentos",
      icon: <MaterialIcon name="restaurant" className="!text-[22px] text-[#1A9B7D]" />,
    },
    {
      emoji: "🎒",
      label: "Accesorios",
      icon: <MaterialIcon name="shopping_bag" className="!text-[22px] text-[#1A9B7D]" />,
    },
    {
      emoji: "💊",
      label: "Salud",
      icon: <MaterialIcon name="medication" className="!text-[22px] text-[#1A9B7D]" />,
    },
    {
      emoji: "🎾",
      label: "Juguetes",
      icon: <MaterialIcon name="star" className="!text-[22px] text-[#1A9B7D]" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F0FAF9] overflow-y-auto pb-24">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="size-9 flex items-center justify-center rounded-full hover:bg-slate-100 active:scale-[0.97] transition-all"
          aria-label="Volver"
        >
          <MaterialIcon name="arrow_back" className="!text-[22px] text-slate-700" />
        </button>
        <h1
          className="text-base font-bold text-[#074738]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Tienda
        </h1>
        <span className="bg-[#E0F2F1] text-[#1A9B7D] text-[10px] font-bold px-2 py-0.5 rounded-full">
          Próximamente
        </span>
      </div>

      {/* Hero banner */}
      <div className="mx-4 mt-4">
        <div className="bg-gradient-to-br from-[#074738] to-[#1A9B7D] rounded-[20px] p-6 text-white">
          <div className="text-5xl mb-3">🐾</div>
          <h2
            className="font-bold text-xl"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Tu tienda de confianza, desde Pessy
          </h2>
          <p className="text-sm opacity-80 mt-1">
            Todo lo que tu mascota necesita, en un solo lugar.
          </p>
        </div>
      </div>

      {/* Categories grid */}
      <div className="mt-6 mx-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
          Categorías
        </p>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.label}
              emoji={cat.emoji}
              label={cat.label}
              icon={cat.icon}
              onTap={showToast}
            />
          ))}
        </div>
      </div>

      {/* "¿Querés ser parte?" form */}
      <div className="mt-8 mx-4 pb-24">
        <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <h3
            className="font-bold text-[#074738]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            ¿Tenés una tienda?
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Registrá tu interés y te contactamos cuando abramos.
          </p>

          {submitted ? (
            <div className="mt-6 flex flex-col items-center gap-2 py-4">
              <span className="text-4xl">✅</span>
              <p
                className="text-center text-[#074738] font-semibold"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                ¡Gracias! Te contactaremos pronto.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Nombre del negocio"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-sm border border-slate-200 rounded-[12px] px-4 py-3 w-full mt-3 focus:outline-none focus:border-[#1A9B7D]"
              />
              <input
                type="email"
                placeholder="Email de contacto"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-sm border border-slate-200 rounded-[12px] px-4 py-3 w-full mt-3 focus:outline-none focus:border-[#1A9B7D]"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="text-sm border border-slate-200 rounded-[12px] px-4 py-3 w-full mt-3 focus:outline-none focus:border-[#1A9B7D] bg-white"
              >
                <option value="Alimentos">Alimentos</option>
                <option value="Accesorios">Accesorios</option>
                <option value="Salud">Salud</option>
                <option value="Juguetes">Juguetes</option>
                <option value="Otro">Otro</option>
              </select>
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-4 bg-[#074738] text-white rounded-[14px] py-3.5 font-semibold active:scale-[0.97] transition-all disabled:opacity-60"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {submitting ? "Enviando..." : "Registrar interés"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Toast */}
      {toastVisible && (
        <div className="fixed bottom-20 left-4 right-4 bg-[#074738] text-white text-center py-3 rounded-[14px] shadow-lg z-50 transition-all">
          Próximamente disponible 🚀
        </div>
      )}
    </div>
  );
}
