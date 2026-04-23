#!/usr/bin/env node
/**
 * migrate-photo-urls.js
 * Detecta URLs de fotos de mascotas apuntando a Firebase Storage
 * buckets obsoletos y las limpia (o las reporta en dry-run).
 *
 * Bucket actual: polar-scene-488615-i0.firebasestorage.app
 * Buckets obsoletos conocidos: pessy-qa-app, gen-lang-*, firebasestorage.googleapis.com/v0/b/{otro-bucket}
 *
 * Uso:
 *   node scripts/migrate-photo-urls.js            → solo reporta (dry-run)
 *   node scripts/migrate-photo-urls.js --migrate  → limpia campo photo a "" en Firestore
 *
 * Requiere Application Default Credentials (ADC):
 *   gcloud auth application-default login
 */

import admin from '../functions/node_modules/firebase-admin/lib/index.js';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const PROJECT_ID    = 'polar-scene-488615-i0';
const CURRENT_BUCKET = 'polar-scene-488615-i0.firebasestorage.app';

// Patrones de buckets obsoletos conocidos en Pessy
const STALE_BUCKET_PATTERNS = [
  'pessy-qa-app',
  'gen-lang-',
  'polar-scene-488615-i0.appspot.com',  // formato antiguo mismo proyecto
];

const DRY_RUN = !process.argv.includes('--migrate');
const BATCH_SIZE = 100;

// ─── INIT ─────────────────────────────────────────────────────────────────────
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function isStaleUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('https://')) return false;
  // Si ya apunta al bucket actual → OK
  if (url.includes(CURRENT_BUCKET)) return false;
  // Si apunta a algún bucket obsoleto → STALE
  return STALE_BUCKET_PATTERNS.some(pattern => url.includes(pattern));
}

function truncate(str, len = 80) {
  return str.length > len ? str.slice(0, len) + '...' : str;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('────────────────────────────────────────');
  console.log(' Pessy — Photo URL Migration Script');
  console.log(` Mode: ${DRY_RUN ? 'DRY-RUN (no changes)' : '⚠️  MIGRATE (will write to Firestore)'}`);
  console.log(` Project: ${PROJECT_ID}`);
  console.log(` Current bucket: ${CURRENT_BUCKET}`);
  console.log('────────────────────────────────────────\n');

  const petsSnap = await db.collection('pets').get();
  const total = petsSnap.size;
  const stale = [];

  console.log(`Scanning ${total} pet documents...\n`);

  for (const doc of petsSnap.docs) {
    const pet = doc.data();
    const photoUrl = pet.photo || '';

    if (isStaleUrl(photoUrl)) {
      stale.push({ id: doc.id, name: pet.name || 'Unknown', url: photoUrl });
      console.log(`[STALE_URL] petId=${doc.id} name="${pet.name || '?'}" url=${truncate(photoUrl)}`);
    }
  }

  console.log(`\n────────────────────────────────────────`);
  console.log(` Total pets scanned : ${total}`);
  console.log(` Stale URLs found   : ${stale.length}`);

  if (stale.length === 0) {
    console.log(' ✅ All photo URLs are clean — no migration needed.');
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log(`\n Run with --migrate to clear stale URLs (sets photo to "").`);
    console.log(' No changes made.\n');
    process.exit(0);
  }

  // ── WRITE ──────────────────────────────────────────────────────────────────
  console.log(`\nMigrating ${stale.length} pets in batches of ${BATCH_SIZE}...`);
  let migrated = 0;
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (let i = 0; i < stale.length; i += BATCH_SIZE) {
    const chunk = stale.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const pet of chunk) {
      const ref = db.collection('pets').doc(pet.id);
      batch.update(ref, {
        photo: '',                             // cleared — frontend uses SVG fallback
        photoMigratedFrom: pet.url,            // preserve old URL for audit
        photoMigratedAt: now,
      });
    }

    await batch.commit();
    migrated += chunk.length;
    console.log(`  → Migrated ${migrated}/${stale.length}`);
  }

  console.log(`\n✅ Migration complete. ${migrated} pet photos cleared.`);
  console.log('   Frontend will show SVG "P" placeholder until owners re-upload.\n');
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ Fatal error:', err.message || err);
  process.exit(1);
});
