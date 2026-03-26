import { auth, storage } from "../../lib/firebase";
import { getStorage, ref, type UploadResult, uploadBytes } from "firebase/storage";

type UploadAttempt = {
  path: string;
};

type UploadWithFallbackParams = {
  uid: string;
  file: File;
  attempts: UploadAttempt[];
};

type UploadWithFallbackResult = {
  result: UploadResult;
  path: string;
  bucket: string;
};

const RETRYABLE_AUTH_CODES = new Set(["storage/unauthorized", "storage/unauthenticated"]);

function normalizeCode(error: any): string {
  return String(error?.code || "");
}

async function uploadToStorageWithAttempts(
  bucketStorage: ReturnType<typeof getStorage>,
  file: File,
  attempts: UploadAttempt[],
): Promise<UploadWithFallbackResult> {
  let lastError: unknown = null;

  for (const attempt of attempts) {
    const storageRef = ref(bucketStorage, attempt.path);
    try {
      const result = await uploadBytes(storageRef, file, {
        contentType: file.type || undefined,
      });
      return {
        result,
        path: attempt.path,
        bucket: result.ref.bucket,
      };
    } catch (error: any) {
      lastError = error;
      const code = normalizeCode(error);
      if (!RETRYABLE_AUTH_CODES.has(code)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("No se pudo subir el archivo.");
}

export async function uploadWithAuthFallback({
  uid,
  file,
  attempts,
}: UploadWithFallbackParams): Promise<UploadWithFallbackResult> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) {
    throw new Error("Tu sesión venció. Volvé a ingresar para guardar la foto.");
  }

  await currentUser.getIdToken(true);

  try {
    return await uploadToStorageWithAttempts(storage, file, attempts);
  } catch (firstError: any) {
    const code = normalizeCode(firstError);
    if (!RETRYABLE_AUTH_CODES.has(code)) {
      throw firstError;
    }
  }

  await currentUser.getIdToken(true);
  // Backoff breve: Firebase Storage puede tardar en propagar el token refrescado.
  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    return await uploadToStorageWithAttempts(storage, file, attempts);
  } catch (secondError: any) {
    const code = normalizeCode(secondError);
    if (!RETRYABLE_AUTH_CODES.has(code)) {
      throw secondError;
    }
  }

  const projectId =
    String(auth.app.options.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || "").trim();
  if (!projectId) {
    throw new Error("No se pudo resolver el proyecto Firebase para reintentar la subida.");
  }
  const legacyStorage = getStorage(auth.app, `gs://${projectId}.appspot.com`);
  return uploadToStorageWithAttempts(legacyStorage, file, attempts);
}
