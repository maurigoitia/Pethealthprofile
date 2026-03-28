import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";

interface SeedResult {
  ok: boolean;
  seeded: number;
  notebooks: string[];
  ids: string[];
}

/**
 * Call the seedBrainKnowledge Cloud Function to populate
 * Firestore notebook_knowledge with the 9 PESSY Brain notebooks.
 */
export async function seedBrainKnowledge(): Promise<SeedResult> {
  const callable = httpsCallable<Record<string, never>, SeedResult>(
    functions,
    "seedBrainKnowledge"
  );
  const result = await callable({});
  return result.data;
}
