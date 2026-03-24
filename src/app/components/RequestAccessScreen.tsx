import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { AuthPageShell } from "./AuthPageShell";

type Source = "TikTok" | "Instagram" | "Facebook" | "Otro" | "";

export function RequestAccessScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<Source>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await addDoc(collection(db, "access_requests"), {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        source,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch {
      setError("No pudimos guardar tu solicitud. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      eyebrow="Beta cerrada"
      title="Solicitar acceso a Pessy."
      description="Dejanos tus datos y te avisamos cuando tu lugar esté listo."
      highlights={["Lista de espera", "Sin costo", "Acceso prioritario"]}
    >
      {submitted ? (
        <div className="rounded-[1.5rem] border border-[#b5efd9] bg-[#eef8f3] px-6 py-6 text-center">
          <p
            className="text-2xl font-extrabold tracking-tight text-[#002f24]"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
          >
            ¡Listo!
          </p>
          <p className="mt-3 text-sm font-medium leading-6 text-[#404945]">
            Te avisamos cuando tengas acceso.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h2
              className="text-3xl font-extrabold tracking-tight text-[#002f24]"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
            >
              Unirme a la lista
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[#5e716b]">
              Cuando haya lugar, te contactamos.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Nombre completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none"
              required
            />

            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none"
              required
            />

            <div className="relative">
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as Source)}
                className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none appearance-none bg-white text-slate-700 cursor-pointer"
                required
              >
                <option value="">¿Cómo nos conociste?</option>
                <option value="TikTok">TikTok</option>
                <option value="Instagram">Instagram</option>
                <option value="Facebook">Facebook</option>
                <option value="Otro">Otro</option>
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                ▾
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm font-semibold text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#074738] py-4 text-sm font-bold uppercase tracking-[0.16em] text-white disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Solicitar acceso"}
            </button>
          </form>
        </>
      )}
    </AuthPageShell>
  );
}
