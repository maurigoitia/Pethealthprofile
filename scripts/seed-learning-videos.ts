#!/usr/bin/env tsx
/**
 * Seed script para la colección `learningVideos` en Firestore.
 *
 * Uso:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   export FIREBASE_PROJECT_ID=polar-scene-488615-i0   # opcional, default prod
 *   npx tsx scripts/seed-learning-videos.ts [path/to/csv]
 *
 * Por default lee `seed/learning-videos.csv`.
 *
 * Formato CSV (header obligatorio):
 *   title,provider,url,thumbnailUrl,durationSeconds,language,species,
 *   conditions,ageRangeMinMonths,ageRangeMaxMonths,tags,active
 *
 * - `species`: lista separada por coma (e.g. "dog,cat") o vacío = aplica a todas.
 * - `conditions`: lista separada por coma, lowercase (e.g. "artritis,diabetes"),
 *   vacío = video general.
 * - `ageRangeMinMonths` / `ageRangeMaxMonths`: enteros o vacío.
 * - `tags`: lista separada por coma (e.g. "alimentacion,rutina").
 * - `active`: "true" | "false".
 *
 * El `id` de cada documento se deriva del hash de la URL → upserts idempotentes.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { cert, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

type Provider = "youtube" | "vimeo" | "web";
type Species = "dog" | "cat" | "rabbit" | "bird" | "reptile";
type Language = "es" | "en";

interface SeedVideo {
  id: string;
  title: string;
  provider: Provider;
  url: string;
  thumbnailUrl: string;
  durationSeconds: number;
  language: Language;
  species: Species[] | null;
  conditions: string[];
  ageRange: { minMonths?: number; maxMonths?: number } | null;
  tags: string[];
  active: boolean;
}

const VALID_PROVIDERS = new Set<Provider>(["youtube", "vimeo", "web"]);
const VALID_SPECIES = new Set<Species>(["dog", "cat", "rabbit", "bird", "reptile"]);
const VALID_LANGUAGES = new Set<Language>(["es", "en"]);

// ─── CSV parser (RFC 4180, soporta comillas y comas dentro de campos) ─────────
function parseCSV(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // skip
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function splitList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseBool(raw: string): boolean {
  return raw.trim().toLowerCase() === "true";
}

function parseIntOrUndef(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : undefined;
}

function hashId(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 20);
}

function validateAndMap(row: Record<string, string>, line: number): SeedVideo {
  const title = row.title?.trim();
  const url = row.url?.trim();
  const provider = row.provider?.trim() as Provider;
  const language = row.language?.trim() as Language;
  const thumbnailUrl = row.thumbnailUrl?.trim();
  const durationSeconds = Number.parseInt(row.durationSeconds ?? "0", 10);

  if (!title) throw new Error(`[line ${line}] falta title`);
  if (!url) throw new Error(`[line ${line}] falta url`);
  if (!thumbnailUrl) throw new Error(`[line ${line}] falta thumbnailUrl`);
  if (!VALID_PROVIDERS.has(provider)) {
    throw new Error(`[line ${line}] provider inválido: ${provider}`);
  }
  if (!VALID_LANGUAGES.has(language)) {
    throw new Error(`[line ${line}] language inválido: ${language}`);
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`[line ${line}] durationSeconds inválido`);
  }

  const speciesRaw = splitList(row.species ?? "");
  let species: Species[] | null = null;
  if (speciesRaw.length > 0) {
    for (const s of speciesRaw) {
      if (!VALID_SPECIES.has(s as Species)) {
        throw new Error(`[line ${line}] species inválido: ${s}`);
      }
    }
    species = speciesRaw as Species[];
  }

  const conditions = splitList(row.conditions ?? "").map((c) => c.toLowerCase());
  const tags = splitList(row.tags ?? "");

  const minMonths = parseIntOrUndef(row.ageRangeMinMonths ?? "");
  const maxMonths = parseIntOrUndef(row.ageRangeMaxMonths ?? "");
  const ageRange =
    minMonths === undefined && maxMonths === undefined
      ? null
      : { ...(minMonths !== undefined ? { minMonths } : {}), ...(maxMonths !== undefined ? { maxMonths } : {}) };

  return {
    id: hashId(url),
    title,
    provider,
    url,
    thumbnailUrl,
    durationSeconds,
    language,
    species,
    conditions,
    ageRange,
    tags,
    active: parseBool(row.active ?? "true"),
  };
}

async function main() {
  const csvPath = resolve(process.cwd(), process.argv[2] ?? "seed/learning-videos.csv");
  const raw = readFileSync(csvPath, "utf8");
  const rows = parseCSV(raw);
  if (rows.length < 2) throw new Error("CSV vacío o sin data");

  const [header, ...body] = rows;
  const colIndex = new Map(header.map((name, i) => [name.trim(), i] as const));
  const required = [
    "title", "provider", "url", "thumbnailUrl", "durationSeconds",
    "language", "species", "conditions", "ageRangeMinMonths",
    "ageRangeMaxMonths", "tags", "active",
  ];
  for (const col of required) {
    if (!colIndex.has(col)) throw new Error(`Falta columna '${col}' en header CSV`);
  }

  const videos: SeedVideo[] = [];
  for (let i = 0; i < body.length; i++) {
    const cells = body[i];
    const rowObj: Record<string, string> = {};
    for (const [name, idx] of colIndex) rowObj[name] = cells[idx] ?? "";
    videos.push(validateAndMap(rowObj, i + 2));
  }

  // ─── Firebase Admin init ────────────────────────────────────────────────────
  const projectId = process.env.FIREBASE_PROJECT_ID || "polar-scene-488615-i0";
  const credential = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? applicationDefault()
    : applicationDefault();
  initializeApp({ credential, projectId });
  const db = getFirestore();

  console.log(`[seed] Upserting ${videos.length} videos a proyecto ${projectId}…`);
  const batch = db.batch();
  for (const v of videos) {
    const ref = db.collection("learningVideos").doc(v.id);
    batch.set(
      ref,
      {
        ...v,
        curatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  await batch.commit();
  console.log(`[seed] OK — ${videos.length} docs escritos en learningVideos/`);
}

main().catch((err) => {
  console.error("[seed] ERROR:", err.message || err);
  process.exit(1);
});

// Silenciar warning de credential-cert dinámico (no usado en runtime).
void cert;
