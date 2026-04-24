import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

/**
 * Suscribe a la subcolección pets/{petId}/extractedVets ordenada por
 * lastSeenAt desc. Populada por la Cloud Function extractVetsFromArchives
 * + upserts incrementales desde MedicalContext al agregar eventos nuevos.
 */

export interface ExtractedVet {
  id: string;
  name: string;
  clinic: string | null;
  license: string | null;
  phone: string | null;
  email: string | null;
  firstSeenAt: Timestamp | null;
  lastSeenAt: Timestamp | null;
  eventCount: number;
  sourceEventIds: string[];
  confidence: "high" | "medium" | "low";
}

interface UseExtractedVetsResult {
  vets: ExtractedVet[];
  loading: boolean;
  error: Error | null;
}

export function useExtractedVets(petId: string | null | undefined): UseExtractedVetsResult {
  const [vets, setVets] = useState<ExtractedVet[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(petId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!petId) {
      setVets([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, "pets", petId, "extractedVets"),
      orderBy("lastSeenAt", "desc"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: ExtractedVet[] = snap.docs.map((d) => {
          const data = d.data() as Partial<ExtractedVet>;
          return {
            id: d.id,
            name: (data.name as string) || "",
            clinic: (data.clinic as string | null) ?? null,
            license: (data.license as string | null) ?? null,
            phone: (data.phone as string | null) ?? null,
            email: (data.email as string | null) ?? null,
            firstSeenAt: (data.firstSeenAt as Timestamp) || null,
            lastSeenAt: (data.lastSeenAt as Timestamp) || null,
            eventCount: Number(data.eventCount || 0),
            sourceEventIds: Array.isArray(data.sourceEventIds)
              ? (data.sourceEventIds as string[])
              : [],
            confidence: (data.confidence as ExtractedVet["confidence"]) || "medium",
          };
        });
        setVets(next);
        setLoading(false);
      },
      (err) => {
        console.error("[useExtractedVets] onSnapshot failed:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      },
    );

    return () => unsub();
  }, [petId]);

  return { vets, loading, error };
}
