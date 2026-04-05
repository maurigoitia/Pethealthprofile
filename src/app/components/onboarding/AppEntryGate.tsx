/**
 * AppEntryGate — Splash + Onboarding wrapper
 *
 * Shows on cold start:
 * 1. SplashScreen (2.2s branded loading)
 * 2. OnboardingSlides (only first visit — stored in localStorage)
 * 3. OnboardingPetRegister (collect pet info pre-auth, saved as draft)
 * 4. Then renders children (login/app)
 *
 * Subsequent visits skip onboarding.
 * Splash always shows briefly for brand presence.
 */
import { useState, useCallback } from "react";
import { SplashScreen } from "./SplashScreen";
import { OnboardingSlides } from "./OnboardingSlides";
import { OnboardingPetRegister, type PetRegisterData } from "./OnboardingPetRegister";

const ONBOARDING_KEY = "pessy_onboarding_completed";
export const ONBOARDING_PET_DRAFT_KEY = "pessy_onboarding_pet_draft";

function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "true";
  } catch {
    return false;
  }
}

function markOnboardingComplete(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, "true");
  } catch {
    // Storage unavailable — onboarding will show again next time
  }
}

function savePetDraft(data: PetRegisterData): void {
  try {
    // Save everything except the File (not serializable)
    const draft = {
      name: data.name,
      species: data.species,
      breed: data.breed,
      birthdate: data.birthdate,
      sex: data.sex,
      isNeutered: data.isNeutered,
    };
    localStorage.setItem(ONBOARDING_PET_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // noop
  }
}

type Phase = "splash" | "onboarding" | "pet-register" | "ready";

interface AppEntryGateProps {
  children: React.ReactNode;
}

export function AppEntryGate({ children }: AppEntryGateProps) {
  const [phase, setPhase] = useState<Phase>("splash");

  const handleSplashFinish = useCallback(() => {
    if (hasCompletedOnboarding()) {
      setPhase("ready");
    } else {
      setPhase("onboarding");
    }
  }, []);

  const handleSlidesComplete = useCallback(() => {
    setPhase("pet-register");
  }, []);

  const handlePetRegisterComplete = useCallback((petData: PetRegisterData) => {
    savePetDraft(petData);
    markOnboardingComplete();
    setPhase("ready");
  }, []);

  const handlePetRegisterSkip = useCallback(() => {
    markOnboardingComplete();
    setPhase("ready");
  }, []);

  return (
    <>
      {phase === "splash" && <SplashScreen onFinish={handleSplashFinish} />}
      {phase === "onboarding" && <OnboardingSlides onComplete={handleSlidesComplete} />}
      {phase === "pet-register" && (
        <OnboardingPetRegister
          onComplete={handlePetRegisterComplete}
          onSkip={handlePetRegisterSkip}
        />
      )}
      {/* Always render children behind — splash/onboarding overlay via fixed positioning */}
      {phase === "ready" ? children : null}
    </>
  );
}
