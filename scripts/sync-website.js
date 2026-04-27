#!/usr/bin/env node
// sync-website.js
// Copia apps/web/ -> public/ antes del build de Vite.
// La landing (index.html) es HTML puro sin deps locales.
// apps/web/ es la fuente de verdad del monorepo.
//
// Sincroniza:
//   apps/web/index.html   -> public/index.html
//   apps/web/og-cover.png -> public/og-cover.png
//
// NO se mueven: firebase-messaging-sw.js, pwa-*.png,
// apple-touch-icon.png, pessy-logo.*, .well-known/,
// offline.html, 404.html, robots.txt, sitemap.xml

import { cpSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC  = resolve(ROOT, 'apps/web');
const DST  = resolve(ROOT, 'public');

// Individual files to sync
const FILES = ['index.html', 'og-cover.png'];

// Directories to sync (recursive)
const DIRS = ['team'];

console.log('sync-website: copying apps/web/ -> public/');

FILES.forEach(f => {
  const src = resolve(SRC, f);
  const dst = resolve(DST, f);
  if (!existsSync(src)) { console.warn('  WARNING missing:', src); return; }
  cpSync(src, dst);
  console.log('  OK', f);
});

DIRS.forEach(d => {
  const src = resolve(SRC, d);
  const dst = resolve(DST, d);
  if (!existsSync(src)) { console.warn('  WARNING missing dir:', src); return; }
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log('  OK', d + '/');
});

console.log('sync-website: done');
