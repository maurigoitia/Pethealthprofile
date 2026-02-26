import { RouterProvider } from "react-router";
import { router } from "./routes.tsx";
import { PetProvider } from "./contexts/PetContext";
import { MedicalProvider } from "./contexts/MedicalContext";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { RemindersProvider } from "./contexts/RemindersContext";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <PetProvider>
          <MedicalProvider>
            <NotificationProvider>
              <RemindersProvider>
                <RouterProvider router={router} />
              </RemindersProvider>
            </NotificationProvider>
          </MedicalProvider>
        </PetProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
