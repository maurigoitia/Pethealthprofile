import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { db } from "../../lib/firebase";
import {
  collection, query, where, onSnapshot, doc, updateDoc, addDoc, arrayUnion, setDoc, getDoc, deleteDoc
} from "firebase/firestore";
import { useAuth } from "./AuthContext";

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface CoTutor {
  uid: string;
  email?: string;
  name?: string;
  addedAt: string;
}

export interface Pet {
  id: string;
  name: string;
  breed: string;
  photo: string;
  species?: string;
  age?: string;
  weight?: string;
  birthDate?: string;
  sex?: "male" | "female";
  isNeutered?: boolean;
  ownerId?: string;
  weightHistory?: WeightEntry[];
  coTutors?: CoTutor[];
}

interface PetContextType {
  activePetId: string;
  setActivePetId: (id: string) => void;
  pets: Pet[];
  activePet: Pet | undefined;
  addPet: (pet: Omit<Pet, "id" | "ownerId">) => Promise<string>;
  updatePet: (id: string, updates: Partial<Pet> & { newWeightEntry?: WeightEntry }) => Promise<void>;
  loading: boolean;
  // Co-tutores
  generateInviteCode: (petId: string) => Promise<string>;
  joinWithCode: (code: string) => Promise<{ petName: string }>;
  removeCoTutor: (petId: string, coTutorUid: string) => Promise<void>;
  leaveAsTutor: (petId: string) => Promise<void>;
  isOwner: (pet: Pet) => boolean;
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
    if (authLoading) return;
    if (!user) {
      setPets([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Query 1: mascotas donde soy dueño
    const qOwner = query(collection(db, "pets"), where("ownerId", "==", user.uid));
    // Query 2: mascotas donde soy co-tutor
    const qCoTutor = query(collection(db, "pets"), where("coTutors", "array-contains", { uid: user.uid }));

    const allPetsMap = new Map<string, Pet>();

    const merge = () => {
      const merged = Array.from(allPetsMap.values());
      setPets(merged);
      setLoading(false);
      setActivePetIdState((current) => {
        if (merged.length === 0) return "";
        if (!current || !merged.find(p => p.id === current)) {
          const firstId = merged[0].id;
          localStorage.setItem("activePetId", firstId);
          return firstId;
        }
        return current;
      });
    };

    const unsubOwner = onSnapshot(qOwner, (snap) => {
      snap.docs.forEach(d => allPetsMap.set(d.id, { id: d.id, ...d.data() } as Pet));
      // Eliminar las que ya no están
      snap.docChanges().filter(c => c.type === "removed").forEach(c => allPetsMap.delete(c.doc.id));
      merge();
    }, (err) => { console.error("Error pets owner:", err); setLoading(false); });

    // Co-tutor query: Firestore no soporta array-contains con objetos parciales,
    // usamos campo plano coTutorUids para la query
    const qCoTutorFlat = query(collection(db, "pets"), where("coTutorUids", "array-contains", user.uid));
    const unsubCoTutor = onSnapshot(qCoTutorFlat, (snap) => {
      snap.docs.forEach(d => allPetsMap.set(d.id, { id: d.id, ...d.data() } as Pet));
      snap.docChanges().filter(c => c.type === "removed").forEach(c => {
        // Solo eliminar si tampoco soy owner
        const pet = allPetsMap.get(c.doc.id);
        if (pet && pet.ownerId !== user.uid) allPetsMap.delete(c.doc.id);
      });
      merge();
    }, (err) => { console.error("Error pets cotutor:", err); });

    const safetyTimer = setTimeout(() => setLoading(false), 7000);
    return () => {
      clearTimeout(safetyTimer);
      unsubOwner();
      unsubCoTutor();
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
        coTutors: [],
        coTutorUids: [],
        createdAt: new Date().toISOString()
      });
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

  // Genera un código de 6 caracteres y lo guarda en Firestore con 48hs de vida
  const generateInviteCode = async (petId: string): Promise<string> => {
    if (!user) throw new Error("No user logged in");
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await setDoc(doc(db, "invitations", code), {
      petId,
      createdBy: user.uid,
      expiresAt,
      used: false,
    });
    return code;
  };

  // El co-tutor ingresa el código y se agrega a la mascota
  const joinWithCode = async (code: string): Promise<{ petName: string }> => {
    if (!user) throw new Error("No user logged in");
    const invRef = doc(db, "invitations", code.toUpperCase().trim());
    const invSnap = await getDoc(invRef);
    if (!invSnap.exists()) throw new Error("Código inválido o expirado");

    const inv = invSnap.data();
    if (inv.used) throw new Error("Este código ya fue utilizado");
    if (new Date(inv.expiresAt) < new Date()) throw new Error("El código expiró");
    if (inv.createdBy === user.uid) throw new Error("No podés unirte a tu propia mascota con un código");

    const petRef = doc(db, "pets", inv.petId);
    const petSnap = await getDoc(petRef);
    if (!petSnap.exists()) throw new Error("Mascota no encontrada");

    const petData = petSnap.data();
    const existingUids: string[] = petData.coTutorUids || [];
    if (existingUids.includes(user.uid)) throw new Error("Ya sos co-tutor de esta mascota");

    const newCoTutor: CoTutor = {
      uid: user.uid,
      email: user.email || "",
      name: user.displayName || user.email || "",
      addedAt: new Date().toISOString(),
    };

    await updateDoc(petRef, {
      coTutors: arrayUnion(newCoTutor),
      coTutorUids: arrayUnion(user.uid),
    });

    // Marcar código como usado
    await updateDoc(invRef, { used: true, usedBy: user.uid, usedAt: new Date().toISOString() });

    return { petName: petData.name };
  };

  // El dueño elimina un co-tutor
  const removeCoTutor = async (petId: string, coTutorUid: string) => {
    const petRef = doc(db, "pets", petId);
    const petSnap = await getDoc(petRef);
    if (!petSnap.exists()) return;
    const petData = petSnap.data();
    const updatedCoTutors = (petData.coTutors || []).filter((ct: CoTutor) => ct.uid !== coTutorUid);
    const updatedUids = (petData.coTutorUids || []).filter((uid: string) => uid !== coTutorUid);
    await updateDoc(petRef, { coTutors: updatedCoTutors, coTutorUids: updatedUids });
  };

  // El co-tutor se va por su cuenta
  const leaveAsTutor = async (petId: string) => {
    if (!user) return;
    await removeCoTutor(petId, user.uid);
  };

  const isOwner = (pet: Pet) => pet.ownerId === user?.uid;

  const activePet = pets.find((p) => p.id === activePetId);

  return (
    <PetContext.Provider value={{
      activePetId, setActivePetId, pets, activePet, addPet, updatePet, loading,
      generateInviteCode, joinWithCode, removeCoTutor, leaveAsTutor, isOwner,
    }}>
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
