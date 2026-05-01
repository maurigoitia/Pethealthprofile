import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router";
import { PetHomeView } from "../pet/PetHomeView";
import { MaterialIcon } from "../shared/MaterialIcon";
import { usePet } from "../../contexts/PetContext";
import { useAuth } from "../../contexts/AuthContext";
import { usePreferences } from "../../contexts/PreferenceContext";
import { useAppLayout } from "../layout/AppLayout";
import { isFocusExperienceHost } from "../../utils/runtimeFlags";

const RandomQuestionCard = lazy(() =>
  import("../preferences/RandomQuestionCard.tsx")
);

const FocusedHomeExperience = lazy(() =>
  import("./FocusedHomeExperience.tsx").then((m) => ({
    default: m.FocusedHomeExperience,
  }))
);

const EmergencyModal = lazy(() =>
  import("../medical/EmergencyModal.tsx").then((m) => ({
    default: m.EmergencyModal,
  }))
);

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

export default function HomeScreenSimplified() {
  const navigate = useNavigate();
  const { activePetId, setActivePetId, activePet, pets } = usePet();
  const { userName, user } = useAuth();
  const { currentQuestion, answerQuestion, dismissQuestion } = usePreferences();
  const { openPetSelector, openPetProfile, openScanner, openExportReport } =
    useAppLayout();
  const focusExperienceEnabled = isFocusExperienceHost();
  const [showEmergency, setShowEmergency] = useState(false);

  const safeUserName = (() => {
    const fromContext = (userName || "").trim();
    if (fromContext) return fromContext;
    const fromDisplayName = (user?.displayName || "").trim().split(/\s+/)[0];
    if (fromDisplayName) return fromDisplayName;
    const fromEmail = (user?.email?.split("@")[0] || "").trim();
    if (fromEmail) return fromEmail;
    return "Tutor";
  })();

  // Guard: if no activePet, this shouldn't render (AppLayout handles it)
  if (!activePet) return null;

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
      {/* Desktop warning */}

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
            onPetClick={openPetSelector}
            onOpenFeed={() => navigate("/historial")}
            onOpenAppointments={() => navigate("/turnos")}
            onOpenMedications={() => navigate("/tratamientos")}
            onOpenScanner={openScanner}
            onExportReport={openExportReport}
          />
        </Suspense>
      ) : (
        <>
          <PetHomeView
            userName={safeUserName}
            onViewHistory={() => navigate("/historial")}
            onProfileClick={openPetProfile}
            onPetClick={openPetSelector}
            onAppointmentsClick={() => navigate("/turnos")}
            onMedicationsClick={() => navigate("/tratamientos")}
            pets={pets}
            activePetId={activePetId}
            onPetChange={setActivePetId}
          />
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

      {/* EMERGENCY CARD (Rule 14) - Plano Tokens: bg-[#FEF2F2] border-[#FCA5A5] text-[#B91C1C] */}
      <div className="px-4 mt-4">
        <button
          onClick={() => setShowEmergency(true)}
          className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] text-left transition-all active:scale-[0.98]"
        >
          <div className="size-10 rounded-xl bg-white border border-[#FCA5A5] flex items-center justify-center shrink-0">
            <MaterialIcon name="warning" className="text-[#B91C1C] text-xl" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#B91C1C]">
              ¿Pasó algo?
            </p>
            <p className="text-xs text-[#B91C1C]/70 mt-0.5">
              Registrá un incidente o emergencia ahora
            </p>
          </div>
          <MaterialIcon name="chevron_right" className="text-[#B91C1C]/50" />
        </button>
      </div>

      {/* Emergency modal */}
      {showEmergency && (
        <Suspense fallback={null}>
          <EmergencyModal
            isOpen={showEmergency}
            onClose={() => setShowEmergency(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
