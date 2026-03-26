import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { BottomNav } from "../shared/BottomNav";
import { MaterialIcon } from "../shared/MaterialIcon";
import { PetHomeView } from "../pet/PetHomeView";
import { Sidebar } from "../shared/Sidebar";
import { TermsAcceptanceNotice } from "../settings/TermsAcceptanceNotice";
import { usePet } from "../contexts/PetContext";
import { useAuth } from "../contexts/AuthContext";
import { clearPendingCoTutorInvite, readPendingCoTutorInvite, rememberPendingCoTutorInvite, normalizeCoTutorInviteCode } from "../utils/coTutorInvite";
import { isFocusExperienceHost } from "../utils/runtimeFlags";

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
const FocusedHomeExperience = lazy(() =>
  import("./FocusedHomeExperience.tsx").then((module) => ({ default: module.FocusedHomeExperience }))
);
const ExportReportModal = lazy(() =>
  import("../medical/ExportReportModal.tsx").then((module) => ({ default: module.ExportReportModal }))
);
const NearbyVetsScreen = lazy(() =>
  import("../nearby/NearbyVetsScreen.tsx").then((module) => ({ default: module.NearbyVetsScreen }))
);
const InviteFriendsModal = lazy(() =>
  import("../pet/InviteFriendsModal.tsx")
);

function ScreenLoader({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <div className="mx-auto mb-4 size-10 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
        <p className="text-base font-bold text-slate-900 dark:text-white">{label}</p>
      </div>
    </div>
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
  const [currentTab, setCurrentTab] = useState<"home" | "settings">("home");
  const [viewMode, setViewMode] = useState<"card" | "feed" | "appointments" | "medications" | "nearby-vets">("card");
  const [inviteNotice, setInviteNotice] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const [inviteJoiningCode, setInviteJoiningCode] = useState("");
  const [inviteResolvedCode, setInviteResolvedCode] = useState("");
  const { activePetId, setActivePetId, pets, activePet, loading: petsLoading, joinWithCode } = usePet();
  const { user, loading: authLoading, userName, logout } = useAuth();
  const focusExperienceEnabled = isFocusExperienceHost();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const review = params.get("review");
    if (!review) return;

    if (review === "appointments") {
      setCurrentTab("home");
      setViewMode("appointments");
      return;
    }
    if (review === "medications") {
      setCurrentTab("home");
      setViewMode("medications");
      return;
    }
    if (review === "feed") {
      setCurrentTab("home");
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
    if (pendingInviteCode === inviteJoiningCode || pendingInviteCode === inviteResolvedCode) return;

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
  }, [user, inviteJoiningCode, inviteResolvedCode, joinWithCode]);

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
        <div className="w-full max-w-sm bg-white/95 rounded-3xl border border-white/50 p-8 text-center shadow-2xl">
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

  // Handle tab change and reset viewMode to "card" when going to home tab
  const handleTabChange = (tab: "home" | "settings") => {
    setCurrentTab(tab);
    if (tab === "home") setViewMode("card");
  };

  // Handle sidebar navigation
  const handleSidebarNavigate = (screen: "home" | "appointments" | "medications" | "feed" | "settings" | "nearby-vets") => {
    if (screen === "settings") {
      setCurrentTab("settings");
    } else {
      setCurrentTab("home");
      setViewMode(screen === "home" ? "card" : screen);
    }
  };

  const handlePetChange = (petId: string) => {
    setActivePetId(petId);
    // Refresh all data for new pet
  };

  const handleAddNewPet = () => {
    // Navigate to pet registration
    navigate("/register-pet");
  };

  const withTermsNotice = (content: React.ReactNode) => (
    <>
      {inviteNotice && (
        <div className="fixed inset-x-4 top-4 z-[60] mx-auto max-w-md">
          <div
            className={`rounded-2xl border px-4 py-3 shadow-xl ${
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
      <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center">
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
    return withTermsNotice(
      <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen">
        <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center space-y-6">
              <div className="size-32 mx-auto bg-[#074738]/10 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-[#074738]" style={{ fontSize: "64px" }}>
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
                className="px-6 py-3 bg-[#074738] text-white rounded-full font-semibold hover:bg-[#074738] transition-colors shadow-lg"
              >
                Agregar primera mascota
              </button>
            </div>
          </div>
        </div>
        <BottomNav
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onAddDocument={() => setShowScanner(true)}
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
      <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen">
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
          onAddDocument={() => setShowScanner(true)}
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
  if (currentTab === "settings") {
    return withTermsNotice(
      <>
        <Suspense fallback={<ScreenLoader label="Cargando perfil..." />}>
          <UserProfileScreen onBack={() => handleTabChange("home")} />
        </Suspense>
        <BottomNav
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onAddDocument={() => setShowScanner(true)}
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
          <AppointmentsScreen onBack={() => setViewMode("card")} />
        </Suspense>
        <BottomNav
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onAddDocument={() => setShowScanner(true)}
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
          <MedicationsScreen onBack={() => setViewMode("card")} />
        </Suspense>
        <BottomNav currentTab={currentTab} onTabChange={handleTabChange} onAddDocument={() => setShowScanner(true)} />
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
        <BottomNav currentTab={currentTab} onTabChange={handleTabChange} onAddDocument={() => setShowScanner(true)} />
        <Suspense fallback={null}>
          <DocumentScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} />
        </Suspense>
      </>
    );
  }

  return withTermsNotice(
    <div className="bg-[#f6f6f8] dark:bg-[#101622] text-slate-900 dark:text-slate-100 min-h-screen font-['Manrope',sans-serif]">
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
        {/* Hamburger Menu Button */}
        {viewMode === "card" && (
          <div className="fixed top-4 left-4 z-40">
            <button
              onClick={() => setShowSidebar(true)}
              className="size-10 rounded-full bg-white dark:bg-slate-900 shadow-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:scale-110 transition-transform"
            >
              <MaterialIcon
                name="menu"
                className="text-[#074738] dark:text-emerald-400 text-xl"
              />
            </button>
          </div>
        )}

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
                  onOpenScanner={() => setShowScanner(true)}
                  onExportReport={() => setShowExportReport(true)}
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
        onAddDocument={() => setShowScanner(true)}
      />

      {/* Modals */}
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
  );
}
