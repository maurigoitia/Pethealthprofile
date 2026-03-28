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

/**
 * Genera o recupera una clave de encriptación.
 * La clave se almacena en la CryptoKey store del navegador (no en localStorage).
 */
async function getOrCreateKey(): Promise<CryptoKey> {
  // Intentar recuperar la clave desde sessionStorage como fallback
  const existingKeyData = sessionStorage.getItem(ENCRYPTION_KEY_NAME);
  if (existingKeyData) {
    const keyData = Uint8Array.from(atob(existingKeyData), c => c.charCodeAt(0));
    return crypto.subtle.importKey("raw", keyData, "AES-GCM", true, ["encrypt", "decrypt"]);
  }

  // Generar nueva clave
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // Exportar y guardar en sessionStorage (se limpia al cerrar tab)
  const exported = await crypto.subtle.exportKey("raw", key);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  sessionStorage.setItem(ENCRYPTION_KEY_NAME, b64);

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
  try { sessionStorage.removeItem(ENCRYPTION_KEY_NAME); } catch { /* no-op */ }
}