import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router";
import { Header } from "./Header";
import { ActionTray } from "./ActionTray";
import { Timeline } from "./Timeline";
import { MonthSummary } from "./MonthSummary";
import { PetProfileModal } from "./PetProfileModal";
import { DocumentScannerModal } from "./DocumentScannerModal";
import { BottomNav } from "./BottomNav";
import { UserProfileScreen } from "./UserProfileScreen";
import { PetSelectorModal } from "./PetSelectorModal";
import { MaterialIcon } from "./MaterialIcon";
import { PetHomeView } from "./PetHomeView";
import { AppointmentsScreen } from "./AppointmentsScreen";
import { MedicationsScreen } from "./MedicationsScreen";
import { usePet } from "../contexts/PetContext";
import { useAuth } from "../contexts/AuthContext";

const ExportReportModal = lazy(() =>
  import("./ExportReportModal").then((module) => ({ default: module.ExportReportModal }))
);
const HealthReportModal = lazy(() =>
  import("./HealthReportModal").then((module) => ({ default: module.HealthReportModal }))
);

export default function HomeScreen() {
  const navigate = useNavigate();
  const [showPetProfile, setShowPetProfile] = useState(false);
  const [showExportReport, setShowExportReport] = useState(false);
  const [showHealthReport, setShowHealthReport] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showPetSelector, setShowPetSelector] = useState(false);
  const [currentTab, setCurrentTab] = useState<"home" | "settings">("home");
  const [viewMode, setViewMode] = useState<"card" | "feed" | "appointments" | "medications">("card");

  // Get pet and auth data from context
  const { activePetId, setActivePetId, pets, activePet, loading: petsLoading } = usePet();
  const { user } = useAuth();

  // Handle tab change and reset viewMode to "card" when going to home tab
  const handleTabChange = (tab: "home" | "settings") => {
    setCurrentTab(tab);
    if (tab === "home") {
      setViewMode("card");
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

  // Loading state: Waiting for Firestore
  if (petsLoading && pets.length === 0) {
    return (
      <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#2b7cee] border-t-transparent"></div>
      </div>
    );
  }

  // Empty state: No pets registered
  if (pets.length === 0) {
    return (
      <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen">
        <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center space-y-6">
              <div className="size-32 mx-auto bg-[#2b7cee]/10 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-[#2b7cee]" style={{ fontSize: "64px" }}>
                  pets
                </span>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  ¡Bienvenido a PESSY!
                </h2>
                <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                  Comienza agregando tu primera mascota para llevar su historial médico completo
                </p>
              </div>
              <button
                onClick={handleAddNewPet}
                className="px-6 py-3 bg-[#2b7cee] text-white rounded-full font-semibold hover:bg-[#2563d4] transition-colors shadow-lg"
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
    return (
      <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen">
        <div className="max-w-md mx-auto min-h-screen flex items-center justify-center px-6 pb-24">
          <div className="text-center max-w-sm">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">No se pudo cargar la mascota activa</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Volvé a seleccionar una mascota para continuar.
            </p>
            <button
              onClick={() => setShowPetSelector(true)}
              className="px-5 py-3 rounded-xl bg-[#2b7cee] text-white font-bold"
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
    return (
      <>
        <UserProfileScreen onBack={() => handleTabChange("home")} />
        <BottomNav
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onAddDocument={() => setShowScanner(true)}
        />
        <DocumentScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
        />
      </>
    );
  }

  // Show Appointments Screen
  if (viewMode === "appointments") {
    return (
      <>
        <AppointmentsScreen onBack={() => setViewMode("card")} />
        <BottomNav
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onAddDocument={() => setShowScanner(true)}
        />
        <DocumentScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
        />
      </>
    );
  }

  // Show Medications Screen
  if (viewMode === "medications") {
    return (
      <>
        <MedicationsScreen onBack={() => setViewMode("card")} />
        <BottomNav
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onAddDocument={() => setShowScanner(true)}
        />
        <DocumentScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
        />
      </>
    );
  }

  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] text-slate-900 dark:text-slate-100 min-h-screen font-['Manrope',sans-serif]">
      <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
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

        {/* Card View - New Design */}
        {viewMode === "card" && (
          <>
            <PetHomeView
              userName={user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "Hola"}
              onViewHistory={() => setViewMode("feed")}
              onPetClick={() => setShowPetProfile(true)}
              onAppointmentsClick={() => setViewMode("appointments")}
              onMedicationsClick={() => setViewMode("medications")}
              pets={pets}
              activePetId={activePetId}
              onPetChange={handlePetChange}
            />
          </>
        )}

        {/* Feed View - Original Design */}
        {viewMode === "feed" && (
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
              <ActionTray />
              <Timeline
                activePet={{
                  name: activePet.name,
                  photo: activePet.photo
                }}
                onExportReport={() => setShowExportReport(true)}
              />
              <MonthSummary />
            </main>
          </>
        )}
      </div>

      {/* Bottom Navigation with Add Document button */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onAddDocument={() => setShowScanner(true)}
      />

      {/* Modals */}
      <PetProfileModal
        isOpen={showPetProfile}
        onClose={() => setShowPetProfile(false)}
      />
      <Suspense fallback={null}>
        <ExportReportModal
          isOpen={showExportReport}
          onClose={() => setShowExportReport(false)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <HealthReportModal
          isOpen={showHealthReport}
          onClose={() => setShowHealthReport(false)}
        />
      </Suspense>
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
