import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { BottomNav, type PillarTab } from "../shared/BottomNav";
import { MaterialIcon } from "../shared/MaterialIcon";
import { PetHomeView } from "../pet/PetHomeView";
import { Sidebar } from "../shared/Sidebar";
import { TermsAcceptanceNotice } from "../settings/TermsAcceptanceNotice";
import { usePet } from "../../contexts/PetContext";
import { useAuth } from "../../contexts/AuthContext";
import { usePreferences } from "../../contexts/PreferenceContext";
import { clearPendingCoTutorInvite, readPendingCoTutorInvite, rememberPendingCoTutorInvite, normalizeCoTutorInviteCode } from "../../utils/coTutorInvite";
import { isFocusExperienceHost } from "../../utils/runtimeFlags";
import { CorkMascot } from "../shared/CorkMascot";
import { GmailSyncStatus, subscribeGmailSyncStatus } from "../../services/gmailSyncService";
import { RutinasHub } from "../rutinas/RutinasHub";

const RandomQuestionCard = lazy(() =>
  import("../preferences/RandomQuestionCard.tsx")
);

const Header = lazy(() =>
  import("../shared/Header.tsx").then((module) => ({ default: module.Header }))
);
const ActionTray = lazy(() =>
  import("../medical/ActionTray.tsx").then((module) => ({ default: module.ActionTray }))
);
const Timeline = lazy(() =>
  import("../medical/Timeline.tsx").then((module) => ({ default: module.Timeline }))
);
const MonthSummary = lazy(() =>
  import("../medical/MonthSummary.tsx").then((module) => ({ default: module.MonthSummary }))
);
const PetProfileModal = lazy(() =>
  import("../pet/PetProfileModal.tsx").then((module) => ({ default: module.PetProfileModal }))
);
const DocumentScannerModal = lazy(() =>
  import("../medical/DocumentScannerModal.tsx").then((module) => ({ default: module.DocumentScannerModal }))
);
const UserProfileScreen = lazy(() =>
  import("../settings/UserProfileScreen.tsx").then((module) => ({ default: module.UserProfileScreen }))
);
const PetSelectorModal = lazy(() =>
  import("../pet/PetSelectorModal.tsx").then((module) => ({ default: module.PetSelectorModal }))
);
const AppointmentsScreen = lazy(() =>
  import("../appointments/AppointmentsScreen.tsx").then((module) => ({ default: module.AppointmentsScreen }))
);
const MedicationsScreen = lazy(() =>
  import("../medical/MedicationsScreen.tsx").then((module) => ({ default: module.MedicationsScreen }))
);
const RemindersScreen = lazy(() =>
  import("../RemindersScreen.tsx").then((module) => ({ default: module.RemindersScreen }))
);
const FocusedHomeExperience = lazy(() =>
  import("./FocusedHomeExperience.tsx").then((module) => ({ default: module.FocusedHomeExperience }))
);
const ExportReportModal = lazy(() =>
  import("../medical/ExportReportModal.tsx").then((module) => ({ default: module.ExportReportModal }))
);
const NearbyVetsScreen = lazy(() =>
  import("../nearby/NearbyVetsScreen.tsx").then((module) => ({ default: module.NearbyVetsScreen }))
);
const CommunityHubScreen = lazy(() =>
  import("../community/CommunityHub.tsx").then((module) => ({ default: module.CommunityHub }))
);
const RecommendationFeedScreen = lazy(() =>
  import("../lifestyle/RecommendationFeed.tsx").then((module) => ({ default: module.RecommendationFeed }))
);
const InviteFriendsModal = lazy(() =>
  import("../pet/InviteFriendsModal.tsx")
);

function ScreenLoader({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="bg-[#F0FAF9] dark:bg-[#101622] min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-800 p-8 text-center">
        <div className="mx-auto mb-4 size-10 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
        <p className="text-base font-bold text-slate-900 dark:text-white">{label}</p>
      </div>
    </div>
  );
}

