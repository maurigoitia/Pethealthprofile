#!/usr/bin/env node
/**
 * sync-blog.js
 * Copia apps/blog/ → public/blog/ antes del build de Vite.
 * El blog es HTML estático puro — cero dependencias de React/Vite.
 * Esto permite que apps/blog/ sea la fuente de verdad del monorepo
 * sin romper el build actual ni firebase.json.
 */

import { cpSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SRC_ARTICLES = resolve(ROOT, 'apps/blog/articles');
const SRC_INDEX    = resolve(ROOT, 'apps/blog/blog.html');
const DST_ARTICLES = resolve(ROOT, 'public/blog');
const DST_INDEX    = resolve(ROOT, 'public/blog.html');

console.log('📝 sync-blog: copying apps/blog/ → public/blog/');

// Clean destination
if (existsSync(DST_ARTICLES)) {
  rmSync(DST_ARTICLES, { recursive: true, force: true });
}

// Copy articles dir
cpSync(SRC_ARTICLES, DST_ARTICLES, { recursive: true });

// Copy blog index
cpSync(SRC_INDEX, DST_INDEX);

console.log('✅ sync-blog: done');
