import { getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getMessaging, isSupported } from "firebase/messaging";

const DEFAULT_PROJECT_ID = "gen-lang-client-0123805751";
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
  "gen-lang-client-0123805751": {
    apiKey: "AIzaSyAzaoRnO1bH1aLEhwVQMv-NHhkTE4H-ClQ",
    authDomain: "gen-lang-client-0123805751.firebaseapp.com",
    storageBucket: "gen-lang-client-0123805751.firebasestorage.app",
    messagingSenderId: "1014436216914",
    appId: "1:1014436216914:web:98f94f55738c08a20b9f8b",
    measurementId: "G-L02GZRJ8H4",
  },
};

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
export const db = getFirestore(app);
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
