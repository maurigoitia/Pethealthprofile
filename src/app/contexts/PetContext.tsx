import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface Pet {
  id: string;
  name: string;
  breed: string;
  photo: string;
  species?: string;
  age?: string;
  weight?: string;
  sex?: "male" | "female";
  isNeutered?: boolean;
}

interface PetContextType {
  activePetId: string;
  setActivePetId: (id: string) => void;
  pets: Pet[];
  activePet: Pet | undefined;
  addPet: (pet: Pet) => void;
}

const PetContext = createContext<PetContextType | undefined>(undefined);

export function PetProvider({ children }: { children: ReactNode }) {
  // Initialize pets from localStorage or use mock data
  const [pets, setPets] = useState<Pet[]>(() => {
    const stored = localStorage.getItem("pessy_pets");
    if (stored) {
      return JSON.parse(stored);
    }
    // Return empty array for "clean slate" onboarding
    return [];
  });

  // Initialize from localStorage or default to first pet
  const [activePetId, setActivePetIdState] = useState<string>(() => {
    const stored = localStorage.getItem("activePetId");
    return stored && pets.find((p) => p.id === stored) ? stored : (pets[0]?.id || "");
  });

  // Persist pets to localStorage
  useEffect(() => {
    localStorage.setItem("pessy_pets", JSON.stringify(pets));
  }, [pets]);

  // Persist activePetId to localStorage whenever it changes
  useEffect(() => {
    if (activePetId) {
      localStorage.setItem("activePetId", activePetId);
    }
  }, [activePetId]);

  const activePet = pets.find((p) => p.id === activePetId);

  const setActivePetId = (id: string) => {
    setActivePetIdState(id);
  };

  const addPet = (pet: Pet) => {
    setPets((prev) => [...prev, pet]);
    setActivePetId(pet.id); // Auto-select the newly added pet
  };

  return (
    <PetContext.Provider
      value={{
        activePetId,
        setActivePetId,
        pets,
        activePet,
        addPet,
      }}
    >
      {children}
    </PetContext.Provider>
  );
}

export function usePet() {
  const context = useContext(PetContext);
  if (!context) {
    throw new Error("usePet must be used within PetProvider");
  }
  return context;
}