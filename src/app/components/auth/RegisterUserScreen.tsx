import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { auth, db } from "../../../lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { COUNTRIES } from "../../data/countries";
import { normalizeCoTutorInviteCode, rememberPendingCoTutorInvite } from "../../utils/coTutorInvite";
import { persistAcquisitionSource, resolveAcquisitionSource, trackAcquisitionEvent } from "../../utils/acquisitionTracking";
import { validatePlatformInviteCode, validateAccessToken, markPlatformInviteUsed, markAccessTokenUsed } from "../../utils/platformInvite";
import { ConsentManager, ConsentState, saveConsent } from "../ConsentManager";
import { isNativeAppContext } from "../../utils/runtimeFlags";

// Stitch-style shell — hero illustration + light form. Reemplaza AuthPageShell.
function StitchShell({
  children,
  tagline = "Tu mascota, sus cosas, todo en orden.",
  heroHeight = "h-64",
}: {
  children: React.ReactNode;
  tagline?: string;
  heroHeight?: string;
}) {
  return (
    <div
      className="min-h-screen bg-[#F0FAF9] flex flex-col"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <div className="min-h-screen flex flex-col max-w-md mx-auto bg-[#F0FAF9] overflow-hidden relative w-full">
        <div className={`${heroHeight} relative overflow-hidden flex items-end px-5 pb-6`}>
          <div className="absolute inset-0 z-0">
            <img
              src="/illustrations/dark_top_surprised_cork_head.svg"
              alt=""
              className="w-full h-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#F0FAF9] via-[#F0FAF9]/40 to-transparent" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <img src="/pessy-logo.svg" alt="" className="w-9 h-9" />
              <h1
                className="text-[32px] font-extrabold text-[#074738] tracking-tight leading-none"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Pessy
              </h1>
            </div>
            <p className="text-[15px] text-[#6B7280] max-w-[260px] leading-relaxed">
              {tagline}
            </p>
          </div>
        </div>

        <main
          className="flex-1 px-5 pt-2 pb-8"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
        >
          {children}
        </main>

        <div className="absolute bottom-10 -right-10 w-40 h-40 bg-[#1A9B7D]/8 rounded-full blur-3xl -z-10" />
        <div className="absolute top-20 -left-10 w-40 h-40 bg-[#074738]/8 rounded-full blur-3xl -z-10" />
      </div>
    </div>
  );
}

