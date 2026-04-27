import { httpsCallable } from "firebase/functions";
import { getDownloadURL } from "firebase/storage";
import { auth, functions } from "../../lib/firebase";
import { uploadWithAuthFallback } from "../utils/storageUpload";

type UploadPetPhotoPayload = {
  petId: string;
  fileName: string;
  contentType: string;
  base64: string;
  uid?: string;
  idToken?: string;
};

type UploadPetPhotoResponse = {
  ok: boolean;
  url: string;
  path: string;
  bucket: string;
  contentType: string;
  sizeBytes: number;
};

const CALLABLE_FALLBACK_CODES = new Set([
  "",
  "functions/unauthenticated",
  "functions/permission-denied",
  "functions/internal",
  "functions/unavailable",
  "functions/deadline-exceeded",
  "functions/cancelled",
]);

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("No se pudo leer la imagen seleccionada."));
        return;
      }
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

export async function uploadPetPhotoViaCallable(args: {
  petId: string;
  file: File;
}): Promise<UploadPetPhotoResponse> {
  const uploader = httpsCallable<UploadPetPhotoPayload, UploadPetPhotoResponse>(functions, "uploadPetPhoto");
  const base64 = await fileToBase64(args.file);
  const currentUser = auth.currentUser;
  const idToken = currentUser ? await currentUser.getIdToken(true) : "";
  const response = await uploader({
    petId: args.petId,
    fileName: args.file.name || "pet_photo.jpg",
    contentType: args.file.type || "image/jpeg",
    base64,
    uid: currentUser?.uid || undefined,
    idToken: idToken || undefined,
  });
  return response.data;
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80) || "pet_photo.jpg";
}

async function uploadPetPhotoViaStorageFallback(args: {
  petId: string;
  file: File;
}): Promise<UploadPetPhotoResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error("Tu sesión venció. Cerrá sesión y volvé a entrar para subir la foto.");
  }

  const timestamp = Date.now();
  const safeFileName = sanitizeSegment(args.file.name || "pet_photo.jpg");
  const safePetId = sanitizeSegment(args.petId || "pet");
  const attempts = [
    { path: `users/${currentUser.uid}/pets/${safePetId}_photo_${timestamp}_${safeFileName}` },
    { path: `users/${currentUser.uid}/pets/${safePetId}/${timestamp}_${safeFileName}` },
  ];

  const uploadResult = await uploadWithAuthFallback({
    uid: currentUser.uid,
    file: args.file,
    attempts,
  });
  const url = await getDownloadURL(uploadResult.result.ref);
  return {
    ok: true,
    url,
    path: uploadResult.path,
    bucket: uploadResult.bucket,
    contentType: args.file.type || "image/jpeg",
    sizeBytes: args.file.size,
  };
}

export async function uploadPetPhotoWithFallback(args: {
  petId: string;
  file: File;
}): Promise<UploadPetPhotoResponse> {
  try {
    return await uploadPetPhotoViaCallable(args);
  } catch (callableError: any) {
    const code = getCallableErrorCode(callableError);
    if (code === "functions/invalid-argument") {
      throw new Error(callableError?.message || "La imagen no cumple el formato permitido.");
    }
    if (!CALLABLE_FALLBACK_CODES.has(code)) {
      throw callableError;
    }
    return uploadPetPhotoViaStorageFallback(args);
  }
}

export function getCallableErrorCode(error: any): string {
  return String(error?.code || "");
}
