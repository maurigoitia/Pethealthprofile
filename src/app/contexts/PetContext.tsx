import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, arrayUnion } from "firebase/firestore";
import { useAuth } from "./AuthContext";

export interface WeightEntry {
  date: string; // ISO string
  weight: number; // kg
}

export interface Pet {
  id: string;
  name: string;
  breed: string;
  photo: string;
  species?: string;
  age?: string;
  weight?: string;
  birthDate?: string; // ISO string YYYY-MM-DD
  sex?: "male" | "female";
  isNeutered?: boolean;
  ownerId?: string;
  weightHistory?: WeightEntry[];
}

interface PetContextType {
  activePetId: string;
  setActivePetId: (id: string) => void;
  pets: Pet[];
  activePet: Pet | undefined;
  addPet: (pet: Omit<Pet, "id" | "ownerId">) => Promise<string>;
  updatePet: (id: string, updates: Partial<Pet> & { newWeightEntry?: WeightEntry }) => Promise<void>;
  loading: boolean;
}

const PetContext = createContext<PetContextType | undefined>(undefined);

export function PetProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePetId, setActivePetIdState] = useState<string>(() => {
    return localStorage.getItem("activePetId") || "";
  });

  useEffect(() => {
    // Esperar a que Firebase Auth resuelva antes de hacer cualquier query
    if (authLoading) return;

    if (!user) {
      setPets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, "pets"), where("ownerId", "==", user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedPets = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Pet));

        setPets(fetchedPets);
        setLoading(false);

        // Logic to select initial active pet if none or if current is gone
        setActivePetIdState((current) => {
          if (fetchedPets.length === 0) return "";
          if (!current || !fetchedPets.find(p => p.id === current)) {
            const firstId = fetchedPets[0].id;
            localStorage.setItem("activePetId", firstId);
            return firstId;
          }
          return current;
        });
      },
      (error) => {
        console.error("Error loading pets:", error);
        setPets([]);
        setLoading(false);
      }
    );

    // Evita spinner infinito si la suscripción se demora/falla silenciosamente.
    const safetyTimer = setTimeout(() => setLoading(false), 7000);

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [user, authLoading]);

  const setActivePetId = (id: string) => {
    setActivePetIdState(id);
    localStorage.setItem("activePetId", id);
  };

  const addPet = async (pet: Omit<Pet, "id" | "ownerId">) => {
    if (!user) throw new Error("No user logged in");

    try {
      const docRef = await addDoc(collection(db, "pets"), {
        ...pet,
        ownerId: user.uid,
        createdAt: new Date().toISOString()
      });

      // The onSnapshot listener will update the local state automatically
      return docRef.id;
    } catch (error) {
      console.error("Error adding pet:", error);
      throw error;
    }
  };

  const updatePet = async (id: string, updates: Partial<Pet> & { newWeightEntry?: WeightEntry }) => {
    try {
      const petRef = doc(db, "pets", id);
      const { newWeightEntry, ...rest } = updates;
      const payload: any = { ...rest };
      if (newWeightEntry) {
        payload.weightHistory = arrayUnion(newWeightEntry);
      }
      await updateDoc(petRef, payload);
    } catch (error) {
      console.error("Error updating pet:", error);
      throw error;
    }
  };

  const activePet = pets.find((p) => p.id === activePetId);

  return (
    <PetContext.Provider value={{ activePetId, setActivePetId, pets, activePet, addPet, updatePet, loading }}>
      {children}
    </PetContext.Provider>
  );
}

export function usePet() {
  const context = useContext(PetContext);
  if (context === undefined) {
    throw new Error("usePet must be used within a PetProvider");
  }
  return context;
}
