import { createContext, ReactNode, useContext, useState, useEffect, useCallback } from "react";
import type { GeoPoint } from "../hooks/useGPSTracking";

export interface Walk {
  id: string;
  petId: string;
  date: string;               // ISO 8601
  durationMinutes: number;
  distanceKm?: number;
  notes?: string;
  route?: GeoPoint[];         // puntos GPS de la ruta
  startedAt?: string;         // ISO 8601 inicio exacto
  endedAt?: string;           // ISO 8601 fin exacto
  averageSpeedKmh?: number;
  contextAnswers?: Record<string, string>; // respuestas a preguntas del paseo
}

interface WalkContextType {
  walks: Walk[];
  addWalk: (walk: Omit<Walk, "id">) => Walk;
  updateWalk: (id: string, walk: Partial<Walk>) => void;
  deleteWalk: (id: string) => void;
  getWalksByPetId: (petId: string) => Walk[];
  getWalkStats: (petId: string, days: number) => {
    count: number;
    totalMinutes: number;
    totalKm: number;
    avgMinutesPerWalk: number;
  };
  getLastWalk: (petId: string) => Walk | null;
}

const WalkContext = createContext<WalkContextType | undefined>(undefined);
const STORAGE_KEY = "pessy_walks_v2";

export function WalkProvider({ children }: { children: ReactNode }) {
  const [walks, setWalks] = useState<Walk[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setWalks(JSON.parse(stored));
    } catch (e) {
      console.error("WalkContext: failed to load walks", e);
    }
  }, []);

  useEffect(() => {
    try {
      // Strip GPS routes before storing (too large for localStorage)
      const stripped = walks.map(({ route: _r, ...w }) => w);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
    } catch (e) {
      console.error("WalkContext: failed to persist walks", e);
    }
  }, [walks]);

  const addWalk = useCallback((walk: Omit<Walk, "id">): Walk => {
    const newWalk: Walk = {
      ...walk,
      id: `walk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    setWalks((prev) => [newWalk, ...prev]);
    return newWalk;
  }, []);

  const updateWalk = useCallback((id: string, updates: Partial<Walk>) => {
    setWalks((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
  }, []);

  const deleteWalk = useCallback((id: string) => {
    setWalks((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const getWalksByPetId = useCallback(
    (petId: string): Walk[] =>
      walks
        .filter((w) => w.petId === petId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [walks]
  );

  const getWalkStats = useCallback(
    (petId: string, days: number) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const filtered = walks.filter(
        (w) => w.petId === petId && new Date(w.date) >= cutoff
      );
      const count = filtered.length;
      const totalMinutes = filtered.reduce((s, w) => s + w.durationMinutes, 0);
      const totalKm = filtered.reduce((s, w) => s + (w.distanceKm || 0), 0);
      return {
        count,
        totalMinutes,
        totalKm: Math.round(totalKm * 100) / 100,
        avgMinutesPerWalk: count > 0 ? Math.round(totalMinutes / count) : 0,
      };
    },
    [walks]
  );

  const getLastWalk = useCallback(
    (petId: string): Walk | null => {
      const petWalks = getWalksByPetId(petId);
      return petWalks.length > 0 ? petWalks[0] : null;
    },
    [getWalksByPetId]
  );

  return (
    <WalkContext.Provider
      value={{ walks, addWalk, updateWalk, deleteWalk, getWalksByPetId, getWalkStats, getLastWalk }}
    >
      {children}
    </WalkContext.Provider>
  );
}

export function useWalks(): WalkContextType {
  const ctx = useContext(WalkContext);
  if (!ctx) throw new Error("useWalks must be used within WalkProvider");
  return ctx;
}
