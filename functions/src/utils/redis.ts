/**
 * Upstash Redis — cliente serverless para caché y rate limiting.
 *
 * Variables de entorno requeridas (Firebase secrets):
 *   UPSTASH_REDIS_URL   — URL del endpoint REST de Upstash
 *   UPSTASH_REDIS_TOKEN  — Token de autenticación
 *
 * Si las variables no están configuradas, el cliente queda null
 * y todas las operaciones de cache hacen passthrough (no bloquean).
 */
import { Redis } from "@upstash/redis";

const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_URL || "";
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_TOKEN || "";

export const redis =
  UPSTASH_REDIS_URL && UPSTASH_REDIS_TOKEN
    ? new Redis({ url: UPSTASH_REDIS_URL, token: UPSTASH_REDIS_TOKEN })
    : null;

/**
 * Obtener valor del cache. Retorna null si Redis no está configurado.
 */
export async function cacheGet<T = string>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    return await redis.get<T>(key);
  } catch (err) {
    console.warn("[REDIS] cacheGet error:", err);
    return null;
  }
}

/**
 * Guardar valor en cache con TTL en segundos.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch (err) {
    console.warn("[REDIS] cacheSet error:", err);
  }
}

/**
 * Invalidar una key del cache.
 */
export async function cacheDel(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.warn("[REDIS] cacheDel error:", err);
  }
}