const DEFAULT_GMAIL_SYNC_STATUS: GmailSyncStatus = {
  connected: false,
  accountEmail: null,
  grantedScopes: [],
  updatedAt: null,
  syncStatus: "idle",
  ingestionStatus: "idle",
  inviteEnabled: true,
  inviteStatus: "open_access",
  inviteReason: null,
};

function getEmailSyncNarrative(
  status: string,
  petName?: string | null
): { title: string; body: string; hint?: string } | null {
  const displayPetName = petName?.trim() || "tu mascota";

  if (status === "queued" || status === "processing" || status === "scanning_emails") {
    return {
      title: "Cork y Fizz están leyendo tu email",
      body: "Esto se acomoda en segundo plano. En un rato tu historia clínica se va a ver más completa.",
      hint: "No hace falta esperar acá. Pessy sigue ordenando la información aunque sigas usando la app.",
    };
  }
  if (status === "analyzing_documents") {
    return {
      title: "Estamos separando turnos, estudios y recetas",
      body: "Pessy está ordenando lo importante para no mezclar administrativos con datos clínicos.",
      hint: "Esto puede tardar un poco si el mail tiene PDFs, imágenes o varios estudios juntos.",
    };
  }
  if (status === "extracting_medical_events") {
    return {
      title: `Estamos acomodando la historia de ${displayPetName}`,
      body: "Leemos cuerpo, adjuntos y estudios para transformar los mails en historia clínica útil.",
      hint: "Primero ordenamos la evidencia clínica. Después se refleja en perfil, estudios e historial.",
    };
  }
  if (status === "organizing_history") {
    return {
      title: "Ya casi queda listo",
      body: "Ahora estamos ordenando la información para que después se vea clara en perfil, estudios e historial.",
      hint: "Cuando termine, Pessy va a mostrar una versión más ordenada y menos cruda de la historia.",
    };
  }
  return null;
}

