import { RouterProvider } from "react-router";
import { router } from "./routes";
import { PetProvider } from "./contexts/PetContext";
import { MedicalProvider } from "./contexts/MedicalContext";

export default function App() {
  return (
    <PetProvider>
      <MedicalProvider>
        <RouterProvider router={router} />
      </MedicalProvider>
    </PetProvider>
  );
}