import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router";
import { PetHomeView } from "../pet/PetHomeView";
import { MaterialIcon } from "../shared/MaterialIcon";
import { usePet } from "../../contexts/PetContext";
import { useAuth } from "../../contexts/AuthContext";
import { usePreferences } from "../../contexts/PreferenceContext";
import { useAppLayout } from "../layout/AppLayout";
import { isFocusExperienceHost } from "../../utils/runtimeFlags";

// Emergency / "Pasó algo" — incident logger. Lazy-loaded to keep this
// home chunk small. The runtime live home (HomeScreenSimplified) mounts
// it directly — see docs/RUNTIME.md for why this is the live path.
const EmergencyModal = lazy(() =>
  import("../medical/EmergencyModal.tsx").then((m) => ({
    default: m.EmergencyModal,
  })),
);

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
  const [showEmergency, setShowEmergency] = useState(false);

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

  // Guard: sin mascota activa, mostrar onboarding en vez de pantalla blanca
  if (!activePet) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center px-6 bg-[#F0FAF9]">
        <div className="w-20 h-20 rounded-[20px] bg-[#E0F2F1] flex items-center justify-center mb-6">
          <MaterialIcon name="pets" className="text-5xl text-[#074738]" />
        </div>
        <h1
          className="text-2xl font-extrabold text-[#074738] mb-2 text-center"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Hola {safeUserName}
        </h1>
        <p
          className="text-sm text-slate-500 text-center mb-8 max-w-xs"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Todavía no agregaste una mascota. Empecemos por ahí.
        </p>
        <button
          type="button"
          onClick={() => navigate("/register-pet")}
          className="w-full max-w-xs px-6 py-4 rounded-[14px] bg-[#074738] text-white text-sm font-bold active:scale-[0.97] transition-transform shadow-[0_2px_8px_rgba(7,71,56,0.2)]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Agregar mascota
        </button>
        {pets.length === 0 && user?.email && (
          <button
            type="button"
            onClick={() => auth?.logout?.()}
            className="mt-4 text-xs text-slate-400 font-medium hover:text-slate-600 transition-colors"
          >
            Cerrar sesión
          </button>
        )}
      </div>
    );
  }

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

      {/* Pasó algo — emergency incident quick-log.
          Tutor-confirmed observation. No AI. No diagnosis. Saved as a
          medical_event with documentType="incident", source="tutor_input".
          Visible across both Home variants (focus-experience + classic). */}
      <div className="px-4 mt-4">
        <button
          type="button"
          onClick={() => setShowEmergency(true)}
          className="w-full p-4 rounded-[16px] bg-[#FEF2F2] border border-[#FCA5A5] text-[#B91C1C] flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
        >
          <div
            className="size-11 rounded-[12px] bg-white/70 flex items-center justify-center shrink-0 text-2xl"
            aria-hidden
          >
            ⚠️
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-base leading-tight">Pasó algo</p>
            <p className="text-xs text-[#B91C1C]/80 leading-snug mt-0.5">
              Anotá rápido lo que viste, con foto si querés.
            </p>
          </div>
          <MaterialIcon name="chevron_right" className="text-2xl shrink-0" />
        </button>
      </div>

      <Suspense fallback={null}>
        <EmergencyModal
          isOpen={showEmergency}
          onClose={() => setShowEmergency(false)}
        />
      </Suspense>
    </div>
  );
}
