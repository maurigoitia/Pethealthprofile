import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { usePet } from "../contexts/PetContext";
import { clearPendingCoTutorInvite, rememberPendingCoTutorInvite } from "../utils/coTutorInvite";

const EMAIL_STORAGE_KEY = "pessy_magic_link_email";

export function EmailLinkSignInScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { joinWithCode } = usePet();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const inviteCode = (params.get("invite") || "").toUpperCase().trim();

  const [email, setEmail] = useState<string>(() => localStorage.getItem(EMAIL_STORAGE_KEY) || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const completeMagicLinkSignIn = async (valueEmail: string) => {
    const normalizedEmail = valueEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Ingresá el mismo email que recibió la invitación.");
      return;
    }
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      setError("Este enlace no es válido o ya expiró.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await signInWithEmailLink(auth, normalizedEmail, window.location.href);
      localStorage.removeItem(EMAIL_STORAGE_KEY);

      if (inviteCode) {
        try {
          const { petName } = await joinWithCode(inviteCode);
          clearPendingCoTutorInvite();
          setSuccess(`Acceso confirmado. Ya sos co-tutor de ${petName}.`);
        } catch (joinError: any) {
          setSuccess("Sesión iniciada correctamente.");
          setError(joinError?.message || "No se pudo completar la unión como co-tutor.");
        }
      } else {
        setSuccess("Sesión iniciada correctamente.");
      }

      setTimeout(() => navigate("/home", { replace: true }), 1200);
    } catch (err: any) {
      if (err?.code === "auth/invalid-action-code") {
        setError("Este magic link ya no es válido.");
      } else if (err?.code === "auth/invalid-email") {
        setError("Email inválido.");
      } else {
        setError("No se pudo completar el acceso con magic link.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (inviteCode) {
      rememberPendingCoTutorInvite(inviteCode);
    }
    const savedEmail = localStorage.getItem(EMAIL_STORAGE_KEY) || "";
    if (savedEmail && isSignInWithEmailLink(auth, window.location.href)) {
      void completeMagicLinkSignIn(savedEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        backgroundImage: "linear-gradient(180deg, #074738 0%, #0e6a5a 50%, #1a9b7d 100%)",
      }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl px-6 pt-10 pb-10">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black text-[#074738]">Pessy</h1>
          <p className="text-slate-500 text-sm mt-2">Acceso seguro por magic link</p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Para confirmar la invitación como co-tutor, ingresá el correo que recibió este enlace.
          </p>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu correo"
            className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none"
          />

          {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
          {success && <p className="text-emerald-600 text-sm font-semibold">{success}</p>}

          <button
            onClick={() => completeMagicLinkSignIn(email)}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-[#074738] text-white font-bold disabled:opacity-60"
          >
            {loading ? "Validando enlace..." : "Confirmar acceso"}
          </button>

          <button
            onClick={() => navigate("/login")}
            className="w-full py-4 rounded-2xl border-2 border-[#074738] text-[#074738] font-bold hover:bg-[#074738]/5 transition-all"
          >
            Ir a iniciar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