function EmailSyncBackgroundCard({
  status,
  petName,
}: {
  status: GmailSyncStatus;
  petName?: string | null;
}) {
  const syncStatus = status.ingestionStatus || status.syncStatus || "idle";
  const narrative = getEmailSyncNarrative(syncStatus, petName);
  if (!status.connected || !narrative) return null;

  return (
    <section className="px-4 pt-16 pb-2">
      <div className="rounded-[24px] border border-[#D7EFE9] bg-white/95 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-4">
          <div className="shrink-0 size-20 rounded-[20px] bg-[#F0FAF9] border border-[#D7EFE9] flex items-center justify-center overflow-hidden">
            <img
              src="/blog/svg/cork_fizz_card.svg"
              alt="Cork y Fizz leyendo tu email"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-black text-[#074738] leading-5">{narrative.title}</p>
            <p className="text-sm text-slate-600 leading-5 mt-1">{narrative.body}</p>
            {narrative.hint ? (
              <p className="text-[12px] text-[#0A5F4C] mt-2 leading-5">{narrative.hint}</p>
            ) : null}
            <p className="text-[12px] text-slate-400 mt-2">
              Cuenta conectada: {status.accountEmail || "Gmail conectado"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPetProfile, setShowPetProfile] = useState(false);
  const [showExportReport, setShowExportReport] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showPetSelector, setShowPetSelector] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showInviteFriends, setShowInviteFriends] = useState(false);
  const [gmailSyncStatus, setGmailSyncStatus] = useState<GmailSyncStatus>(DEFAULT_GMAIL_SYNC_STATUS);
  const [currentTab, setCurrentTab] = useState<PillarTab>("dia-a-dia");
  const [viewMode, setViewMode] = useState<"card" | "feed" | "appointments" | "medications" | "nearby-vets" | "lost-pets" | "explore" | "rutinas-hub" | "reminders">("card");
  const [inviteNotice, setInviteNotice] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const [inviteJoiningCode, setInviteJoiningCode] = useState("");
  const [inviteResolvedCode, setInviteResolvedCode] = useState("");
  const { activePetId, setActivePetId, pets, activePet, loading: petsLoading, joinWithCode, canEditPet } = usePet();
  const { user, loading: authLoading, userName, userRole, logout } = useAuth();
  const { currentQuestion, answerQuestion, dismissQuestion } = usePreferences();
  const focusExperienceEnabled = isFocusExperienceHost();
  const joinWithCodeRef = useRef(joinWithCode);
  const inviteJoiningCodeRef = useRef(inviteJoiningCode);

  useEffect(() => {
    joinWithCodeRef.current = joinWithCode;
  }, [joinWithCode]);

  useEffect(() => {
    inviteJoiningCodeRef.current = inviteJoiningCode;
  }, [inviteJoiningCode]);

  useEffect(() => {
    if (!user?.uid) {
      setGmailSyncStatus(DEFAULT_GMAIL_SYNC_STATUS);
      return;
    }
    return subscribeGmailSyncStatus(user.uid, setGmailSyncStatus);
  }, [user?.uid]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    // ?viewmode=nearby-vets (from ClinicalReviewScreen Vet Booking Bridge)
    const viewmode = params.get("viewmode");
    if (viewmode === "nearby-vets") {
      setCurrentTab("dia-a-dia");
      setViewMode("nearby-vets");
      return;
    }

    // ?review=... (existing deep-link pattern)
    const review = params.get("review");
    if (!review) return;

    if (review === "appointments") {
      setCurrentTab("dia-a-dia");
      setViewMode("appointments");
      return;
    }
    if (review === "medications") {
      setCurrentTab("dia-a-dia");
      setViewMode("medications");
      return;
    }
    if (review === "feed") {
      setCurrentTab("dia-a-dia");
      setViewMode("feed");
      return;
    }
  }, [location.search]);

  // Si llega ?invite=CODE en la URL, guardarlo en localStorage para procesarlo
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlInvite = normalizeCoTutorInviteCode(params.get("invite"));
    if (urlInvite) {
      rememberPendingCoTutorInvite(urlInvite);
      // Limpiar el ?invite= de la URL para que no quede visible
      params.delete("invite");
      const clean = params.toString();
      navigate(location.pathname + (clean ? `?${clean}` : ""), { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    if (!user) return;
    const pendingInviteCode = readPendingCoTutorInvite();
    if (!pendingInviteCode) return;
    if (pendingInviteCode === inviteJoiningCodeRef.current || pendingInviteCode === inviteResolvedCode) return;

    let cancelled = false;
    setInviteJoiningCode(pendingInviteCode);
    setInviteNotice({
      type: "info",
      message: "Vinculando la invitación de co-tutor...",
    });

    // Timeout: if joinWithCode takes >10s, clear and let user through
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      clearPendingCoTutorInvite();
      setInviteResolvedCode(pendingInviteCode);
      setInviteJoiningCode("");
      setInviteNotice(null);
    }, 10_000);

    void joinWithCodeRef.current(pendingInviteCode)
      .then(({ petName }) => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        clearPendingCoTutorInvite();
        setInviteResolvedCode(pendingInviteCode);
        setInviteNotice({
          type: "success",
          message: `Acceso confirmado. Ya tenés acceso a ${petName}.`,
        });
        window.setTimeout(() => {
          setInviteNotice((current) => (current?.type === "success" ? null : current));
        }, 5000);
      })
      .catch((error: any) => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        clearPendingCoTutorInvite();
        setInviteResolvedCode(pendingInviteCode);
        // Errores que no requieren mostrar nada al usuario (código propio, ya unido, etc.)
        const msg = error?.message || "";
        const silent = msg.includes("propia mascota") || msg.includes("ya sos") || msg.includes("ya fue utilizado") || msg.includes("Ya sos tutor");
        if (!silent) {
          setInviteNotice({
            type: "error",
            message: msg || "No se pudo completar la invitación de co-tutor.",
          });
          window.setTimeout(() => {
            setInviteNotice((current) => (current?.type === "error" ? null : current));
          }, 5000);
        } else {
          setInviteNotice(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          window.clearTimeout(timeout);
          setInviteJoiningCode("");
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [user, inviteResolvedCode]);

  const canEditActivePet = canEditPet(activePet);

  const safeUserName = (() => {
    const fromContext = (userName || "").trim();
    if (fromContext) return fromContext;
    const fromDisplayName = (user?.displayName || "").trim().split(/\s+/)[0];
    if (fromDisplayName) return fromDisplayName;
    const fromEmail = (user?.email?.split("@")[0] || "").trim();
    if (fromEmail) return fromEmail;
    return "Tutor";
  })();

  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{
          backgroundImage: "linear-gradient(180deg, #074738 0%, #0e6a5a 50%, #1a9b7d 100%)",
        }}
      >
        <div className="w-full max-w-sm bg-white/95 rounded-[16px] border border-white/50 p-8 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="mx-auto mb-4 size-10 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
          <p className="text-base font-bold text-slate-900">Validando sesión...</p>
          <p className="text-sm text-slate-500 mt-1">Un instante, por favor.</p>
        </div>
      </div>
    );
  }

  // Guard de autenticación para evitar navegación en bucle hacia pantallas internas
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Handle pillar tab change — map each pillar to the correct viewMode
  const handleTabChange = (tab: PillarTab) => {
    setCurrentTab(tab);
    switch (tab) {
      case "dia-a-dia":
        setViewMode("card");
        break;
      case "rutinas":
        setViewMode("rutinas-hub");
        break;
      case "comunidad":
        setViewMode("lost-pets");
        break;
      case "mi-pessy":
        break; // handled by currentTab check below
    }
  };

  // Handle sidebar navigation
  const handleSidebarNavigate = (screen: "home" | "appointments" | "medications" | "feed" | "settings" | "nearby-vets" | "lost-pets" | "explore") => {
    if (screen === "settings") {
      setCurrentTab("mi-pessy");
    } else if (screen === "lost-pets" || screen === "explore") {
      setCurrentTab("comunidad");
      setViewMode(screen);
    } else if (screen === "appointments" || screen === "medications") {
      setCurrentTab("rutinas");
      setViewMode(screen);
    } else {
      setCurrentTab("dia-a-dia");
      setViewMode(screen === "home" ? "card" : screen);
    }
  };

  const handleBottomNavNavigate = (screen: "lost-pets" | "explore") => {
    setCurrentTab("comunidad");
    setViewMode(screen);
  };

  const handlePetChange = (petId: string) => {
    setActivePetId(petId);
    // Refresh all data for new pet
  };

  const handleAddNewPet = () => {
    // Navigate to pet registration
    navigate("/register-pet");
  };

  const handleOpenScanner = () => {
    if (activePet && !canEditActivePet) {
      setInviteNotice({
        type: "info",
        message: "Tu acceso es de guardián temporal. Podés ver la mascota, pero no subir ni editar información.",
      });
      window.setTimeout(() => {
        setInviteNotice((current) => current?.type === "info" ? null : current);
      }, 5000);
      return;
    }
    setShowScanner(true);
  };

  const withTermsNotice = (content: React.ReactNode) => (
    <>
      {inviteNotice && (
        <div className="fixed inset-x-4 top-4 z-[60] mx-auto max-w-md">
          <div
            className={`rounded-[16px] border px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
              inviteNotice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : inviteNotice.type === "error"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <p className="text-sm font-semibold leading-5">{inviteNotice.message}</p>
          </div>
        </div>
      )}
      {content}
      <TermsAcceptanceNotice />
    </>
  );

  // Loading state: Waiting for Firestore
  if ((petsLoading && pets.length === 0) || inviteJoiningCode) {
    return withTermsNotice(
      <div className="bg-[#F0FAF9] dark:bg-[#101622] min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-800 p-8 text-center">
          <p className="text-base font-bold text-slate-900 dark:text-white">
            {inviteJoiningCode ? "Vinculando invitación..." : "Cargando tus datos..."}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {inviteJoiningCode ? "Estamos sumando esta mascota compartida a tu cuenta." : "Un momento, por favor."}
          </p>
        </div>
      </div>
    );
  }

  // Empty state: No pets registered
  if (pets.length === 0) {
    const justAcceptedSharedPet = !!inviteResolvedCode;
    return withTermsNotice(
      <div className="bg-[#F0FAF9] dark:bg-[#101622] min-h-screen">
        <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center space-y-6">
              <div className="size-32 mx-auto bg-[#074738]/10 rounded-full flex items-center justify-center">
                {justAcceptedSharedPet ? <CorkMascot size={74} /> : (
                  <span className="material-symbols-outlined text-[#074738]" style={{ fontSize: "64px" }}>
                    folder_shared
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {justAcceptedSharedPet ? "Estamos terminando de sumar la mascota compartida" : "¡Bienvenido a PESSY!"}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                  {justAcceptedSharedPet
                    ? "Tu acceso ya fue confirmado. Si la mascota todavía no aparece, reintentá la carga antes de crear una nueva."
                    : "Agrega tu primera mascota. Pessy hace el resto."}
                </p>
              </div>
              {justAcceptedSharedPet ? (
                <div className="space-y-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full px-6 py-3 bg-[#074738] text-white rounded-[14px] font-semibold transition-colors shadow-[0_4px_12px_rgba(26,155,125,0.3)]"
                  >
                    Reintentar carga
                  </button>
                  <button
                    onClick={() => setInviteResolvedCode("")}
                    className="w-full px-6 py-3 border border-[#074738]/20 text-[#074738] rounded-[14px] font-semibold"
                  >
                    Cerrar este aviso
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAddNewPet}
                  className="px-6 py-3 bg-[#074738] text-white rounded-[14px] font-semibold transition-colors shadow-[0_4px_12px_rgba(26,155,125,0.3)]"
                >
                  Agregar primera mascota
                </button>
              )}
            </div>
          </div>
        </div>
        <BottomNav
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onAddDocument={handleOpenScanner}
          onNavigate={handleBottomNavNavigate}
        />
        <DocumentScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
        />
      </div>
    );
  }

  // Guard: No active pet selected
  if (!activePet) {
    return withTermsNotice(
      <div className="bg-[#F0FAF9] dark:bg-[#101622] min-h-screen">
        <div className="max-w-md mx-auto min-h-screen flex items-center justify-center px-6 pb-24">
          <div className="text-center max-w-sm">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">No se pudo cargar la mascota activa</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Volvé a seleccionar una mascota para continuar.
            </p>
            <button
              onClick={() => setShowPetSelector(true)}
              className="px-5 py-3 rounded-xl bg-[#074738] text-white font-bold"
            >
              Seleccionar mascota
            </button>
          </div>
        </div>
        <BottomNav
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onAddDocument={handleOpenScanner}
          onNavigate={handleBottomNavNavigate}
        />
        <DocumentScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
        />
        <PetSelectorModal
          isOpen={showPetSelector}
          onClose={() => setShowPetSelector(false)}
          pets={pets}
          activePetId={activePetId}
          onPetChange={handlePetChange}
          onViewProfile={() => setShowPetProfile(true)}
          onAddNewPet={handleAddNewPet}
        />
      </div>
    );
  }

  // Render different screens based on tab
  if (currentTab === "mi-pessy") {
    return withTermsNotice(
      <>
        <Suspense fallback={<ScreenLoader label="Cargando perfil..." />}>
          <UserProfileScreen onBack={() => handleTabChange("dia-a-dia")} />
        </Suspense>
        <BottomNav
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onAddDocument={handleOpenScanner}
          onNavigate={handleBottomNavNavigate}
        />
        <Suspense fallback={null}>
          <DocumentScannerModal
            isOpen={showScanner}
            onClose={() => setShowScanner(false)}
          />
        </Suspense>
      </>
    );
  }

  // Show Rutinas Hub
  if (viewMode === "rutinas-hub") {
    return withTermsNotice(
      <>
        <RutinasHub onNavigate={(screen) => { setViewMode(screen); }} />
        <BottomNav
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onAddDocument={handleOpenScanner}
          onNavigate={handleBottomNavNavigate}
        />
        <Suspense fallback={null}>
          <DocumentScannerModal
            isOpen={showScanner}
            onClose={() => setShowScanner(false)}
          />
        </Suspense>
      </>
    );
  }

  // Show Appointments Screen
  if (viewMode === "appointments") {
    return withTermsNotice(
      <>
        <Suspense fallback={<ScreenLoader label="Cargando turnos..." />}>
          <AppointmentsScreen onBack={() => setViewMode("rutinas-hub")} />
        </Suspense>
        <BottomNav
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onAddDocument={handleOpenScanner}
          onNavigate={handleBottomNavNavigate}
        />
        <Suspense fallback={null}>
          <DocumentScannerModal
            isOpen={showScanner}
            onClose={() => setShowScanner(false)}
          />
        </Suspense>
      </>
    );
  }

  // Show Medications Screen
  if (viewMode === "medications") {
    return withTermsNotice(
      <>
        <Suspense fallback={<ScreenLoader label="Cargando tratamientos..." />}>
          <MedicationsScreen onBack={() => setViewMode("rutinas-hub")} />
        </Suspense>
        <BottomNav currentTab={currentTab} onTabChange={handleTabChange} onAddDocument={handleOpenScanner} onNavigate={handleBottomNavNavigate} />
        <Suspense fallback={null}>
          <DocumentScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} />
        </Suspense>
      </>
    );
  }

  // Show Reminders Screen
  if (viewMode === "reminders") {
    return withTermsNotice(
      <>
        <Suspense fallback={<ScreenLoader label="Cargando recordatorios..." />}>
          <RemindersScreen onBack={() => setViewMode("rutinas-hub")} />
        </Suspense>
        <BottomNav currentTab={currentTab} onTabChange={handleTabChange} onAddDocument={handleOpenScanner} onNavigate={handleBottomNavNavigate} />
        <Suspense fallback={null}>
          <DocumentScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} />
        </Suspense>
      </>
    );
  }

  // Show Nearby Vets Screen
  if (viewMode === "nearby-vets") {
    return withTermsNotice(
      <>
        <Suspense fallback={<ScreenLoader label="Buscando veterinarias..." />}>
          <NearbyVetsScreen onBack={() => setViewMode("card")} />
        </Suspense>
        <BottomNav currentTab={currentTab} onTabChange={handleTabChange} onAddDocument={handleOpenScanner} onNavigate={handleBottomNavNavigate} />
        <Suspense fallback={null}>
          <DocumentScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} />
        </Suspense>
      </>
    );
  }

  // Show Community Hub (Perdidos + Encontrados + Adopción)
  if (viewMode === "lost-pets") {
    return withTermsNotice(
      <>
        <Suspense fallback={<ScreenLoader label="Cargando comunidad..." />}>
          <CommunityHubScreen onBack={() => setViewMode("card")} />
        </Suspense>
        <BottomNav currentTab={currentTab} onTabChange={handleTabChange} onAddDocument={handleOpenScanner} onNavigate={handleBottomNavNavigate} />
      </>
    );
  }

  // Show Explore / Recommendations
  if (viewMode === "explore") {
    return withTermsNotice(
      <>
        <Suspense fallback={<ScreenLoader label="Descubriendo lugares..." />}>
          <RecommendationFeedScreen onBack={() => setViewMode("card")} />
        </Suspense>
        <BottomNav currentTab={currentTab} onTabChange={handleTabChange} onAddDocument={handleOpenScanner} onNavigate={handleBottomNavNavigate} />
      </>
    );
  }

  return withTermsNotice(
    <div className="bg-[#F0FAF9] dark:bg-[#101622] text-slate-900 dark:text-slate-100 min-h-screen font-['Manrope',sans-serif]">
      {/* Sidebar */}
      <Sidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        userName={safeUserName}
        userEmail={user?.email || undefined}
        pets={pets.map((p) => ({ id: p.id, name: p.name, photo: p.photo, breed: p.breed }))}
        activePetId={activePetId}
        onPetChange={handlePetChange}
        onAddPet={handleAddNewPet}
        onInviteFriends={() => setShowInviteFriends(true)}
        onNavigate={handleSidebarNavigate}
        onLogout={logout}
      />

      <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
        {/* Hamburger removed — Sidebar access moved to profile/settings.
            BottomNav covers all primary navigation. */}

        {/* View Mode Toggle Button */}
        {viewMode === "feed" && (
          <div className="fixed top-4 left-4 z-40">
            <button
              onClick={() => setViewMode("card")}
              className="size-10 rounded-full bg-white dark:bg-slate-900 shadow-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:scale-110 transition-transform"
            >
              <MaterialIcon
                name="arrow_back"
                className="text-slate-700 dark:text-slate-300 text-xl"
              />
            </button>
          </div>
        )}

        {/* Card View */}
        {viewMode === "card" && (
          <>
            <EmailSyncBackgroundCard status={gmailSyncStatus} petName={activePet?.name} />
            {focusExperienceEnabled ? (
              <Suspense fallback={<ScreenLoader label="Cargando inicio..." />}>
                <FocusedHomeExperience
                  userName={safeUserName}
                  activePetId={activePetId}
                  activePet={{
                    name: activePet.name,
                    photo: activePet.photo,
                    breed: activePet.breed,
                    species: activePet.species,
                    age: activePet.age,
                    weight: activePet.weight,
                  }}
                  onPetClick={() => setShowPetSelector(true)}
                  onOpenFeed={() => setViewMode("feed")}
                  onOpenAppointments={() => setViewMode("appointments")}
                  onOpenMedications={() => setViewMode("medications")}
                  onOpenScanner={handleOpenScanner}
                  onExportReport={() => setShowExportReport(true)}
                  onOpenNearbyVets={() => setViewMode("nearby-vets")}
                />
              </Suspense>
            ) : (
              <>
                <PetHomeView
                  userName={safeUserName}
                  onViewHistory={() => setViewMode("feed")}
                  onProfileClick={() => setShowPetProfile(true)}
                  onPetClick={() => setShowPetSelector(true)}
                  onAppointmentsClick={() => setViewMode("appointments")}
                  onMedicationsClick={() => setViewMode("medications")}
                  pets={pets}
                  activePetId={activePetId}
                  onPetChange={handlePetChange}
                />
                {/* Random Question — 1 per session to build owner profile */}
                {currentQuestion && activePet && (
                  <Suspense fallback={null}>
                    <div className="mt-4">
                      <RandomQuestionCard
                        question={currentQuestion}
                        petName={activePet.name}
                        onAnswer={answerQuestion}
                        onDismiss={dismissQuestion}
                      />
                    </div>
                  </Suspense>
                )}
              </>
            )}
          </>
        )}

        {/* Feed View - Original Design */}
        {viewMode === "feed" && (
          <Suspense fallback={<ScreenLoader label="Cargando historia..." />}>
            <>
              <Header
                onPetClick={() => setShowPetSelector(true)}
                activePet={{
                  name: activePet.name,
                  photo: activePet.photo,
                  species: activePet.breed
                }}
              />

              <main className="flex-1 px-4 space-y-6 mt-4">
                <Timeline
                  activePet={{
                    name: activePet.name,
                    photo: activePet.photo
                  }}
                  onExportReport={() => setShowExportReport(true)}
                />
                <MonthSummary />
                <ActionTray />
              </main>
            </>
          </Suspense>
        )}
      </div>

      {/* Bottom Navigation with Add Document button */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onAddDocument={handleOpenScanner}
        onNavigate={handleBottomNavNavigate}
      />

      {/* Modals */}
      <Suspense fallback={null}>
        <PetProfileModal
          isOpen={showPetProfile}
          onOpenNearbyVets={() => { setShowPetProfile(false); setViewMode("nearby-vets"); }}
          onClose={() => setShowPetProfile(false)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <ExportReportModal
          isOpen={showExportReport}
          onClose={() => setShowExportReport(false)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <DocumentScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <PetSelectorModal
          isOpen={showPetSelector}
          onClose={() => setShowPetSelector(false)}
          pets={pets}
          activePetId={activePetId}
          onPetChange={handlePetChange}
          onViewProfile={() => setShowPetProfile(true)}
          onAddNewPet={handleAddNewPet}
        />
      </Suspense>
      <Suspense fallback={null}>
        <InviteFriendsModal
          open={showInviteFriends}
          onClose={() => setShowInviteFriends(false)}
        />
      </Suspense>
    </div>
  );
}
