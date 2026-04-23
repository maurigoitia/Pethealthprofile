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
  const auth = useAuth();
  const { currentQuestion, answerQuestion, dismissQuestion } = usePreferences();
  const { openPetSelector, openPetProfile, openScanner, openExportReport, openSidebar } =
    useAppLayout();
  const focusExperienceEnabled = isFocusExperienceHost();

  // safeUserName: resolución explícita, sin IIFE (el minifier de Safari
  // interpretaba mal el closure del IIFE → 'Can't find variable: userName')
  const ctxName = typeof auth?.userName === "string" ? auth.userName.trim() : "";
  const displayName = typeof auth?.user?.displayName === "string"
    ? auth.user.displayName.trim().split(/\s+/)[0]
    : "";
  const emailName = typeof auth?.user?.email === "string"
    ? auth.user.email.split("@")[0].trim()
    : "";
  const safeUserName = ctxName || displayName || emailName || "Tutor";
  const user = auth?.user;

  // Guard: if no activePet, this shouldn't render (AppLayout handles it)
  if (!activePet) return null;

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
      {/* Hamburger removido — tapaba avatar del HomeHeaderV2. El sidebar se
          accede desde el Bell del header v2 o desde Perfil. */}

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