export function RegisterUserScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");
  const [emailAlreadyInUse, setEmailAlreadyInUse] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTermsStep, setShowTermsStep] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  // Role is always "tutor" in Pessy app. Pessy Vet is a separate app.
  const userRole = "tutor" as const;
  // SECURITY FIX: Consentimiento ANTES de recolectar datos (GDPR Art.7, LFPDPPP Art.15-16)
  // QA/native: skip consent step (auto-accept for dev)
  const isQA = isNativeAppContext() ||
    (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname));
  const [consentStep, setConsentStep] = useState<"consent" | "register" | "post-register">(isQA ? "register" : "consent");
  const [consentData, setConsentData] = useState<ConsentState | null>(isQA ? {
    termsAccepted: true,
    privacyAccepted: true,
    aiProcessingAccepted: true,
    internationalTransferAccepted: true,
    version: "qa-auto",
    timestamp: new Date().toISOString(),
  } : null);
  const [gateStatus, setGateStatus] = useState<"loading" | "allowed" | "blocked" | "invalid">("loading");
  const [gateMessage, setGateMessage] = useState("");
  const [platformInviteCreatedBy, setPlatformInviteCreatedBy] = useState<string | null>(null);
  const [accessTokenDocId, setAccessTokenDocId] = useState<string | null>(null);

  const refCode = useMemo(() => (searchParams.get("ref") || "").trim().toUpperCase(), [searchParams]);
  const accessToken = useMemo(() => (searchParams.get("access") || "").trim(), [searchParams]);

  // BUG-009 FIX: guardar sincrónicamente durante el render (ver LoginScreen)
  const inviteCode = useMemo(() => {
    const code = normalizeCoTutorInviteCode(searchParams.get("invite"));
    if (code) rememberPendingCoTutorInvite(code);
    return code;
  }, [searchParams]);
  const acquisitionSource = useMemo(
    () => resolveAcquisitionSource(location.search, location.pathname),
    [location.pathname, location.search]
  );
  const leadName = useMemo(() => searchParams.get("lead_name")?.trim() || "", [searchParams]);
  const leadEmail = useMemo(() => searchParams.get("lead_email")?.trim().toLowerCase() || "", [searchParams]);
  const leadPet = useMemo(() => searchParams.get("lead_pet")?.trim() || "", [searchParams]);

  useEffect(() => {
    if (!acquisitionSource) return;
    persistAcquisitionSource(acquisitionSource);
    void trackAcquisitionEvent("pessy_acquisition_register_view", {
      source: acquisitionSource,
      path: location.pathname,
    });
  }, [acquisitionSource, location.pathname]);

  useEffect(() => {
    if (leadName) setName((current) => current || leadName);
    if (leadEmail) setEmail((current) => current || leadEmail);
    if (!leadPet) return;
    localStorage.setItem(
      "pessy_landing_prefill",
      JSON.stringify({
        name: leadName || "",
        email: leadEmail || "",
        petName: leadPet,
      })
    );
  }, [leadEmail, leadName, leadPet]);

  useEffect(() => {
    let cancelled = false;
    async function checkGate() {
      try {
        if (refCode) {
          const result = await validatePlatformInviteCode(refCode);
          if (cancelled) return;
          if (result.valid) {
            setPlatformInviteCreatedBy(result.doc.createdBy);
            setGateStatus("allowed");
          } else {
            setGateMessage(
              result.reason === "expired" ? "Este link expiró. Pedile uno nuevo a quien te invitó." :
              result.reason === "already_used" ? "Este link ya fue usado." :
              "Este link no es válido."
            );
            setGateStatus("invalid");
          }
          return;
        }
        if (accessToken) {
          const result = await validateAccessToken(accessToken);
          if (cancelled) return;
          if (result.valid) {
            setAccessTokenDocId(result.doc.token);
            if (result.doc.email) setEmail((c) => c || result.doc.email);
            setGateStatus("allowed");
          } else {
            setGateMessage(
              result.reason === "expired" ? "Este acceso expiró. Solicitá uno nuevo." :
              "Este acceso no es válido."
            );
            setGateStatus("invalid");
          }
          return;
        }
        if (inviteCode) {
          try {
            const invRef = doc(db, "invitations", inviteCode);
            const invSnap = await getDoc(invRef);
            if (cancelled) return;
            if (invSnap.exists() && !invSnap.data().used) {
              setGateStatus("allowed");
            } else {
              setGateStatus("invalid");
              setGateMessage("Este código de invitación no es válido o ya fue usado.");
            }
          } catch {
            // Allow on network error - validation happens later in joinWithCode
            if (!cancelled) setGateStatus("allowed");
          }
          return;
        }
        // Beta abierta: registro libre, la aprobación es post-registro por email
        setGateStatus("allowed");
      } catch {
        if (!cancelled) {
          setGateMessage("No pudimos verificar tu acceso. Revisá tu conexión e intentá de nuevo.");
          setGateStatus("invalid");
        }
      }
    }
    void checkGate();
    return () => { cancelled = true; };
  }, [refCode, accessToken, inviteCode]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEmailAlreadyInUse(false);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;
      const inviteEnabled = true;

      await updateProfile(user, { displayName: name.trim() });
      const nowIso = new Date().toISOString();
      const userDocPayload = {
        fullName: name.trim(),
        name: name.trim(),
        email: cleanEmail,
        country: country || null,
        role: "tutor",
        createdAt: nowIso,
        // SECURITY: Registrar consentimiento explícito (GDPR Art.7, LFPDPPP Art.8-9, Ley 25.326 Art.5)
        consent: consentData ? {
          termsAccepted: consentData.termsAccepted,
          privacyAccepted: consentData.privacyAccepted,
          aiProcessingAccepted: consentData.aiProcessingAccepted,
          internationalTransferAccepted: consentData.internationalTransferAccepted,
          version: consentData.version,
          acceptedAt: consentData.timestamp,
        } : null,
        gmailSync: {
          connected: false,
          accountEmail: null,
          grantedScopes: [],
          inviteEnabled,
          inviteStatus: inviteEnabled ? "open_access" : "not_invited",
          consentRequestedAt: nowIso,
          lastInAppPromptAt: nowIso,
          updatedAt: nowIso,
        },
        gmailSyncInvitation: {
          enabled: inviteEnabled,
          status: inviteEnabled ? "open_access" : "not_invited",
          reason: null,
          updatedAt: nowIso,
        },
        gmailSyncReminder: {
          status: "pending_permission",
          dayNumber: 0,
          sentCount: 0,
          consentRequestedAt: nowIso,
          lastPushSentAt: null,
          updatedAt: nowIso,
          lastError: null,
        },
        ...(platformInviteCreatedBy ? { invitedBy: platformInviteCreatedBy } : {}),
        accessSource: refCode ? "invite" : accessToken ? "waitlist" : inviteCode ? "cotutor" : "direct",
      };
      // Ghost user fix: if setDoc fails, retry once before surfacing error
      try {
        await setDoc(doc(db, "users", user.uid), userDocPayload);
      } catch (docErr) {
        console.warn("[Register] setDoc falló, reintentando...", docErr);
        await setDoc(doc(db, "users", user.uid), userDocPayload);
      }

      void trackAcquisitionEvent("pessy_acquisition_register_success", {
        source: acquisitionSource,
        path: location.pathname,
        gmail_invite_enabled: inviteEnabled,
      });

      if (refCode) {
        try { await markPlatformInviteUsed(refCode, user.uid); } catch (err) {
          console.warn("Could not mark platform invite as used:", err);
        }
      }
      if (accessToken) {
        try { await markAccessTokenUsed(accessToken, user.uid); } catch (err) {
          console.warn("Could not mark access token as used:", err);
        }
      }

      // SECURITY FIX: Consentimiento ya se aceptó antes del form, ir directo
      if (consentData) saveConsent(consentData);
      navigate(inviteCode ? "/home" : "/register-pet", { replace: true });
    } catch (err: any) {
      if (err?.code === "auth/email-already-in-use") {
        setEmailAlreadyInUse(true);
        setError("Ya tenés una cuenta con ese email. Si no podés entrar, intentá con el enlace mágico desde el login.");
      } else if (err?.code === "auth/invalid-email") {
        setError("Correo electrónico inválido.");
      } else if (err?.code === "auth/weak-password") {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else if (err?.code === "auth/network-request-failed") {
        setError("Sin conexión. Revisá internet e intentá nuevamente.");
      } else {
        setError("No se pudo crear la cuenta. Intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTerms = () => {
    navigate(inviteCode ? "/home" : "/register-pet", { replace: true });
  };

  if (gateStatus === "loading") {
    return (
      <StitchShell>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1A9B7D] border-t-transparent" />
          <p className="text-sm text-[#6B7280]">Verificando acceso...</p>
        </div>
      </StitchShell>
    );
  }

  // SECURITY: Paso de consentimiento ANTES de mostrar el formulario (GDPR Art.7, LFPDPPP Art.15)
  // ── Step 1: Consent (GDPR) ──
  if (gateStatus === "allowed" && consentStep === "consent") {
    return (
      <StitchShell>
        <ConsentManager
          onConsent={(consent) => {
            setConsentData(consent);
            setConsentStep("register");
          }}
          onBack={() => navigate(inviteCode ? `/login?invite=${inviteCode}` : "/login")}
        />
      </StitchShell>
    );
  }

  if (gateStatus === "blocked") {
    return (
      <StitchShell>
        <div className="space-y-5">
          <div className="rounded-[16px] border border-[#E5E7EB] bg-white px-6 py-6 text-center">
            <p className="text-base font-bold text-[#074738]">Pessy es solo por invitación</p>
            <p className="mt-2 text-sm leading-5 text-[#6B7280]">
              Por ahora el acceso es limitado. Podés solicitar tu lugar en la lista de espera.
            </p>
          </div>
          <a
            href="/solicitar-acceso"
            className="block w-full h-14 leading-[3.5rem] bg-[#074738] hover:bg-[#0e5c49] text-white text-[15px] font-bold rounded-[16px] text-center shadow-[0_4px_14px_rgba(7,71,56,0.18)] active:scale-[0.97] transition-transform"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Solicitar acceso
          </a>
          <a
            href="/login"
            className="block w-full h-14 leading-[3.5rem] bg-white border border-[#E5E7EB] rounded-[14px] text-center text-[14px] font-semibold text-[#1A1A1A]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Ya tengo cuenta
          </a>
        </div>
      </StitchShell>
    );
  }

  if (gateStatus === "invalid") {
    return (
      <StitchShell>
        <div className="space-y-5">
          <div className="rounded-[16px] border border-[#E5E7EB] bg-white px-6 py-6 text-center">
            <p className="text-base font-bold text-[#074738]">Link inválido</p>
            <p className="mt-2 text-sm leading-5 text-[#6B7280]">{gateMessage}</p>
          </div>
          <a
            href="/solicitar-acceso"
            className="block w-full h-14 leading-[3.5rem] bg-[#074738] hover:bg-[#0e5c49] text-white text-[15px] font-bold rounded-[16px] text-center shadow-[0_4px_14px_rgba(7,71,56,0.18)] active:scale-[0.97] transition-transform"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Solicitar acceso
          </a>
          <a
            href="/login"
            className="block w-full h-14 leading-[3.5rem] bg-white border border-[#E5E7EB] rounded-[14px] text-center text-[14px] font-semibold text-[#1A1A1A]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Ya tengo cuenta
          </a>
        </div>
      </StitchShell>
    );
  }

  return (
    <StitchShell>
      <form onSubmit={handleCreateAccount} className="space-y-4">
        {inviteCode && (
          <div className="rounded-[14px] border border-[#1A9B7D]/30 bg-[#E0F2F1] px-4 py-3">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#074738]"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Invitación de co-tutor
            </p>
            <p className="text-sm font-medium leading-5 mt-1 text-[#6B7280]">
              Esta cuenta se va a vincular con una mascota compartida apenas termines el registro.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            className="text-[12px] font-semibold text-[#6B7280] block ml-1 uppercase tracking-wide"
            htmlFor="register-name"
          >
            Nombre
          </label>
          <input
            id="register-name"
            type="text"
            aria-label="Nombre completo"
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-14 px-4 bg-white border border-[#E5E7EB] rounded-[14px] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] transition-all"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label
            className="text-[12px] font-semibold text-[#6B7280] block ml-1 uppercase tracking-wide"
            htmlFor="register-email"
          >
            Email
          </label>
          <input
            id="register-email"
            type="email"
            aria-label="Correo electrónico"
            placeholder="hola@pessy.app"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-14 px-4 bg-white border border-[#E5E7EB] rounded-[14px] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] transition-all"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label
            className="text-[12px] font-semibold text-[#6B7280] block ml-1 uppercase tracking-wide"
            htmlFor="register-password"
          >
            Contraseña
          </label>
          <div className="relative">
            <input
              id="register-password"
              type={showPassword ? "text" : "password"}
              aria-label="Contraseña"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-14 px-4 pr-14 bg-white border border-[#E5E7EB] rounded-[14px] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] transition-all"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] rounded-full text-[#6B7280] hover:text-[#074738] flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            className="text-[12px] font-semibold text-[#6B7280] block ml-1 uppercase tracking-wide"
            htmlFor="register-country"
          >
            País
          </label>
          <div className="relative">
            <select
              id="register-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-label="País de residencia"
              className="w-full h-14 px-4 bg-white border border-[#E5E7EB] rounded-[14px] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none appearance-none text-[15px] text-[#1A1A1A] cursor-pointer transition-all"
            >
              <option value="">¿De dónde sos?</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
              ▾
            </div>
          </div>
        </div>

        {error && (
          <div className="text-center">
            <p className="rounded-[12px] border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-sm font-semibold text-[#EF4444]">
              {error}
            </p>
            {emailAlreadyInUse && (
              <button
                type="button"
                onClick={() => navigate(inviteCode ? `/login?invite=${inviteCode}` : "/login")}
                className="mt-2 text-sm font-bold text-[#1A9B7D] underline underline-offset-2"
              >
                Ir al login
              </button>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-14 bg-[#074738] hover:bg-[#0e5c49] text-white text-[15px] font-bold rounded-[16px] flex items-center justify-center disabled:opacity-50 active:scale-[0.97] transition-transform shadow-[0_4px_14px_rgba(7,71,56,0.18)]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>

      <footer className="pt-8 flex flex-col items-center gap-2">
        <p className="text-[14px] text-[#6B7280]">¿Ya tenés cuenta?</p>
        <button
          type="button"
          onClick={() => navigate(inviteCode ? `/login?invite=${inviteCode}` : "/login")}
          className="px-6 py-2.5 rounded-full bg-[#1A9B7D]/10 text-[#1A9B7D] text-[14px] font-bold active:scale-[0.97] transition-transform"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Ingresar
        </button>
      </footer>

      {/* Consent modal removed — consent now collected BEFORE registration via ConsentManager (GDPR Art.7) */}
    </StitchShell>
  );
}
