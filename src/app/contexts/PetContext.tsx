import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { auth, db, functions } from "../../lib/firebase";
import {
  collection, query, where, onSnapshot, doc, updateDoc, addDoc, arrayUnion, setDoc, getDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "./AuthContext";
import { buildCoTutorReferralUrl } from "../utils/coTutorInvite";
import { isFocusHistoryExperimentHost } from "../utils/runtimeFlags";

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

export type BirthDatePrecision = "exact" | "month" | "year" | "unknown";

export interface PetPreferences {
  // Gustos del tutor y la mascota
  favoriteActivities?: ("walk" | "park" | "cafe" | "beach" | "hiking" | "playdate" | "training" | "swim")[];
  favoritePlaces?: string[]; // nombres o place_ids de Google Places
  walkTimes?: string[]; // horarios preferidos "08:00", "18:00"
  foodBrand?: string;
  foodType?: "balanced" | "barf" | "mixed";
  foodBagKg?: number; // kg de la bolsa actual
  foodDailyGrams?: number; // consumo diario estimado
  foodLastPurchase?: string; // ISO date
  allergies?: string[];
  fears?: string[]; // truenos, fuegos artificiales, otros perros, etc.
  personality?: ("calm" | "energetic" | "shy" | "social" | "independent" | "playful" | "protective")[];
  notes?: string;
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
  birthDatePrecision?: BirthDatePrecision;
  sex?: "male" | "female";
  isNeutered?: boolean;
  ownerId?: string;
  weightHistory?: WeightEntry[];
  coTutors?: CoTutor[];
  coTutorUids?: string[];
  preferences?: PetPreferences;
}

interface PetContextType {
  activePetId: string;
  setActivePetId: (id: string) => void;
  pets: Pet[];
  activePet: Pet | undefined;
  addPet: (pet: Omit<Pet, "id" | "ownerId">) => Promise<string>;
  updatePet: (id: string, updates: Partial<Pet> & { newWeightEntry?: WeightEntry }) => Promise<void>;
  loading: boolean;
  generateInviteCode: (petId: string, inviteEmail?: string) => Promise<string>;
  sendCoTutorInviteEmail: (petId: string, email: string) => Promise<{ code: string; inviteLink: string }>;
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

    // Mapa compartido entre los dos listeners
    const allPetsMap = new Map<string, Pet>();

    // Flags para saber cuándo ambos queries ya respondieron al menos una vez
    const resolved = { owner: false, cotutor: false };

    const merge = () => {
      // Solo terminar loading cuando ambos queries hayan respondido
      const bothReady = resolved.owner && resolved.cotutor;
      const mergedRaw = Array.from(allPetsMap.values());
      const useMauriSandbox =
        isFocusHistoryExperimentHost() &&
        (user?.email || "").trim().toLowerCase() === "mauriciogoitia@gmail.com";
      const merged =
        useMauriSandbox
          ? (() => {
              const thorOnly = mergedRaw.filter((pet) => (pet.name || "").trim().toLowerCase() === "thor");
              return thorOnly.length > 0 ? thorOnly : mergedRaw;
            })()
          : mergedRaw;
      setPets(merged);
      if (bothReady) {
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
      }
    };

    // Query 1: mascotas donde soy dueño
    const qOwner = query(collection(db, "pets"), where("ownerId", "==", user.uid));
    const unsubOwner = onSnapshot(qOwner, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === "removed") {
          allPetsMap.delete(change.doc.id);
        } else {
          const data = change.doc.data();
          // Auto-migrar mascotas viejas que no tienen coTutorUids
          if (!data.coTutorUids) {
            updateDoc(doc(db, "pets", change.doc.id), { coTutors: [], coTutorUids: [] }).catch(() => {});
          }
          allPetsMap.set(change.doc.id, { id: change.doc.id, ...data } as Pet);
        }
      });
      resolved.owner = true;
      merge();
    }, (err) => {
      console.error("Error query owner pets:", err);
      resolved.owner = true; // marcar igualmente para no bloquear UI
      merge();
    });

    // Query 2: mascotas donde soy co-tutor (usa campo plano coTutorUids)
    const qCoTutor = query(collection(db, "pets"), where("coTutorUids", "array-contains", user.uid));
    const unsubCoTutor = onSnapshot(qCoTutor, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === "removed") {
          // Solo eliminar si tampoco soy owner
          const existing = allPetsMap.get(change.doc.id);
          if (existing && existing.ownerId !== user.uid) {
            allPetsMap.delete(change.doc.id);
          }
        } else {
          // No sobreescribir si ya está (el owner query tiene más info actualizada)
          if (!allPetsMap.has(change.doc.id)) {
            allPetsMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() } as Pet);
          }
        }
      });
      resolved.cotutor = true;
      merge();
    }, (err) => {
      // Algunos proyectos tienen reglas que bloquean list por coTutorUids.
      // No rompemos la app del owner principal por ese fallback.
      const code = (err as any)?.code || "";
      if (code !== "permission-denied" && code !== "firestore/permission-denied") {
        console.error("Error query cotutor pets:", err);
      }
      resolved.cotutor = true; // marcar igualmente para no bloquear UI
      merge();
    });

    // Safety timeout: si algo falla, desbloquear UI igual
    const safetyTimer = setTimeout(() => {
      resolved.owner = true;
      resolved.cotutor = true;
      merge();
    }, 6000);

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
    const docRef = await addDoc(collection(db, "pets"), {
      ...pet,
      ownerId: user.uid,
      coTutors: [],
      coTutorUids: [],
      createdAt: new Date().toISOString(),
    });
    // Al crear una mascota nueva, se selecciona automáticamente como activa.
    setActivePetIdState(docRef.id);
    localStorage.setItem("activePetId", docRef.id);
    return docRef.id;
  };

  const updatePet = async (id: string, updates: Partial<Pet> & { newWeightEntry?: WeightEntry }) => {
    const petRef = doc(db, "pets", id);
    const { newWeightEntry, ...rest } = updates;
    const payload: any = { ...rest };
    if (newWeightEntry) {
      payload.weightHistory = arrayUnion(newWeightEntry);
    }
    await updateDoc(petRef, payload);
  };

  const generateInviteCode = async (petId: string, inviteEmail?: string): Promise<string> => {
    if (!user) throw new Error("No user logged in");
    const petRef = doc(db, "pets", petId);
    const petSnap = await getDoc(petRef);
    if (!petSnap.exists()) throw new Error("Mascota no encontrada");
    const petData = petSnap.data();
    if (petData.ownerId !== user.uid) throw new Error("Solo el dueño puede invitar co-tutores");

    const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = Array.from(bytes, (b) => CHARSET[b % 36]).join("");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await setDoc(doc(db, "invitations", code), {
      petId,
      petName: petData.name || "Mascota",
      createdBy: user.uid,
      inviteEmail: inviteEmail ? inviteEmail.trim().toLowerCase() : null,
      sendMethod: inviteEmail ? "email_magic_link" : "manual_code",
      expiresAt,
      used: false,
      createdAt: new Date(),
    });
    return code;
  };

  const sendCoTutorInviteEmail = async (petId: string, email: string): Promise<{ code: string; inviteLink: string }> => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new Error("Ingresá un email válido.");
    }
    if (normalizedEmail === (user?.email || "").trim().toLowerCase()) {
      throw new Error("No podés invitarte a vos mismo.");
    }

    // Obtener nombre de la mascota para el email
    const petDoc = await getDoc(doc(db, "pets", petId));
    const petName = petDoc.exists() ? (petDoc.data().name as string) || "tu mascota" : "tu mascota";

    const code = await generateInviteCode(petId, normalizedEmail);
    const inviteLink = buildCoTutorReferralUrl(code);

    // Envío vía Cloud Function (Resend) — timeout 30s para evitar spinner infinito
    const callSendInvite = httpsCallable(functions, "sendCoTutorInvite", { timeout: 30000 });
    try {
      await callSendInvite({ email: normalizedEmail, inviteCode: code, petName });
    } catch (err: any) {
      // Firebase HttpsError: el mensaje real puede estar en err.details
      const detail = err?.details?.message || err?.details || "";
      const msg = (typeof detail === "string" && detail.length > 3) ? detail : err?.message || "";
      const fallback = "No se pudo enviar el correo de invitación. Intentá de nuevo.";
      throw new Error((msg && msg !== "internal" && msg !== "INTERNAL") ? msg : fallback);
    }

    return { code, inviteLink };
  };

  const joinWithCode = async (code: string): Promise<{ petName: string }> => {
    const currentUser = user || auth.currentUser;
    if (!currentUser) throw new Error("No user logged in");
    const normalizedCode = code.toUpperCase().trim();
    const invRef = doc(db, "invitations", normalizedCode);
    const invSnap = await getDoc(invRef);
    if (!invSnap.exists()) throw new Error("Código inválido o expirado");

    const inv = invSnap.data();
    const currentUserEmail = (currentUser.email || "").trim().toLowerCase();
    const inviteEmail = (inv.inviteEmail || "").trim().toLowerCase();
    if (inviteEmail && inviteEmail !== currentUserEmail) {
      throw new Error("Este código fue emitido para otro correo.");
    }
    if (inv.used) {
      if (inv.usedBy === currentUser.uid) {
        return { petName: inv.petName || "la mascota" };
      }
      throw new Error("Este código ya fue utilizado");
    }
    const expiresAt =
      typeof inv.expiresAt?.toDate === "function"
        ? inv.expiresAt.toDate()
        : new Date(inv.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt < new Date()) {
      throw new Error("El código expiró");
    }
    if (inv.createdBy === currentUser.uid) throw new Error("No podés unirte a tu propia mascota con un código");

    const petRef = doc(db, "pets", inv.petId);

    // BUG-003 FIX: NO usar runTransaction para ambos writes juntos.
    // Las Security Rules de invitaciones hacen get(pet) para verificar que el uid ya esté en
    // coTutorUids — ese get() ve el estado PRE-transacción, por lo que si el pet update y el
    // invite update van en la misma transacción, el get() siempre ve coTutorUids sin el usuario
    // nuevo → PERMISSION_DENIED.
    // Solución: escribir el pet primero (commit), luego marcar la invitación como usada.
    const petSnap = await getDoc(petRef);
    if (!petSnap.exists()) throw new Error("La mascota ya no está disponible");
    const petData = petSnap.data();
    const currentCoTutorUids: string[] = Array.isArray(petData.coTutorUids) ? petData.coTutorUids : [];
    const currentCoTutors: CoTutor[] = Array.isArray(petData.coTutors) ? petData.coTutors : [];

    if (petData.ownerId === currentUser.uid) {
      throw new Error("Ya sos tutor principal de esta mascota.");
    }

    const petName = inv.petName || petData.name || "la mascota";
    const alreadyJoined = currentCoTutorUids.includes(currentUser.uid);

    if (!alreadyJoined) {
      const newCoTutor: CoTutor = {
        uid: currentUser.uid,
        email: currentUser.email || "",
        name: currentUser.displayName || currentUser.email || "",
        addedAt: new Date().toISOString(),
      };
      const nextCoTutorUids = [...currentCoTutorUids, currentUser.uid];
      const nextCoTutors = [
        ...currentCoTutors.filter((ct) => ct.uid !== currentUser.uid),
        newCoTutor,
      ];

      // Paso 1: Actualizar mascota — Security Rules (canJoinPetWithInvite) verifican que
      // invitation.used == false, que se cumple porque aún no marcamos la invitación.
      await updateDoc(petRef, {
        coTutors: nextCoTutors,
        coTutorUids: nextCoTutorUids,
        lastJoinInviteCode: normalizedCode,
      });
    }

    // Paso 2: Marcar invitación como usada — Security Rules verifican
    // petData().coTutorUids.hasAny([uid]), que ahora es verdadero porque el paso 1 ya commitió.
    // Si falla, reintentar 1 vez. Dejar el código sin marcar es un riesgo de seguridad (otro
    // usuario podría usarlo), pero el acceso ya fue concedido — no lanzamos error al usuario.
    const invPayload = { used: true, usedBy: currentUser.uid, usedAt: new Date() };
    try {
      await updateDoc(invRef, invPayload);
    } catch (invErr: any) {
      console.warn("[joinWithCode] Primer intento de marcar código falló, reintentando:", invErr?.message);
      try {
        await updateDoc(invRef, invPayload);
      } catch (retryErr: any) {
        console.error("[joinWithCode] No se pudo marcar el código como usado después de reintento. El código sigue activo.", retryErr?.message);
      }
    }

    return { petName };
  };

  const removeCoTutor = async (petId: string, coTutorUid: string) => {
    const petRef = doc(db, "pets", petId);
    const petSnap = await getDoc(petRef);
    if (!petSnap.exists()) return;
    const petData = petSnap.data();
    const updatedCoTutors = (petData.coTutors || []).filter((ct: CoTutor) => ct.uid !== coTutorUid);
    const updatedUids = (petData.coTutorUids || []).filter((uid: string) => uid !== coTutorUid);
    await updateDoc(petRef, { coTutors: updatedCoTutors, coTutorUids: updatedUids });
  };

  const leaveAsTutor = async (petId: string) => {
    if (!user) return;
    await removeCoTutor(petId, user.uid);
  };

  const isOwner = (pet: Pet) => pet.ownerId === user?.uid;

  const activePet = pets.find((p) => p.id === activePetId);

  return (
    <PetContext.Provider value={{
      activePetId, setActivePetId, pets, activePet, addPet, updatePet, loading,
      generateInviteCode, sendCoTutorInviteEmail, joinWithCode, removeCoTutor, leaveAsTutor, isOwner,
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
