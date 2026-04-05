import { getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getMessaging, isSupported } from "firebase/messaging";

// SEC-001 FIX: Toda la Firebase config viene de variables de entorno VITE_*.
// Nunca hardcodear API keys, app IDs, ni project IDs en el código fuente.
// Configurar en .env.local (desarrollo) y en CI/CD secrets (producción).
// BUG-001 FIX: VITE_FIREBASE_AUTH_DOMAIN debe ser "pessy.app" (no firebaseapp.com)
// para que Google Sign-In y email links funcionen en producción.
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

if (!projectId) {
  throw new Error("[firebase] VITE_FIREBASE_PROJECT_ID no configurado. Revisá tu .env.local o CI/CD secrets.");
}

const ALLOWED_HOSTS = new Set([
  "pessy.app",
  "www.pessy.app",
  "app.pessy.app",
  "polar-scene-488615-i0.web.app",
  "polar-scene-488615-i0.firebaseapp.com",
  "pessy-qa-app.web.app",
  "pessy-focus-qa.web.app",
  "itpessy.web.app",
  "pessy-app-subdomain.web.app",
  "localhost",
]);

const currentHost =
  typeof window !== "undefined" ? window.location.hostname.toLowerCase().trim() : "";
if (currentHost && !ALLOWED_HOSTS.has(currentHost) && !currentHost.startsWith("localhost")) {
  throw new Error(`[firebase] Host no autorizado: ${currentHost}`);
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.apiKey) {
  throw new Error("[firebase] VITE_FIREBASE_API_KEY no configurada. Revisá tu .env.local o CI/CD secrets.");
}

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
