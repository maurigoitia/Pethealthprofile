import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { router } from "./routes.tsx";
import { PetProvider } from "./contexts/PetContext";
import { MedicalProvider } from "./contexts/MedicalContext";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { RemindersProvider } from "./contexts/RemindersContext";
import { PreferenceProvider } from "./contexts/PreferenceContext";
import { GamificationProvider } from "./contexts/GamificationContext";
import { WalkProvider } from "./contexts/WalkContext";
import { AppErrorBoundary } from "./components/shared/AppErrorBoundary";
import { AppEntryGate } from "./components/onboarding/AppEntryGate";

export default function App() {
  return (
    <AppErrorBoundary>
      <AppEntryGate>
        <AuthProvider>
          <PetProvider>
            <MedicalProvider>
              <NotificationProvider>
                <RemindersProvider>
                  <PreferenceProvider>
                    <GamificationProvider>
                      <WalkProvider>
                        <RouterProvider router={router} />
                        <Toaster position="top-center" richColors />
                      </WalkProvider>
                    </GamificationProvider>
                  </PreferenceProvider>
                </RemindersProvider>
              </NotificationProvider>
            </MedicalProvider>
          </PetProvider>
        </AuthProvider>
      </AppEntryGate>
    </AppErrorBoundary>
  );
}
