import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { auth, db } from "../../../lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { COUNTRIES } from "../../data/countries";
import { normalizeCoTutorInviteCode, rememberPendingCoTutorInvite } from "../../utils/coTutorInvite";
import { persistAcquisitionSource, resolveAcquisitionSource, trackAcquisitionEvent } from "../../utils/acquisitionTracking";
import { validatePlatformInviteCode, validateAccessToken, markPlatformInviteUsed, markAccessTokenUsed } from "../../utils/platformInvite";
import { AuthPageShell } from "./AuthPageShell";
import { ConsentManager, ConsentState, saveConsent } from "../ConsentManager";
import { isNativeAppContext } from "../../utils/runtimeFlags";

export function RegisterUserScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTermsStep, setShowTermsStep] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  // Role selection: tutor (pet owner) or vet (professional)
  const [userRole, setUserRole] = useState<"tutor" | "vet" | null>(null);
  // Vet-only fields
  const [vetLicense, setVetLicense] = useState("");
  const [vetSpecialty, setVetSpecialty] = useState("");
  // SECURITY FIX: Consentimiento ANTES de recolectar datos (GDPR Art.7, LFPDPPP Art.15-16)
  // QA/native: skip consent step (auto-accept for dev)
  const isQA = isNativeAppContext() ||
    (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname));
  const [consentStep, setConsentStep] = useState<"role" | "consent" | "register" | "post-register">(isQA ? "role" : "role");
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
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;
      const inviteEnabled = true;

      await updateProfile(user, { displayName: name.trim() });
      const nowIso = new Date().toISOString();
      await setDoc(doc(db, "users", user.uid), {
        fullName: name.trim(),
        name: name.trim(),
        email: cleanEmail,
        country: country || null,
        role: userRole || "tutor",
        ...(userRole === "vet" ? {
          vetProfile: {
            license: vetLicense.trim() || null,
            specialty: vetSpecialty || null,
            verified: false,
          },
        } : {}),
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
      });

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
      // Vets go to home (no pet registration needed), tutors register their pet
      navigate(inviteCode ? "/home" : userRole === "vet" ? "/inicio" : "/register-pet", { replace: true });
    } catch (err: any) {
      if (err?.code === "auth/email-already-in-use") {
        setError("Ese correo ya está registrado.");
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
    navigate(inviteCode ? "/home" : userRole === "vet" ? "/inicio" : "/register-pet", { replace: true });
  };

  if (gateStatus === "loading") {
    return (
      <AuthPageShell
        eyebrow="Tu cuenta"
        title="Su historia comienza aquí."
        description="Pessy lo maneja. Vos lo disfrutás. Empezá gratis."
        highlights={["Identidad digital", "Rutinas", "Co-tutores"]}
      >
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1A9B7D] border-t-transparent" />
          <p className="text-sm text-[#9CA3AF]">Verificando acceso...</p>
        </div>
      </AuthPageShell>
    );
  }

  // SECURITY: Paso de consentimiento ANTES de mostrar el formulario (GDPR Art.7, LFPDPPP Art.15)
  // ── Step 0: Role selection ──
  if (gateStatus === "allowed" && consentStep === "role") {
    return (
      <AuthPageShell
        eyebrow="Tu cuenta"
        title="¿Cómo vas a usar Pessy?"
        description="Elegí tu perfil para personalizar tu experiencia."
        highlights={[]}
      >
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold text-[#074738] text-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Elegí tu perfil
          </h2>
          <p className="text-sm text-[#9CA3AF] text-center" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Esto define cómo vas a interactuar con la plataforma.
          </p>

          {/* Tutor card */}
          <button
            type="button"
            onClick={() => {
              setUserRole("tutor");
              setConsentStep(isQA ? "register" : "consent");
            }}
            className="w-full rounded-[16px] border-2 border-[#E5E7EB] bg-white p-5 text-left transition-all hover:border-[#1A9B7D] hover:shadow-[0_4px_12px_rgba(26,155,125,0.15)] active:scale-[0.98]"
          >
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-[#F0FAF9]">
                <span className="text-2xl">🐾</span>
              </div>
              <div>
                <p className="text-base font-extrabold text-[#074738]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Soy tutor de mascota
                </p>
                <p className="mt-1 text-sm text-[#6B7280]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Quiero gestionar la salud, rutinas y bienestar de mi mascota.
                </p>
              </div>
            </div>
          </button>

          {/* Vet card */}
          <button
            type="button"
            onClick={() => {
              setUserRole("vet");
              setConsentStep(isQA ? "register" : "consent");
            }}
            className="w-full rounded-[16px] border-2 border-[#E5E7EB] bg-white p-5 text-left transition-all hover:border-[#5048CA] hover:shadow-[0_4px_12px_rgba(80,72,202,0.15)] active:scale-[0.98]"
          >
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-[#F0F0FF]">
                <span className="text-2xl">🩺</span>
              </div>
              <div>
                <p className="text-base font-extrabold text-[#074738]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Soy profesional veterinario
                </p>
                <p className="mt-1 text-sm text-[#6B7280]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Quiero gestionar pacientes, historiales clínicos y consultas.
                </p>
              </div>
            </div>
          </button>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full rounded-[14px] border border-[#E5E7EB] py-3 text-sm font-bold uppercase tracking-[0.16em] text-[#074738] transition-all hover:bg-[#f4f3f9]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Ya tengo cuenta
            </button>
          </div>
        </div>
      </AuthPageShell>
    );
  }

  // ── Step 1: Consent (GDPR) ──
  if (gateStatus === "allowed" && consentStep === "consent") {
    return (
      <AuthPageShell
        eyebrow="Tu cuenta"
        title="Su historia comienza aquí."
        description="Pessy lo maneja. Vos lo disfrutás. Empezá gratis."
        highlights={["Identidad digital", "Rutinas", "Co-tutores"]}
      >
        <ConsentManager
          onConsent={(consent) => {
            setConsentData(consent);
            setConsentStep("register");
          }}
          onBack={() => navigate(inviteCode ? `/login?invite=${inviteCode}` : "/login")}
        />
      </AuthPageShell>
    );
  }

  if (gateStatus === "blocked") {
    return (
      <AuthPageShell
        eyebrow="Tu cuenta"
        title="Su historia comienza aquí."
        description="Pessy lo maneja. Vos lo disfrutás. Empezá gratis."
        highlights={["Identidad digital", "Rutinas", "Co-tutores"]}
      >
        <div className="space-y-6">
          <div className="rounded-[16px] border border-[#E5E7EB] bg-[#F0FAF9] px-6 py-6 text-center">
            <p className="text-base font-bold text-[#1A9B7D]">Pessy es solo por invitación</p>
            <p className="mt-2 text-sm leading-5 text-[#9CA3AF]">
              Por ahora el acceso es limitado. Podés solicitar tu lugar en la lista de espera.
            </p>
          </div>
          <a
            href="/solicitar-acceso"
            className="block w-full rounded-[14px] bg-[#074738] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_4px_12px_rgba(26,155,125,0.3)]"
          >
            Solicitar acceso
          </a>
          <a
            href="/login"
            className="block w-full rounded-[14px] border border-[#E5E7EB] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-[#1A9B7D]"
          >
            Ya tengo cuenta
          </a>
        </div>
      </AuthPageShell>
    );
  }

  if (gateStatus === "invalid") {
    return (
      <AuthPageShell
        eyebrow="Tu cuenta"
        title="Su historia comienza aquí."
        description="Pessy lo maneja. Vos lo disfrutás. Empezá gratis."
        highlights={["Identidad digital", "Rutinas", "Co-tutores"]}
      >
        <div className="space-y-6">
          <div className="rounded-[16px] border border-[#E5E7EB] bg-[#F0FAF9] px-6 py-6 text-center">
            <p className="text-base font-bold text-[#1A9B7D]">Link inválido</p>
            <p className="mt-2 text-sm leading-5 text-[#9CA3AF]">{gateMessage}</p>
          </div>
          <a
            href="/solicitar-acceso"
            className="block w-full rounded-[14px] bg-[#074738] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_4px_12px_rgba(26,155,125,0.3)]"
          >
            Solicitar acceso
          </a>
          <a
            href="/login"
            className="block w-full rounded-[14px] border border-[#E5E7EB] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-[#1A9B7D]"
          >
            Ya tengo cuenta
          </a>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      eyebrow="Tu cuenta"
      title="Su historia comienza aquí."
      description="Pessy lo maneja. Vos lo disfrutás. Empezá gratis."
      highlights={["Identidad digital", "Rutinas", "Co-tutores"]}
    >
      <div className="mb-8">
        <h2
          className={`text-3xl font-extrabold tracking-tight ${userRole === "vet" ? "text-[#5048CA]" : "text-[#1A9B7D]"}`}
          style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
        >
          {userRole === "vet" ? "Cuenta profesional" : "Crear cuenta"}
        </h2>
        <p className="mt-2 text-sm font-medium leading-6 text-[#9CA3AF]">
          {userRole === "vet"
            ? "Registrate como profesional veterinario para gestionar pacientes."
            : "Empezá con tus datos. Pessy hace el resto — en serio."}
        </p>
      </div>

      <form onSubmit={handleCreateAccount} className="space-y-4">
          {inviteCode && (
            <div className="rounded-[16px] border border-[#b5efd9] bg-[#F0FAF9] px-4 py-4 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1A9B7D]">Invitación de co-tutor</p>
              <p className="mt-1 text-sm leading-5 text-[#1A9B7D]">
                Esta cuenta se va a vincular con una mascota compartida apenas termines el registro.
              </p>
            </div>
          )}
          <input
            type="text"
            placeholder="Nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-4 rounded-[12px] border border-[#E5E7EB] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none"
            required
          />

          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-4 rounded-[12px] border border-[#E5E7EB] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none"
            required
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-4 pr-28 rounded-[12px] border border-[#E5E7EB] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[14px] border border-[#E5E7EB] bg-[#F0FAF9] px-3 py-1 text-xs font-bold text-[#1A9B7D]"
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          {/* País */}
          <div className="relative">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-4 py-4 rounded-[12px] border border-[#E5E7EB] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none appearance-none bg-white text-slate-700 cursor-pointer"
            >
              <option value="">🌍 ¿De dónde sos?</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
              ▾
            </div>
          </div>

          {/* Vet-only fields */}
          {userRole === "vet" && (
            <>
              <div className="rounded-[16px] border border-[#5048CA]/20 bg-[#F0F0FF] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5048CA]">Datos profesionales</p>
              </div>
              <input
                type="text"
                placeholder="Matrícula profesional"
                value={vetLicense}
                onChange={(e) => setVetLicense(e.target.value)}
                className="w-full px-4 py-4 rounded-[12px] border border-[#E5E7EB] focus:ring-2 focus:ring-[#5048CA]/30 focus:border-[#5048CA] outline-none"
              />
              <select
                value={vetSpecialty}
                onChange={(e) => setVetSpecialty(e.target.value)}
                className="w-full px-4 py-4 rounded-[12px] border border-[#E5E7EB] focus:ring-2 focus:ring-[#5048CA]/30 focus:border-[#5048CA] outline-none appearance-none bg-white text-slate-700 cursor-pointer"
              >
                <option value="">Especialidad (opcional)</option>
                <option value="general">Medicina general</option>
                <option value="surgery">Cirugía</option>
                <option value="dermatology">Dermatología</option>
                <option value="cardiology">Cardiología</option>
                <option value="nutrition">Nutrición</option>
                <option value="behavior">Comportamiento</option>
                <option value="emergency">Emergencias</option>
                <option value="exotic">Animales exóticos</option>
                <option value="other">Otra</option>
              </select>
            </>
          )}

          {error && <p className="text-red-500 text-sm font-semibold text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-[14px] py-4 text-sm font-bold uppercase tracking-[0.16em] text-white disabled:opacity-60 ${
              userRole === "vet"
                ? "bg-[#5048CA] shadow-[0_4px_12px_rgba(80,72,202,0.3)]"
                : "bg-[#074738] shadow-[0_4px_12px_rgba(26,155,125,0.3)]"
            }`}
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>

          <button
            type="button"
            onClick={() => navigate(inviteCode ? `/login?invite=${inviteCode}` : "/login")}
            className="w-full rounded-[14px] border border-[#E5E7EB] py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#1A9B7D] transition-all hover:bg-[#f4f3f9]"
          >
            Ya tengo cuenta
          </button>
      </form>

      {/* Consent modal removed — consent now collected BEFORE registration via ConsentManager (GDPR Art.7) */}
    </AuthPageShell>
  );
}
