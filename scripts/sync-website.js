#!/usr/bin/env node
// sync-website.js
// Copia apps/website/ -> public/ antes del build de Vite.
// La landing (index.html) es HTML puro sin deps locales.
// apps/website/ es la fuente de verdad del monorepo.
//
// Sincroniza:
//   apps/website/index.html   -> public/index.html
//   apps/website/og-cover.png -> public/og-cover.png
//
// NO se mueven: firebase-messaging-sw.js, pwa-*.png,
// apple-touch-icon.png, pessy-logo.*, .well-known/,
// offline.html, 404.html, robots.txt, sitemap.xml

import { cpSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC  = resolve(ROOT, 'apps/website');
const DST  = resolve(ROOT, 'public');
const FILES = ['index.html', 'og-cover.png'];

console.log('sync-website: copying apps/website/ -> public/');
FILES.forEach(f => {
  const src = resolve(SRC, f);
  const dst = resolve(DST, f);
  if (!existsSync(src)) { console.warn('  WARNING missing:', src); return; }
  cpSync(src, dst);
  console.log('  OK', f);
});
console.log('sync-website: done');
