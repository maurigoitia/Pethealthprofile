import { useState } from "react";
import { Header } from "./Header";
import { ActionTray } from "./ActionTray";
import { Timeline } from "./Timeline";
import { MonthSummary } from "./MonthSummary";
import { PetProfileModal } from "./PetProfileModal";
import { ExportReportModal } from "./ExportReportModal";
import { DocumentScannerModal } from "./DocumentScannerModal";
import { BottomNav } from "./BottomNav";
import { UserProfileScreen } from "./UserProfileScreen";
import { PetSelectorModal } from "./PetSelectorModal";
import { MaterialIcon } from "./MaterialIcon";
import { PetHomeView } from "./PetHomeView";
import { AppointmentsScreen } from "./AppointmentsScreen";
import { MedicationsScreen } from "./MedicationsScreen";
import { HealthReportModal } from "./HealthReportModal";
import { usePet } from "../contexts/PetContext";

export default function HomeScreen() {
  const [showPetProfile, setShowPetProfile] = useState(false);
  const [showExportReport, setShowExportReport] = useState(false);
  const [showHealthReport, setShowHealthReport] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showPetSelector, setShowPetSelector] = useState(false);
  const [currentTab, setCurrentTab] = useState<"home" | "settings">("home");
  const [viewMode, setViewMode] = useState<"card" | "feed" | "appointments" | "medications">("card");

  // Get pet data from context
  const { activePetId, setActivePetId, pets, activePet } = usePet();

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
    // TODO: Open modal to add new pet
    alert("Agregar nueva mascota - To be implemented");
  };

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
              userName="Diego"
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
                onExportReport={() => setShowHealthReport(true)}
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
      <ExportReportModal
        isOpen={showExportReport}
        onClose={() => setShowExportReport(false)}
      />
      <HealthReportModal
        isOpen={showHealthReport}
        onClose={() => setShowHealthReport(false)}
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