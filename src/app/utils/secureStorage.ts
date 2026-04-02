/**
 * Secure Local Storage
 * 
 * Wrapper alrededor de localStorage que encripta datos sensibles.
 * Usa la Web Crypto API (SubtleCrypto) con AES-GCM.
 * 
 * GDPR Art. 32 — Medidas técnicas apropiadas para proteger datos personales.
 * Ley 25.326 Art. 9 — Seguridad de los datos.
 * 
 * Datos que DEBEN usar secureStorage en vez de localStorage directo:
 * - Invite codes (coTutorInvite, platformInvite)
 * - Email para magic links
 * - Cualquier dato que identifique al usuario
 * 
 * Datos que pueden seguir en localStorage sin encriptar:
 * - Theme preferences (pessy_theme)
 * - Build version keys
 * - Gamification points (no son PII)
 * - Active pet ID (es un UUID, no PII directamente)
 */

const ENCRYPTION_KEY_NAME = "pessy_storage_key";
const IDB_NAME = "pessy_crypto";
const IDB_STORE = "keys";

/**
 * IndexedDB helpers for persisting CryptoKey handles.
 * IndexedDB can store CryptoKey objects directly (structured clone),
 * so the raw key material never leaves the WebCrypto API.
 */
function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getKeyFromIDB(): Promise<CryptoKey | null> {
  try {
    const db = await openKeyDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(ENCRYPTION_KEY_NAME);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveKeyToIDB(key: CryptoKey): Promise<void> {
  try {
    const db = await openKeyDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(key, ENCRYPTION_KEY_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Silently fail — key will be regenerated next time
  }
}

/**
 * Genera o recupera una clave de encriptación.
 * La clave se almacena como CryptoKey handle en IndexedDB (no exportable).
 */
async function getOrCreateKey(): Promise<CryptoKey> {
  // SECURITY: Key is NOT extractable — it never leaves the WebCrypto API.
  // This means if the tab is closed, a new key is generated and previously
  // encrypted data becomes unreadable (acceptable for short-lived invite codes).
  //
  // We use IndexedDB (via a simple wrapper) to persist the key handle across
  // page reloads within the same session, without ever exposing the raw key material.
  const existingKey = await getKeyFromIDB();
  if (existingKey) return existingKey;

  // Generate a new non-extractable key
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // SECURITY: extractable = false — key material cannot be exported
    ["encrypt", "decrypt"]
  );

  // Store the CryptoKey handle (not raw bytes) in IndexedDB
  await saveKeyToIDB(key);
  return key;
}
/**
 * Encripta y guarda un valor en localStorage.
 */
export async function secureSet(key: string, value: string): Promise<void> {
  try {
    const cryptoKey = await getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(value);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      encoded
    );

    const payload = {
      iv: btoa(String.fromCharCode(...iv)),
      data: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
      _encrypted: true,
    };

    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Fallback: si crypto no está disponible, guardar sin encriptar
    // Esto puede pasar en HTTP (no HTTPS) o navegadores muy viejos
    localStorage.setItem(key, value);
  }
}

/**
 * Lee y desencripta un valor de localStorage.
 */
export async function secureGet(key: string): Promise<string | null> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    // Check si está encriptado
    try {
      const parsed = JSON.parse(raw);
      if (parsed._encrypted) {
        const cryptoKey = await getOrCreateKey();
        const iv = Uint8Array.from(atob(parsed.iv), c => c.charCodeAt(0));
        const ciphertext = Uint8Array.from(atob(parsed.data), c => c.charCodeAt(0));
        const decrypted = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          cryptoKey,
          ciphertext
        );
        return new TextDecoder().decode(decrypted);
      }
    } catch {
      // No es JSON o no se puede desencriptar — devolver raw
    }

    return raw;
  } catch {
    return null;
  }
}

/**
 * Elimina un valor de localStorage.
 */
export function secureRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* no-op */ }
}

/**
 * Limpia TODOS los datos sensibles de localStorage.
 * Usar al hacer logout o deleteAccount.
 * GDPR Art. 17 — Derecho de supresión.
 */
export function clearAllSensitiveData(): void {
  const sensitiveKeys = [
    "pessy_pending_co_tutor_invite",
    "pessy_pending_platform_invite",
    "pessy_user_consent",
    "pessy_landing_prefill",
    "pessy_email_for_signin",
    "pessy_notification_settings",
  ];
  for (const key of sensitiveKeys) {
    try { localStorage.removeItem(key); } catch { /* no-op */ }
  }
  // Clear crypto key from IndexedDB
  try {
    openKeyDB().then(db => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(ENCRYPTION_KEY_NAME);
    }).catch(() => {});
  } catch { /* no-op */ }
}