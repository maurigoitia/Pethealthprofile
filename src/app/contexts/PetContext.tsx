import { createContext, useContext, useState, ReactNode, useEffect, useRef, useMemo, useCallback } from "react";
import { auth, db, functions as firebaseFunctions } from "../../lib/firebase";
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

export type SharedPetAccessRole = "editor" | "viewer";
export type PetAccessLevel = "owner" | "editor" | "viewer" | "none";

export interface CoTutor {
  uid: string;
  email?: string;
  name?: string;
  addedAt: string;
  role?: SharedPetAccessRole;
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
  sharedAccessByUid?: Record<string, SharedPetAccessRole>;
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
  /** true si el loading lleva más de 4s — la UI puede mostrar un aviso */
  loadingSlow: boolean;
  generateInviteCode: (petId: string, inviteEmail?: string, accessRole?: SharedPetAccessRole) => Promise<string>;
  sendCoTutorInviteEmail: (petId: string, email: string, accessRole?: SharedPetAccessRole) => Promise<{ code: string; inviteLink: string; emailSent?: boolean }>;
  joinWithCode: (code: string) => Promise<{ petName: string }>;
  removeCoTutor: (petId: string, coTutorUid: string) => Promise<void>;
  leaveAsTutor: (petId: string) => Promise<void>;
  isOwner: (pet: Pet) => boolean;
  getPetAccessLevel: (pet?: Pet) => PetAccessLevel;
  canEditPet: (pet?: Pet) => boolean;
}

const PetContext = createContext<PetContextType | undefined>(undefined);
const acceptCoTutorInviteCallable = httpsCallable<
  { code: string },
  { petId: string; petName: string; accessRole: SharedPetAccessRole }
>(firebaseFunctions, "acceptCoTutorInvite");
const sendCoTutorInviteCallable = httpsCallable<
  { email: string; inviteCode: string; petName: string },
  { ok: boolean }
>(firebaseFunctions, "sendCoTutorInvite");

