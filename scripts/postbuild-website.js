#!/usr/bin/env node
/**
 * postbuild-website.js
 * Copies static website files into dist/ AFTER Vite build completes.
 *
 * WHY post-build instead of pre-build?
 * ─────────────────────────────────────
 * The landing page (index.html) and blog are plain HTML — zero dependency on
 * React, Vite, or TypeScript. By copying them AFTER the Vite build:
 *
 *   1. A broken Vite build cannot corrupt landing/blog files
 *   2. Landing files always come fresh from apps/website/ (source of truth)
 *   3. Vite's output never overwrites the landing page
 *
 * This is the core of the "environment separation" — the PWA build pipeline
 * and the static website pipeline share dist/ but never interfere.
 *
 * Syncs:
 *   apps/website/index.html   → dist/index.html
 *   apps/website/og-cover.png → dist/og-cover.png
 *   apps/website/team/        → dist/team/
 *   apps/blog/blog.html       → dist/blog.html
 *   apps/blog/articles/       → dist/blog/
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');

// ── Website (landing page) ──────────────────────────────────────────
const WEBSITE_SRC = resolve(ROOT, 'apps/website');
const WEBSITE_FILES = ['index.html', 'og-cover.png'];
const WEBSITE_DIRS = ['team'];

console.log('postbuild-website: copying static site files → dist/');

if (!existsSync(DIST)) {
  console.error('  ERROR: dist/ does not exist. Run vite build first.');
  process.exit(1);
}

// Copy website files
WEBSITE_FILES.forEach(f => {
  const src = resolve(WEBSITE_SRC, f);
  const dst = resolve(DIST, f);
  if (!existsSync(src)) { console.warn('  WARNING missing:', src); return; }
  cpSync(src, dst);
  console.log('  OK website/', f);
});

WEBSITE_DIRS.forEach(d => {
  const src = resolve(WEBSITE_SRC, d);
  const dst = resolve(DIST, d);
  if (!existsSync(src)) { console.warn('  WARNING missing dir:', src); return; }
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log('  OK website/', d + '/');
});

// ── Blog ────────────────────────────────────────────────────────────
const BLOG_ARTICLES_SRC = resolve(ROOT, 'apps/blog/articles');
const BLOG_INDEX_SRC = resolve(ROOT, 'apps/blog/blog.html');
const BLOG_ARTICLES_DST = resolve(DIST, 'blog');
const BLOG_INDEX_DST = resolve(DIST, 'blog.html');

if (existsSync(BLOG_ARTICLES_SRC)) {
  // Clean and re-copy blog articles
  if (existsSync(BLOG_ARTICLES_DST)) {
    rmSync(BLOG_ARTICLES_DST, { recursive: true, force: true });
  }
  cpSync(BLOG_ARTICLES_SRC, BLOG_ARTICLES_DST, { recursive: true });
  console.log('  OK blog/articles/');
}

if (existsSync(BLOG_INDEX_SRC)) {
  cpSync(BLOG_INDEX_SRC, BLOG_INDEX_DST);
  console.log('  OK blog.html');
}

console.log('postbuild-website: done');
