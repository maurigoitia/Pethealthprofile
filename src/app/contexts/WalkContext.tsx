import { createContext, ReactNode, useContext, useState, useEffect } from "react";

export interface Walk {
  id: string;
  petId: string;
  date: string; // ISO 8601
  durationMinutes: number;
  distanceKm?: number;
  notes?: string;
}

interface WalkContextType {
  walks: Walk[];
  addWalk: (walk: Omit<Walk, "id">) => Walk;
  updateWalk: (id: string, walk: Partial<Walk>) => void;
  deleteWalk: (id: string) => void;
  getWalksByPetId: (petId: string) => Walk[];
  getWalkStats: (petId: string, days: number) => { count: number; totalMinutes: number; totalKm: number };
}

const WalkContext = createContext<WalkContextType | undefined>(undefined);

const STORAGE_KEY = "pessy_walks";

export function WalkProvider({ children }: { children: ReactNode }) {
  const [walks, setWalks] = useState<Walk[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setWalks(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse walks from localStorage:", e);
      }
    }
  }, []);

  // Persist to localStorage whenever walks change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(walks));
  }, [walks]);

  const addWalk = (walk: Omit<Walk, "id">): Walk => {
    const newWalk: Walk = {
      ...walk,
      id: `walk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    setWalks((prev) => [newWalk, ...prev]);
    return newWalk;
  };

  const updateWalk = (id: string, updates: Partial<Walk>) => {
    setWalks((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates } : w))
    );
  };

  const deleteWalk = (id: string) => {
    setWalks((prev) => prev.filter((w) => w.id !== id));
  };

  const getWalksByPetId = (petId: string): Walk[] => {
    return walks.filter((w) => w.petId === petId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getWalkStats = (petId: string, days: number): { count: number; totalMinutes: number; totalKm: number } => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const filtered = walks.filter(
      (w) => w.petId === petId && new Date(w.date) >= cutoffDate
    );

    return {
      count: filtered.length,
      totalMinutes: filtered.reduce((sum, w) => sum + w.durationMinutes, 0),
      totalKm: filtered.reduce((sum, w) => sum + (w.distanceKm || 0), 0),
    };
  };

  return (
    <WalkContext.Provider value={{ walks, addWalk, updateWalk, deleteWalk, getWalksByPetId, getWalkStats }}>
      {children}
    </WalkContext.Provider>
  );
}

export function useWalks(): WalkContextType {
  const context = useContext(WalkContext);
  if (!context) {
    throw new Error("useWalks must be used within WalkProvider");
  }
  return context;
}
