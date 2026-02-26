import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, where, orderBy, Timestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "./AuthContext";
import { usePet } from "./PetContext";
import { ManualReminder, ReminderType, ReminderRepeat } from "../types/medical";

interface RemindersContextState {
  reminders: ManualReminder[];
  loading: boolean;
  addReminder: (data: Omit<ManualReminder, "id" | "userId" | "createdAt" | "updatedAt" | "completed" | "completedAt" | "dismissed">) => Promise<string>;
  completeReminder: (id: string) => Promise<void>;
  dismissReminder: (id: string) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  getRemindersByPetId: (petId: string) => ManualReminder[];
  getPendingCount: (petId: string) => number;
}

const RemindersContext = createContext<RemindersContextState | undefined>(undefined);

export function RemindersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activePetId } = usePet();
  const [reminders, setReminders] = useState<ManualReminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) { setReminders([]); setLoading(false); return; }

    const q = query(
      collection(db, "reminders"),
      where("userId", "==", user.uid),
      orderBy("dueDate", "asc"),
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ManualReminder));
      setReminders(data);
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [user?.uid]);

  const addReminder = async (data: Omit<ManualReminder, "id" | "userId" | "createdAt" | "updatedAt" | "completed" | "completedAt" | "dismissed">): Promise<string> => {
    if (!user?.uid) throw new Error("No user");
    const now = new Date().toISOString();
    const ref = await addDoc(collection(db, "reminders"), {
      ...data,
      userId: user.uid,
      completed: false,
      completedAt: null,
      dismissed: false,
      createdAt: now,
      updatedAt: now,
    });
    return ref.id;
  };

  const completeReminder = async (id: string) => {
    await updateDoc(doc(db, "reminders", id), {
      completed: true,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const dismissReminder = async (id: string) => {
    await updateDoc(doc(db, "reminders", id), {
      dismissed: true,
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteReminder = async (id: string) => {
    await deleteDoc(doc(db, "reminders", id));
  };

  const getRemindersByPetId = (petId: string) =>
    reminders.filter(r => r.petId === petId && !r.dismissed);

  const getPendingCount = (petId: string) =>
    reminders.filter(r => r.petId === petId && !r.completed && !r.dismissed).length;

  return (
    <RemindersContext.Provider value={{
      reminders, loading, addReminder, completeReminder,
      dismissReminder, deleteReminder, getRemindersByPetId, getPendingCount,
    }}>
      {children}
    </RemindersContext.Provider>
  );
}

export function useReminders() {
  const ctx = useContext(RemindersContext);
  if (!ctx) throw new Error("useReminders must be used within RemindersProvider");
  return ctx;
}
