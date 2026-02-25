import { RouterProvider } from "react-router";
import { router } from "./routes.tsx";
import { PetProvider } from "./contexts/PetContext";
import { MedicalProvider } from "./contexts/MedicalContext";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";

export default function App() {
  return (
    <AuthProvider>
      <PetProvider>
        <MedicalProvider>
          <NotificationProvider>
            <RouterProvider router={router} />
          </NotificationProvider>
        </MedicalProvider>
      </PetProvider>
    </AuthProvider>
  );
}