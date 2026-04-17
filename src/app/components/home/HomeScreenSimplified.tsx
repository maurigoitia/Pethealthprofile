import { lazy, Suspense } from "react";
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
  const { openPetSelector, openPetProfile, openScanner, openExportReport, openSidebar } =
    useAppLayout();
  const focusExperienceEnabled = isFocusExperienceHost();

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
      {/* Hamburger Menu Button */}
      <div className="fixed top-4 left-4 z-40">
        <button
          onClick={openSidebar}
          className="size-10 rounded-full bg-white dark:bg-slate-900 shadow-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:scale-110 transition-transform"
        >
          <MaterialIcon
            name="menu"
            className="text-[#074738] dark:text-emerald-400 text-xl"
          />
        </button>
      </div>

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
    </div>
  );
}
