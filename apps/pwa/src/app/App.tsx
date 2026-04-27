import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { router } from "./routesV2.tsx";
import { PetProvider } from "./contexts/PetContext";
import { MedicalProvider } from "./contexts/MedicalContext";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { RemindersProvider } from "./contexts/RemindersContext";
import { PreferenceProvider } from "./contexts/PreferenceContext";
import { GamificationProvider } from "./contexts/GamificationContext";
import { AppErrorBoundary } from "./components/shared/AppErrorBoundary";
import { OfflineBanner } from "./components/shared/OfflineBanner";

// Fallback visible durante carga inicial de rutas lazy (AppLayout, pantallas)
function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0FAF9]">
      <div className="size-10 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      {/* Skip navigation — keyboard users bypass repetitive nav ───── */}
      <a href="#main-content" className="pessy-skip-link">
        Ir al contenido principal
      </a>
      <AuthProvider>
        <PetProvider>
          <MedicalProvider>
            <NotificationProvider>
              <RemindersProvider>
                <PreferenceProvider>
                  <GamificationProvider>
                    <OfflineBanner />
                    <RouterProvider router={router} fallbackElement={<RouteLoader />} />
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
