import { createContext, lazy, Suspense, useContext, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { BottomNavRouted } from "../shared/BottomNavRouted";
import { Sidebar } from "../shared/Sidebar";
import { TermsAcceptanceNotice } from "../settings/TermsAcceptanceNotice";
import { usePet } from "../../contexts/PetContext";
import { useAuth } from "../../contexts/AuthContext";
import { MaterialIcon } from "../shared/MaterialIcon";
import {
  clearPendingCoTutorInvite,
  readPendingCoTutorInvite,
  rememberPendingCoTutorInvite,
  normalizeCoTutorInviteCode,
} from "../../utils/coTutorInvite";

// ---------------------------------------------------------------------------
// Lazy-loaded modals
// ---------------------------------------------------------------------------

const DocumentScannerModal = lazy(() =>
  import("../medical/DocumentScannerModal.tsx").then((m) => ({
    default: m.DocumentScannerModal,
  }))
);

const PetSelectorModal = lazy(() =>
  import("../pet/PetSelectorModal.tsx").then((m) => ({
    default: m.PetSelectorModal,
  }))
);

const PetProfileModal = lazy(() =>
  import("../pet/PetProfileModal.tsx").then((m) => ({
    default: m.PetProfileModal,
  }))
);

const ExportReportModal = lazy(() =>
  import("../medical/ExportReportModal.tsx").then((m) => ({
    default: m.ExportReportModal,
  }))
);

const InviteFriendsModal = lazy(() => import("../pet/InviteFriendsModal.tsx"));

// ---------------------------------------------------------------------------
// Context so child routes can trigger layout-level modals
// ---------------------------------------------------------------------------

export interface AppLayoutActions {
  openScanner: () => void;
  openPetSelector: () => void;
  openPetProfile: () => void;
  openExportReport: () => void;
  openInviteFriends: () => void;
  openSidebar: () => void;
}

export const AppLayoutContext = createContext<AppLayoutActions>({
  openScanner: () => {},
  openPetSelector: () => {},
  openPetProfile: () => {},
  openExportReport: () => {},
  openInviteFriends: () => {},
  openSidebar: () => {},
});

export function useAppLayout() {
  return useContext(AppLayoutContext);
}

// ---------------------------------------------------------------------------
// Inline loader (matches existing ScreenLoader in HomeScreen)
// ---------------------------------------------------------------------------

function ScreenLoader({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="bg-[#F0FAF9] dark:bg-[#101622] min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-800 p-8 text-center">
        <div className="mx-auto mb-4 size-10 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
        <p className="text-base font-bold text-slate-900 dark:text-white">
          {label}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Routes where the hamburger menu button should appear
// ---------------------------------------------------------------------------

const HAMBURGER_ROUTES = ["/inicio", "/home", "/historial"];

// ---------------------------------------------------------------------------
// Legacy ?review= param → new route redirect map
// ---------------------------------------------------------------------------

const REVIEW_REDIRECT_MAP: Record<string, string> = {
  appointments: "/turnos",
  medications: "/tratamientos",
  feed: "/historial",
};

// ---------------------------------------------------------------------------
// BottomNav active-tab derivation from pathname
// ---------------------------------------------------------------------------

function deriveCurrentTab(pathname: string): "home" | "settings" {
  if (pathname.startsWith("/perfil")) return "settings";
  return "home";
}

// ---------------------------------------------------------------------------
// AppLayout component
// ---------------------------------------------------------------------------

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Auth & pet contexts
  const { user, loading: authLoading, userName, logout } = useAuth();
  const {
    activePetId,
    setActivePetId,
    pets,
    activePet,
    loading: petsLoading,
    joinWithCode,
  } = usePet();

  // Modal visibility state
  const [showScanner, setShowScanner] = useState(false);
  const [showPetSelector, setShowPetSelector] = useState(false);
  const [showPetProfile, setShowPetProfile] = useState(false);
  const [showExportReport, setShowExportReport] = useState(false);
  const [showInviteFriends, setShowInviteFriends] = useState(false);

  // Sidebar
  const [showSidebar, setShowSidebar] = useState(false);

  // Co-tutor invite state
  const [inviteNotice, setInviteNotice] = useState<{
    type: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const [inviteJoiningCode, setInviteJoiningCode] = useState("");
  const [inviteResolvedCode, setInviteResolvedCode] = useState("");

  // -----------------------------------------------------------------------
  // Legacy ?review= URL param redirect
  // -----------------------------------------------------------------------

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const review = params.get("review");
    if (!review) return;

    const target = REVIEW_REDIRECT_MAP[review];
    if (target) {
      params.delete("review");
      const remaining = params.toString();
      navigate(target + (remaining ? `?${remaining}` : ""), { replace: true });
    }
  }, [location.search, navigate]);

  // -----------------------------------------------------------------------
  // Co-tutor invite — capture ?invite=CODE from URL
  // -----------------------------------------------------------------------

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlInvite = normalizeCoTutorInviteCode(params.get("invite"));
    if (urlInvite) {
      rememberPendingCoTutorInvite(urlInvite);
      params.delete("invite");
      const clean = params.toString();
      navigate(location.pathname + (clean ? `?${clean}` : ""), {
        replace: true,
      });
    }
  }, [location.search, navigate, location.pathname]);

  // -----------------------------------------------------------------------
  // Co-tutor invite — process pending invite after auth
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!user) return;
    const pendingInviteCode = readPendingCoTutorInvite();
    if (!pendingInviteCode) return;
    if (
      pendingInviteCode === inviteJoiningCode ||
      pendingInviteCode === inviteResolvedCode
    )
      return;

    let cancelled = false;
    setInviteJoiningCode(pendingInviteCode);
    setInviteNotice({
      type: "info",
      message: "Vinculando la invitacion de co-tutor...",
    });

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      clearPendingCoTutorInvite();
      setInviteResolvedCode(pendingInviteCode);
      setInviteJoiningCode("");
      setInviteNotice(null);
    }, 10_000);

    void joinWithCode(pendingInviteCode)
      .then(({ petName }) => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        clearPendingCoTutorInvite();
        setInviteResolvedCode(pendingInviteCode);
        setInviteNotice({
          type: "success",
          message: `Acceso confirmado. Ya sos co-tutor de ${petName}.`,
        });
        window.setTimeout(() => {
          setInviteNotice((current) =>
            current?.type === "success" ? null : current
          );
        }, 5000);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        clearPendingCoTutorInvite();
        setInviteResolvedCode(pendingInviteCode);
        const msg =
          error instanceof Error
            ? error.message
            : typeof error === "object" &&
                error !== null &&
                "message" in error
              ? String((error as { message: unknown }).message)
              : "";
        const silent =
          msg.includes("propia mascota") ||
          msg.includes("ya sos") ||
          msg.includes("ya fue utilizado") ||
          msg.includes("Ya sos tutor");
        if (!silent) {
          setInviteNotice({
            type: "error",
            message:
              msg || "No se pudo completar la invitacion de co-tutor.",
          });
          window.setTimeout(() => {
            setInviteNotice((current) =>
              current?.type === "error" ? null : current
            );
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
  }, [user, inviteJoiningCode, inviteResolvedCode, joinWithCode]);

  // -----------------------------------------------------------------------
  // Derived values
  // -----------------------------------------------------------------------

  // safeUserName — sin IIFE (rompe en Safari iOS)
  const _ctxName = typeof userName === "string" ? userName.trim() : "";
  const _displayName = typeof user?.displayName === "string" ? user.displayName.trim().split(/\s+/)[0] : "";
  const _emailName = typeof user?.email === "string" ? user.email.split("@")[0].trim() : "";
  const safeUserName = _ctxName || _displayName || _emailName || "Tutor";

  const currentTab = deriveCurrentTab(location.pathname);

  const showHamburger = HAMBURGER_ROUTES.some(
    (r) => location.pathname === r || location.pathname.startsWith(r + "/")
  );

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleTabChange = (tab: "home" | "settings") => {
    if (tab === "home") navigate("/inicio");
    else navigate("/perfil");
  };

  const handleBottomNavNavigate = (screen: "lost-pets" | "explore") => {
    if (screen === "lost-pets") navigate("/comunidad");
    else navigate("/explorar");
  };

  const handleSidebarNavigate = (
    screen:
      | "home"
      | "appointments"
      | "medications"
      | "feed"
      | "settings"
      | "nearby-vets"
      | "lost-pets"
      | "explore"
  ) => {
    const routeMap: Record<string, string> = {
      home: "/inicio",
      appointments: "/turnos",
      medications: "/tratamientos",
      feed: "/historial",
      "nearby-vets": "/explorar",
      "lost-pets": "/comunidad",
      explore: "/explorar",
      settings: "/perfil",
    };
    navigate(routeMap[screen] || "/inicio");
  };

  const handlePetChange = (petId: string) => {
    setActivePetId(petId);
  };

  const handleAddNewPet = () => {
    navigate("/register-pet");
  };

  // -----------------------------------------------------------------------
  // Context value for child routes
  // -----------------------------------------------------------------------

  const layoutActions: AppLayoutActions = {
    openScanner: () => setShowScanner(true),
    openPetSelector: () => setShowPetSelector(true),
    openPetProfile: () => setShowPetProfile(true),
    openExportReport: () => setShowExportReport(true),
    openInviteFriends: () => setShowInviteFriends(true),
    openSidebar: () => setShowSidebar(true),
  };

  // -----------------------------------------------------------------------
  // Invite notice banner (rendered above content)
  // -----------------------------------------------------------------------

  const inviteBanner = inviteNotice ? (
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
        <p className="text-sm font-semibold leading-5">
          {inviteNotice.message}
        </p>
      </div>
    </div>
  ) : null;

  // -----------------------------------------------------------------------
  // Auth loading
  // -----------------------------------------------------------------------

  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{
          backgroundImage:
            "linear-gradient(180deg, #074738 0%, #0e6a5a 50%, #1a9b7d 100%)",
        }}
      >
        <div className="w-full max-w-sm bg-white/95 rounded-[16px] border border-white/50 p-8 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="mx-auto mb-4 size-10 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
          <p className="text-base font-bold text-slate-900">
            Validando sesion...
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Un instante, por favor.
          </p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Auth guard
  // -----------------------------------------------------------------------

  if (!user) {
    // Preservar ?invite=CODE si vino por link de co-tutor — si no lo guardamos
    // antes del redirect el parametro se pierde y el usuario nuevo no sabe
    // qué pasó.
    const urlInvite = normalizeCoTutorInviteCode(
      new URLSearchParams(location.search).get("invite")
    );
    if (urlInvite) {
      rememberPendingCoTutorInvite(urlInvite);
      return <Navigate to={`/login?invite=${urlInvite}`} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // -----------------------------------------------------------------------
  // Pet loading state (or joining invite)
  // -----------------------------------------------------------------------

  if ((petsLoading && pets.length === 0) || inviteJoiningCode) {
    return (
      <>
        {inviteBanner}
        <div className="bg-[#F0FAF9] dark:bg-[#101622] min-h-screen flex items-center justify-center px-6">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-800 p-8 text-center">
            <div className="mx-auto mb-4 size-10 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {inviteJoiningCode
                ? "Vinculando invitacion..."
                : "Cargando tus datos..."}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {inviteJoiningCode
                ? "Estamos sumando esta mascota compartida a tu cuenta."
                : "Un momento, por favor."}
            </p>
          </div>
        </div>
        <TermsAcceptanceNotice />
      </>
    );
  }

  // -----------------------------------------------------------------------
  // Empty pets state
  // -----------------------------------------------------------------------

  if (pets.length === 0) {
    return (
      <>
        {inviteBanner}
        <div className="bg-[#F0FAF9] dark:bg-[#101622] min-h-screen">
          <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center space-y-6">
                <div className="size-32 mx-auto bg-[#074738]/10 rounded-full flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-[#074738]"
                    aria-hidden="true"
                    style={{ fontSize: "64px" }}
                  >
                    folder_shared
                  </span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    ¡Bienvenido a PESSY!
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                    Agrega tu primera mascota. Pessy hace el resto.
                  </p>
                </div>
                <button
                  onClick={handleAddNewPet}
                  className="px-6 py-3 bg-[#074738] text-white rounded-[14px] font-semibold transition-colors shadow-[0_4px_12px_rgba(26,155,125,0.3)]"
                >
                  Agregar primera mascota
                </button>
              </div>
            </div>
          </div>
          <BottomNavRouted onAddDocument={() => setShowScanner(true)} />
          <Suspense fallback={null}>
            <DocumentScannerModal
              isOpen={showScanner}
              onClose={() => setShowScanner(false)}
            />
          </Suspense>
        </div>
        <TermsAcceptanceNotice />
      </>
    );
  }

  // -----------------------------------------------------------------------
  // No active pet guard
  // -----------------------------------------------------------------------

  if (!activePet) {
    return (
      <>
        {inviteBanner}
        <div className="bg-[#F0FAF9] dark:bg-[#101622] min-h-screen">
          <div className="max-w-md mx-auto min-h-screen flex items-center justify-center px-6 pb-24">
            <div className="text-center max-w-sm">
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                No se pudo cargar la mascota activa
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Volve a seleccionar una mascota para continuar.
              </p>
              <button
                onClick={() => setShowPetSelector(true)}
                className="px-5 py-3 rounded-xl bg-[#074738] text-white font-bold"
              >
                Seleccionar mascota
              </button>
            </div>
          </div>
          <BottomNavRouted onAddDocument={() => setShowScanner(true)} />
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
        </div>
        <TermsAcceptanceNotice />
      </>
    );
  }

  // -----------------------------------------------------------------------
  // Main layout — authenticated with active pet
  // -----------------------------------------------------------------------

  return (
    <AppLayoutContext.Provider value={layoutActions}>
      {inviteBanner}

      <div className="pessy-grain bg-[#F0FAF9] dark:bg-[#101622] text-slate-900 dark:text-slate-100 min-h-screen font-['Manrope',sans-serif]">
        {/* Sidebar */}
        <Sidebar
          isOpen={showSidebar}
          onClose={() => setShowSidebar(false)}
          userName={safeUserName}
          userEmail={user.email || undefined}
          pets={pets.map((p) => ({
            id: p.id,
            name: p.name,
            photo: p.photo,
            breed: p.breed,
          }))}
          activePetId={activePetId}
          onPetChange={handlePetChange}
          onAddPet={handleAddNewPet}
          onInviteFriends={() => setShowInviteFriends(true)}
          onNavigate={handleSidebarNavigate}
          onLogout={logout}
        />

        {/* Child route content */}
        <Suspense fallback={<ScreenLoader />}>
          <Outlet />
        </Suspense>

        {/* Bottom Navigation */}
        <BottomNavRouted onAddDocument={() => setShowScanner(true)} />

        {/* Modals — all lazy-loaded */}
        <Suspense fallback={null}>
          <PetProfileModal
            isOpen={showPetProfile}
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

      <TermsAcceptanceNotice />
    </AppLayoutContext.Provider>
  );
}
