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

export interface DeleteClinicalDataResult {
  ok: boolean;
  userId: string;
  docsDeleted: number;
  storagePrefixesDeleted: string[];
}

/**
 * GDPR Art. 17 — Deletes all clinical + Gmail ingestion data
 * without removing the user account itself.
 */
export async function deleteAllUserClinicalData(): Promise<DeleteClinicalDataResult> {
  const callable = httpsCallable<Record<string, never>, DeleteClinicalDataResult>(
    firebaseFunctions,
    "deleteAllUserClinicalData"
  );
  const result = await callable({});
  return result.data;
}
