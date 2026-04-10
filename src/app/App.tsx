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
import { AppErrorBoundary } from "./components/shared/AppErrorBoundary";
import { OfflineBanner } from "./components/shared/OfflineBanner";

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <PetProvider>
          <MedicalProvider>
            <NotificationProvider>
              <RemindersProvider>
                <PreferenceProvider>
                  <GamificationProvider>
                    <OfflineBanner />
                    <RouterProvider router={router} />
                    <Toaster position="top-center" richColors />
                  </GamificationProvider>
                </PreferenceProvider>
              </RemindersProvider>
            </NotificationProvider>
          </MedicalProvider>
        </PetProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
