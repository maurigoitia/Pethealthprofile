import { httpsCallable } from "firebase/functions";
import { functions as firebaseFunctions } from "../../lib/firebase";

export interface DeleteUserAccountResult {
  ok: boolean;
  userId: string;
  ownedPetsDeleted: number;
  coTutorLinksRemoved: number;
  firestoreDocsDeleted: number;
  userSubcollectionsDeleted: number;
  storagePrefixesDeleted: string[];
}

export async function deleteUserAccount(): Promise<DeleteUserAccountResult> {
  const callable = httpsCallable<Record<string, never>, DeleteUserAccountResult>(
    firebaseFunctions,
    "deleteUserAccount"
  );
  const result = await callable({});
  return result.data;
}