export function PetProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const hydratedSharedPetsRef = useRef<Map<string, Pet>>(new Map());
  const [activePetId, setActivePetIdState] = useState<string>(() => {
    return localStorage.getItem("activePetId") || "";
  });

  // Si loading lleva más de 4s, marcar como lento para que la UI pueda avisarle al usuario
  useEffect(() => {
    if (!loading) { setLoadingSlow(false); return; }
    const t = setTimeout(() => setLoadingSlow(true), 4000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      hydratedSharedPetsRef.current.clear();
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
      const mergedMap = new Map<string, Pet>([
        ...Array.from(hydratedSharedPetsRef.current.entries()),
        ...Array.from(allPetsMap.entries()),
      ]);
      const mergedRaw = Array.from(mergedMap.values());
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
          const normalizedCoTutors = Array.isArray(data.coTutors) ? data.coTutors : [];
          const normalizedCoTutorUids = Array.isArray(data.coTutorUids) ? data.coTutorUids : [];
          const normalizedSharedAccess = data.sharedAccessByUid && typeof data.sharedAccessByUid === "object"
            ? data.sharedAccessByUid
            : {};
          const needsShareAccessMigration =
            !Array.isArray(data.coTutors) ||
            !Array.isArray(data.coTutorUids) ||
            !data.sharedAccessByUid ||
            typeof data.sharedAccessByUid !== "object";
          if (needsShareAccessMigration) {
            updateDoc(doc(db, "pets", change.doc.id), {
              coTutors: normalizedCoTutors,
              coTutorUids: normalizedCoTutorUids,
              sharedAccessByUid: normalizedSharedAccess,
            }).catch((err) => {
              console.warn(`[PETS] No se pudo auto-migrar accesos compartidos para pet ${change.doc.id}:`, err?.message || err);
            });
          }
          allPetsMap.set(change.doc.id, {
            id: change.doc.id,
            ...data,
            coTutors: normalizedCoTutors,
            coTutorUids: normalizedCoTutorUids,
            sharedAccessByUid: normalizedSharedAccess,
          } as Pet);
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
            const data = change.doc.data();
            allPetsMap.set(change.doc.id, {
              id: change.doc.id,
              ...data,
              coTutors: Array.isArray(data.coTutors) ? data.coTutors : [],
              coTutorUids: Array.isArray(data.coTutorUids) ? data.coTutorUids : [],
              sharedAccessByUid: data.sharedAccessByUid && typeof data.sharedAccessByUid === "object"
                ? data.sharedAccessByUid
                : {},
            } as Pet);
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
      if (!resolved.owner || !resolved.cotutor) {
        console.warn("[PETS] Safety timeout disparado — queries no respondieron en 6s", {
          ownerResolved: resolved.owner,
          cotutorResolved: resolved.cotutor,
        });
      }
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

  const getPetAccessLevel = (pet?: Pet): PetAccessLevel => {
    if (!user || !pet) return "none";
    if (pet.ownerId === user.uid) return "owner";
    if (!Array.isArray(pet.coTutorUids) || !pet.coTutorUids.includes(user.uid)) return "none";
    return pet.sharedAccessByUid?.[user.uid] === "viewer" ? "viewer" : "editor";
  };

  const canEditPet = (pet?: Pet) => {
    const accessLevel = getPetAccessLevel(pet);
    return accessLevel === "owner" || accessLevel === "editor";
  };

  const addPet = async (pet: Omit<Pet, "id" | "ownerId">) => {
    if (!user) throw new Error("No user logged in");
    const docRef = await addDoc(collection(db, "pets"), {
      ...pet,
      ownerId: user.uid,
      coTutors: [],
      coTutorUids: [],
      sharedAccessByUid: {},
      createdAt: new Date().toISOString(),
    });
    // Al crear una mascota nueva, se selecciona automáticamente como activa.
    setActivePetIdState(docRef.id);
    localStorage.setItem("activePetId", docRef.id);
    return docRef.id;
  };

  const hydrateJoinedPet = async (petId: string) => {
    const joinedPetSnap = await getDoc(doc(db, "pets", petId));
    if (!joinedPetSnap.exists()) return;
    const data = joinedPetSnap.data();
    const normalizedPet = {
      id: joinedPetSnap.id,
      ...data,
      coTutors: Array.isArray(data.coTutors) ? data.coTutors : [],
      coTutorUids: Array.isArray(data.coTutorUids) ? data.coTutorUids : [],
      sharedAccessByUid: data.sharedAccessByUid && typeof data.sharedAccessByUid === "object"
        ? data.sharedAccessByUid
        : {},
    } as Pet;
    hydratedSharedPetsRef.current.set(petId, normalizedPet);

    setPets((current) => {
      const next = current.filter((pet) => pet.id !== petId);
      next.push(normalizedPet);
      return next;
    });
  };

  const updatePet = async (id: string, updates: Partial<Pet> & { newWeightEntry?: WeightEntry }) => {
    const targetPet = pets.find((pet) => pet.id === id);
    if (!targetPet) throw new Error("Mascota no encontrada");
    if (!canEditPet(targetPet)) throw new Error("Tu acceso es de solo lectura para esta mascota.");
    const petRef = doc(db, "pets", id);
    const { newWeightEntry, ...rest } = updates;
    const payload: any = { ...rest };
    if (newWeightEntry) {
      payload.weightHistory = arrayUnion(newWeightEntry);
    }
    await updateDoc(petRef, payload);
  };

  const generateInviteCode = async (petId: string, inviteEmail?: string, accessRole: SharedPetAccessRole = "editor"): Promise<string> => {
    if (!user) throw new Error("No user logged in");
    const petRef = doc(db, "pets", petId);
    const petSnap = await getDoc(petRef);
    if (!petSnap.exists()) throw new Error("Mascota no encontrada");
    const petData = petSnap.data();
    if (petData.ownerId !== user.uid) throw new Error("Solo el tutor puede invitar co-tutores");

    const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = Array.from(bytes, (b) => CHARSET[b % 36]).join("");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await setDoc(doc(db, "invitations", code), {
      petId,
      petName: petData.name || "Mascota",
      createdBy: user.uid,
      inviteEmail: inviteEmail ? inviteEmail.trim().toLowerCase() : null,
      accessRole,
      sendMethod: inviteEmail ? "email_magic_link" : "manual_code",
      expiresAt,
      used: false,
      createdAt: new Date(),
    });
    return code;
  };

  const sendCoTutorInviteEmail = async (petId: string, email: string, accessRole: SharedPetAccessRole = "editor"): Promise<{ code: string; inviteLink: string; emailSent?: boolean }> => {
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

    const code = await generateInviteCode(petId, normalizedEmail, accessRole);
    const inviteLink = buildCoTutorReferralUrl(code);

    // Llamar directamente a la callable de Firebase que envía el email vía Resend
    let emailSent: boolean;
    try {
      await sendCoTutorInviteCallable({ email: normalizedEmail, inviteCode: code, petName });
      emailSent = true;
    } catch (emailErr: any) {
      console.warn("[sendCoTutorInviteEmail] No se pudo enviar el email:", emailErr?.message);
      emailSent = false;
    }
    return { code, inviteLink, emailSent };
  };

  const joinWithCode = async (code: string): Promise<{ petName: string }> => {
    const currentUser = user || auth.currentUser;
    if (!currentUser) throw new Error("No user logged in");
    const normalizedCode = code.toUpperCase().trim();
    try {
      const result = await acceptCoTutorInviteCallable({ code: normalizedCode });
      const petId = result.data?.petId || "";
      const petName = result.data?.petName || "la mascota";
      if (petId) {
        await hydrateJoinedPet(petId);
        setActivePetIdState(petId);
        localStorage.setItem("activePetId", petId);
      }
      return { petName };
    } catch (callableError: any) {
      const callableCode = callableError?.code || "";
      const callableMessage = callableError?.message || "";
      const callableUnavailable =
        callableCode === "functions/not-found" ||
        callableCode === "functions/unavailable" ||
        callableCode === "functions/internal";
      if (!callableUnavailable) {
        throw new Error(callableMessage || "No se pudo completar la invitación de co-tutor.");
      }
      console.warn("[joinWithCode] Fallback a flujo cliente porque la callable no está disponible:", callableMessage || callableCode);
    }

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
        await hydrateJoinedPet(inv.petId);
        setActivePetIdState(inv.petId);
        localStorage.setItem("activePetId", inv.petId);
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
    const petName = inv.petName || "la mascota";
    const inviteAccessRole: SharedPetAccessRole = inv.accessRole === "viewer" ? "viewer" : "editor";
    const joinAddedAt =
      typeof inv.createdAt?.toDate === "function"
        ? inv.createdAt.toDate().toISOString()
        : typeof inv.createdAt === "string"
          ? inv.createdAt
          : new Date().toISOString();

    const newCoTutor: CoTutor = {
      uid: currentUser.uid,
      email: currentUser.email || "",
      name: currentUser.displayName || currentUser.email || "",
      addedAt: joinAddedAt,
      role: inviteAccessRole,
    };

    let petJoinGranted = false;
    try {
      await updateDoc(petRef, {
        coTutors: arrayUnion(newCoTutor),
        coTutorUids: arrayUnion(currentUser.uid),
        [`sharedAccessByUid.${currentUser.uid}`]: inviteAccessRole,
        lastJoinInviteCode: normalizedCode,
      });
      petJoinGranted = true;
    } catch (joinError: any) {
      const message = joinError?.message || "";
      const code = joinError?.code || "";
      const denied = code === "permission-denied" || code === "firestore/permission-denied" || /permission/i.test(message);
      if (!denied) {
        throw joinError;
      }
      console.warn("[joinWithCode] La unión a la mascota fue rechazada o ya estaba aplicada:", message || code);
    }

    const invPayload = { used: true, usedBy: currentUser.uid, usedAt: new Date() };
    try {
      await updateDoc(invRef, invPayload);
    } catch (invErr: any) {
      console.warn("[joinWithCode] Primer intento de marcar código falló, reintentando:", invErr?.message);
      try {
        await updateDoc(invRef, invPayload);
      } catch (retryErr: any) {
        if (!petJoinGranted) {
          throw retryErr;
        }
        console.error("[joinWithCode] No se pudo marcar el código como usado después de reintento. El código sigue activo.", retryErr?.message);
      }
    }

    setActivePetIdState(inv.petId);
    localStorage.setItem("activePetId", inv.petId);
    await hydrateJoinedPet(inv.petId);

    return { petName };
  };

  const removeCoTutor = async (petId: string, coTutorUid: string) => {
    const petRef = doc(db, "pets", petId);
    const petSnap = await getDoc(petRef);
    if (!petSnap.exists()) return;
    const petData = petSnap.data();
    const updatedCoTutors = (petData.coTutors || []).filter((ct: CoTutor) => ct.uid !== coTutorUid);
    const updatedUids = (petData.coTutorUids || []).filter((uid: string) => uid !== coTutorUid);
    const currentSharedAccessByUid = petData.sharedAccessByUid && typeof petData.sharedAccessByUid === "object"
      ? petData.sharedAccessByUid as Record<string, SharedPetAccessRole>
      : {};
    const { [coTutorUid]: _removedAccess, ...updatedSharedAccessByUid } = currentSharedAccessByUid;
    await updateDoc(petRef, {
      coTutors: updatedCoTutors,
      coTutorUids: updatedUids,
      sharedAccessByUid: updatedSharedAccessByUid,
    });
  };

  const leaveAsTutor = async (petId: string) => {
    if (!user) return;
    await removeCoTutor(petId, user.uid);
  };

  const isOwner = (pet: Pet) => pet.ownerId === user?.uid;

  const activePet = pets.find((p) => p.id === activePetId);

  // PERFORMANCE: Memoize the context value to prevent re-renders in all consumers
  // when PetProvider re-renders but none of the actual values changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const contextValue = useMemo(() => ({
    activePetId, setActivePetId, pets, activePet, addPet, updatePet, loading, loadingSlow,
    generateInviteCode, sendCoTutorInviteEmail, joinWithCode, removeCoTutor, leaveAsTutor, isOwner, getPetAccessLevel, canEditPet,
  }), [activePetId, pets, activePet, loading, loadingSlow]);

  return (
    <PetContext.Provider value={contextValue}>
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
