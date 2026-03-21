import { getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getMessaging, isSupported } from "firebase/messaging";

const DEFAULT_PROJECT_ID = "polar-scene-488615-i0";
const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const projectId = envProjectId || DEFAULT_PROJECT_ID;
const envMessagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const envAppId = import.meta.env.VITE_FIREBASE_APP_ID;

const KNOWN_PROJECT_CONFIG: Record<
  string,
  {
    apiKey: string;
    authDomain: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  }
> = {
  // Proyecto pessy.app org — cuenta mauri@pessy.app — con créditos Google
  "polar-scene-488615-i0": {
    apiKey: "AIzaSyBwyy3aPNQ392g69L6yheLxvR0IirgjpoE",
    authDomain: "pessy.app",
    storageBucket: "polar-scene-488615-i0.firebasestorage.app",
    messagingSenderId: "842879609097",
    appId: "1:842879609097:web:b4fcb8fb0b04f316b68bd8",
    measurementId: "G-LV2E710H09",
  },
};

const HOST_PROJECT_MAP = new Map<string, string>([
  ["pessy.app", "polar-scene-488615-i0"],
  ["www.pessy.app", "polar-scene-488615-i0"],
  ["polar-scene-488615-i0.web.app", "polar-scene-488615-i0"],
  ["polar-scene-488615-i0.firebaseapp.com", "polar-scene-488615-i0"],
  ["pessy-qa-app.web.app", "polar-scene-488615-i0"],
  ["pessy-focus-qa.web.app", "polar-scene-488615-i0"],
  ["itpessy.web.app", "polar-scene-488615-i0"],
]);

const known = KNOWN_PROJECT_CONFIG[projectId];
const configMismatch =
  Boolean(known) &&
  ((import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_API_KEY !== known.apiKey) ||
    (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN !== known.authDomain) ||
    (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET &&
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET !== known.storageBucket) ||
    (envMessagingSenderId && envMessagingSenderId !== known.messagingSenderId) ||
    (envAppId && envAppId !== known.appId));

if (configMismatch) {
  console.warn(
    "[firebase] Config inconsistente detectada. Se aplica fallback del proyecto para evitar fallas de auth/session.",
  );
}

const currentHost =
  typeof window !== "undefined" ? window.location.hostname.toLowerCase().trim() : "";
const expectedProjectId = currentHost ? HOST_PROJECT_MAP.get(currentHost) : null;
if (expectedProjectId && expectedProjectId !== projectId) {
  throw new Error(
    `[firebase] El host ${currentHost} requiere projectId=${expectedProjectId}, pero el build usa ${projectId}.`,
  );
}

const firebaseConfig = {
  apiKey: known?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: known?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId,
  storageBucket: known?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: known?.messagingSenderId || envMessagingSenderId,
  appId: known?.appId || envAppId,
  measurementId: known?.measurementId || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Persistencia de sesión estable para demo local/web.
void setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("No se pudo aplicar browserLocalPersistence:", error);
});

// Messaging — solo disponible en browsers que soportan Service Workers
export const getFirebaseMessaging = async () => {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
};
