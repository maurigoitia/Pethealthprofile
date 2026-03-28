import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";

interface SeedResult {
  ok: boolean;
  seeded: number;
  notebooks: string[];
  ids: string[];
}

export async function seedBrainKnowledge(): Promise<SeedResult> {
  const callable = httpsCallable<Record<string, never>, SeedResult>(
    functions,
    "seedBrainKnowledge"
  );
  const result = await callable({});
  return result.data;
}
