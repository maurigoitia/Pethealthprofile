import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface Pet {
  id: string;
  name: string;
  breed: string;
  photo: string;
}

interface PetContextType {
  activePetId: string;
  setActivePetId: (id: string) => void;
  pets: Pet[];
  activePet: Pet;
}

const PetContext = createContext<PetContextType | undefined>(undefined);

export function PetProvider({ children }: { children: ReactNode }) {
  // Mock pets data
  const pets: Pet[] = [
    {
      id: "pet-1",
      name: "Bruno",
      breed: "Golden Retriever",
      photo: "https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=400&h=400&fit=crop",
    },
    {
      id: "pet-2",
      name: "Rocky",
      breed: "Bulldog Francés",
      photo: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=400&fit=crop",
    },
  ];

  // Initialize from localStorage or default to first pet
  const [activePetId, setActivePetIdState] = useState<string>(() => {
    const stored = localStorage.getItem("activePetId");
    return stored && pets.find((p) => p.id === stored) ? stored : pets[0].id;
  });

  // Persist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("activePetId", activePetId);
  }, [activePetId]);

  const activePet = pets.find((p) => p.id === activePetId) || pets[0];

  const setActivePetId = (id: string) => {
    setActivePetIdState(id);
  };

  return (
    <PetContext.Provider
      value={{
        activePetId,
        setActivePetId,
        pets,
        activePet,
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
