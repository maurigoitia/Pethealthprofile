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

/**
 * Clave de encriptación en memoria — no exportable, no persistida.
 * Al cerrar el tab, la clave se pierde y los datos encriptados en localStorage
 * se vuelven ilegibles (comportamiento deseado por seguridad).
 */
let _memoryKey: CryptoKey | null = null;
let _keyPromise: Promise<CryptoKey> | null = null;

/**
 * Genera o recupera una clave de encriptación.
 * La clave vive solo en memoria (module-scoped variable), no en sessionStorage.
 * extractable: false → un atacante con XSS no puede exportar la clave.
 */
async function getOrCreateKey(): Promise<CryptoKey> {
  if (_memoryKey) return _memoryKey;
  // Si ya hay una promesa en vuelo, reutilizarla para evitar generar dos claves en paralelo
  if (_keyPromise) return _keyPromise;

  _keyPromise = crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // extractable: false — la clave no puede exportarse
    ["encrypt", "decrypt"]
  ).then((key) => {
    _memoryKey = key;
    _keyPromise = null;
    return key;
  });

  return _keyPromise;
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
  // Limpiar la clave en memoria (la nueva sesión generará una clave fresca)
  _memoryKey = null;
  _keyPromise = null;
}