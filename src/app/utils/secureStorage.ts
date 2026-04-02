/**
 * Secure Local Storage
 *
 * Wrapper alrededor de localStorage que encripta datos sensibles.
 * Usa la Web Crypto API (SubtleCrypto) con AES-GCM.
 *
 * SCRUM-15 FIX: Clave con extractable:false almacenada en IndexedDB.
 * La clave nunca sale del subsistema de crypto del navegador.
 * Previene exfiltración vía XSS (antes: extractable:true + sessionStorage).
 *
 * GDPR Art. 32 — Medidas técnicas apropiadas para proteger datos personales.
 * Ley 25.326 Art. 9 — Seguridad de los datos.
 */

const ENCRYPTION_KEY_NAME = "pessy_storage_key";
const IDB_DB_NAME = "pessy_crypto";
const IDB_STORE_NAME = "keys";

// Caché en memoria — evita roundtrips a IndexedDB en la misma sesión
let _keyCache: CryptoKey | null = null;

function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadKeyFromIDB(): Promise<CryptoKey | null> {
  try {
    const db = await openKeyDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, "readonly");
      const req = tx.objectStore(IDB_STORE_NAME).get(ENCRYPTION_KEY_NAME);
      req.onsuccess = () => resolve((req.result as CryptoKey) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveKeyToIDB(key: CryptoKey): Promise<void> {
  try {
    const db = await openKeyDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, "readwrite");
      tx.objectStore(IDB_STORE_NAME).put(key, ENCRYPTION_KEY_NAME);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // No-op: si IndexedDB falla, la clave solo vive en memoria esta sesión
  }
}

/**
 * Genera o recupera la clave de encriptación.
 * SCRUM-15: extractable:false — la clave nunca puede ser exportada.
 * Se persiste en IndexedDB (soporta CryptoKey sin exportar).
 */
async function getOrCreateKey(): Promise<CryptoKey> {
  // 1. Caché en memoria
  if (_keyCache) return _keyCache;

  // 2. Intentar recuperar de IndexedDB
  const stored = await loadKeyFromIDB();
  if (stored) {
    _keyCache = stored;
    return stored;
  }

  // 3. Generar nueva clave — extractable:false (SCRUM-15 fix)
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,  // extractable:false — no puede ser exportada ni robar via XSS
    ["encrypt", "decrypt"]
  );

  _keyCache = key;
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
    // Fallback: si crypto no está disponible (HTTP / browser muy viejo)
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
 * Limpia TODOS los datos sensibles de localStorage e IndexedDB.
 * Usar al hacer logout o deleteAccount.
 * GDPR Art. 17 — Derecho de supresión.
 */
export async function clearAllSensitiveData(): Promise<void> {
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
  // Limpiar clave de IndexedDB y caché en memoria
  _keyCache = null;
  try {
    const db = await openKeyDB();
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    tx.objectStore(IDB_STORE_NAME).delete(ENCRYPTION_KEY_NAME);
  } catch { /* no-op */ }
}
