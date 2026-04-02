/**
 * AppEntryGate — Splash + Onboarding wrapper
 *
 * Shows on cold start:
 * 1. SplashScreen (2.2s branded loading)
 * 2. OnboardingSlides (only first visit — stored in localStorage)
 * 3. Then renders children (login/app)
 *
 * Subsequent visits skip onboarding.
 * Splash always shows briefly for brand presence.
 */
import { useState, useCallback } from "react";
import { SplashScreen } from "./SplashScreen";
import { OnboardingSlides } from "./OnboardingSlides";

const ONBOARDING_KEY = "pessy_onboarding_completed";

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

type Phase = "splash" | "onboarding" | "ready";

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

  const handleOnboardingComplete = useCallback(() => {
    markOnboardingComplete();
    setPhase("ready");
  }, []);

  return (
    <>
      {phase === "splash" && <SplashScreen onFinish={handleSplashFinish} />}
      {phase === "onboarding" && <OnboardingSlides onComplete={handleOnboardingComplete} />}
      {/* Always render children behind — splash/onboarding overlay via fixed positioning */}
      {phase === "ready" ? children : null}
    </>
  );
}
