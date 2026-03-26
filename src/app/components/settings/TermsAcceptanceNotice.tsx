import { useEffect, useState } from "react";
import { Link } from "react-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { CURRENT_TERMS_UPDATED_LABEL, CURRENT_TERMS_VERSION } from "../constants/legal";

type TermsResponseStatus = "accepted" | "declined";

export function TermsAcceptanceNotice() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) {
        if (!cancelled) {
          setVisible(false);
          setChecking(false);
        }
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data();
        const savedVersion = (data?.legalTermsVersion || "") as string;
        const savedStatus = (data?.legalTermsStatus || "") as string;
        const alreadyResponded =
          savedVersion === CURRENT_TERMS_VERSION &&
          (savedStatus === "accepted" || savedStatus === "declined");

        if (!cancelled) {
          setVisible(!alreadyResponded);
        }
      } catch {
        if (!cancelled) {
          setVisible(false);
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleResponse = async (status: TermsResponseStatus) => {
    if (!user || submitting) return;

    setSubmitting(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          legalTermsVersion: CURRENT_TERMS_VERSION,
          legalTermsStatus: status,
          legalTermsRespondedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setVisible(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || checking || !visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm md:items-center">
      <div className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl">
        <div className="space-y-3">
          <span className="inline-flex rounded-full bg-[#e0f2f1] px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-[#074738]">
            Terminos actualizados
          </span>
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              Actualizamos los terminos de PESSY.
            </h2>
            <p className="text-sm font-medium leading-relaxed text-slate-500">
              Publicamos una nueva version el {CURRENT_TERMS_UPDATED_LABEL}. Te la mostramos una sola vez para que elijas si queres aceptarla ahora.
            </p>
          </div>
          <Link
            to="/terminos"
            className="inline-flex items-center gap-2 text-sm font-black text-[#1a9b7d] underline-offset-4 hover:underline"
          >
            Leer terminos y condiciones
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={() => void handleResponse("declined")}
            disabled={submitting}
            className="rounded-full border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            No por ahora
          </button>
          <button
            onClick={() => void handleResponse("accepted")}
            disabled={submitting}
            className="rounded-full bg-[#074738] px-4 py-3 text-sm font-black text-white transition-colors hover:bg-[#06352a] disabled:opacity-60"
          >
            Si, acepto
          </button>
        </div>
      </div>
    </div>
  );
}
