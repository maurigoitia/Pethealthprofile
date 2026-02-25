import { RouterProvider } from "react-router";
import { router } from "./routes";
import { PetProvider } from "./contexts/PetContext";
import { MedicalProvider } from "./contexts/MedicalContext";
import { AuthProvider } from "./contexts/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <PetProvider>
        <MedicalProvider>
          <RouterProvider router={router} />
        </MedicalProvider>
      </PetProvider>
    </AuthProvider>
  );
}