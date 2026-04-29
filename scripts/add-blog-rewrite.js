#!/usr/bin/env node
/**
 * add-blog-rewrite.js
 *
 * Idempotent helper for the blog generator: inserts a Firebase Hosting
 * rewrite for a freshly-published blog slug into firebase.json. Designed
 * to run as Step 3 of the blog generator pipeline (right before the
 * commit), so a missing rewrite never blocks deploy again.
 *
 * Usage:
 *   node scripts/add-blog-rewrite.js <slug>
 *
 * Example:
 *   node scripts/add-blog-rewrite.js calendario-vacunas-perros-2026
 *
 * Behavior:
 *   - If the rewrite already exists for that slug, exits 0 with a
 *     "skipped" log.
 *   - If absent, inserts a rewrite block in textual form right after the
 *     last existing /blog/* rewrite. Preserves the surrounding
 *     formatting exactly so the diff is minimal and reviewable.
 *   - Default destination uses the canonical "/<slug>/index.html"
 *     pattern that articles produced by the generator follow.
 *   - Exit codes: 0 success / no-op, 1 invalid input, 2 IO error.
 *
 * Conventions:
 *   - Slug must match /^[a-z0-9][a-z0-9-]*[a-z0-9]$/ (lower-case,
 *     digits, dashes; no leading/trailing dash).
 *   - Indentation matched from the closest existing /blog/* rewrite.
 *
 * Why textual insertion (not JSON.parse → stringify)?
 *   firebase.json mixes inline and multi-line object styles. Round-
 *   tripping through JSON.stringify would normalize every inline rule
 *   (e.g. `{ "key": "X", "value": "Y" }`) into a noisy multi-line block,
 *   producing a 30+ line diff for a 4-line change and rewriting on
 *   every run. Textual insertion preserves the file as-is.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIREBASE_JSON = path.resolve(__dirname, "..", "firebase.json");
const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

function fail(code, msg) {
  console.error(`[add-blog-rewrite] ${msg}`);
  process.exit(code);
}

function main() {
  const slug = process.argv[2];
  if (!slug) fail(1, "missing slug. Usage: node scripts/add-blog-rewrite.js <slug>");
  if (!SLUG_RE.test(slug)) {
    fail(1, `invalid slug "${slug}". Use lower-case, digits, dashes; no leading/trailing dash.`);
  }

  let raw;
  try {
    raw = fs.readFileSync(FIREBASE_JSON, "utf8");
  } catch (e) {
    fail(2, `cannot read ${FIREBASE_JSON}: ${e.message}`);
  }

  const source = `/blog/${slug}`;

  if (raw.includes(`"source": "${source}"`)) {
    console.log(`[add-blog-rewrite] skipped — rewrite already exists for ${source}`);
    return;
  }

  // Find every existing `/blog/...` rewrite block: the JSON object that
  // contains a "source": "/blog/<...>" line. We anchor on the line and
  // capture the enclosing object so we can splice a sibling after it.
  //
  // The blog rewrites in firebase.json look like:
  //   {
  //     "source": "/blog/<slug>",
  //     "destination": "/blog/<slug>/index.html"
  //   },
  //
  // We match the closing "},\n" of the LAST such block and insert before
  // the next sibling.
  const blockRe =
    /^(?<indent>[ \t]+)\{\n\k<indent>[ \t]+"source": "\/blog\/[^"]+",\n\k<indent>[ \t]+"destination": "\/blog\/[^"]+",?\n\k<indent>\},?\n/gm;

  let lastMatch = null;
  for (const m of raw.matchAll(blockRe)) {
    lastMatch = m;
  }
  if (!lastMatch) {
    fail(2, "could not locate any existing /blog/* rewrite to anchor against — refusing to guess.");
  }

  const indent = lastMatch.groups.indent;
  const inner = `${indent}  `;

  // Mimic the surrounding format exactly (multi-line object, comma
  // after closing brace because there are siblings after).
  const newBlock =
    `${indent}{\n` +
    `${inner}"source": "/blog/${slug}",\n` +
    `${inner}"destination": "/blog/${slug}/index.html"\n` +
    `${indent}},\n`;

  const insertAt = lastMatch.index + lastMatch[0].length;
  const out = raw.slice(0, insertAt) + newBlock + raw.slice(insertAt);

  // Sanity: the result must still be valid JSON.
  try {
    JSON.parse(out);
  } catch (e) {
    fail(2, `produced invalid JSON, refusing to write: ${e.message}`);
  }

  try {
    fs.writeFileSync(FIREBASE_JSON, out);
  } catch (e) {
    fail(2, `cannot write ${FIREBASE_JSON}: ${e.message}`);
  }

  console.log(`[add-blog-rewrite] inserted rewrite for ${source} → /blog/${slug}/index.html`);
}

main();
