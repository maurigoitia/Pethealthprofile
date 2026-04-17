#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
 *  serve-blog.js — ISOLATED DEV SERVER FOR THE BLOG
 *  ─────────────────────────────────────────────────────────────────────────
 *  Serves apps/blog/ as plain static HTML on localhost:5175.
 *  Zero dependencies on Vite, React, Tailwind, or the PWA bundle.
 *
 *  Route map:
 *    /              → apps/blog/blog.html (blog index)
 *    /articles/...  → apps/blog/articles/...
 *    /{slug}        → apps/blog/articles/{slug}/index.html
 *
 *  Usage:  npm run dev:blog
 *  ══════════════════════════════════════════════════════════════════════════ */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', 'apps', 'blog');
const PORT = Number(process.env.BLOG_PORT || 5175);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
};

async function resolvePath(urlPath) {
  const clean = (urlPath || '/').split('?')[0];

  // Blog index
  if (clean === '/' || clean === '/blog' || clean === '/blog.html') {
    return join(ROOT, 'blog.html');
  }

  // /articles/* → apps/blog/articles/*
  if (clean.startsWith('/articles/')) {
    const abs = join(ROOT, clean);
    if (!abs.startsWith(ROOT)) return null;
    try {
      const s = await stat(abs);
      return s.isDirectory() ? join(abs, 'index.html') : abs;
    } catch {
      return null;
    }
  }

  // /{slug} → articles/{slug}/index.html
  const slug = clean.slice(1).replace(/\/$/, '');
  if (slug) {
    const abs = join(ROOT, 'articles', slug, 'index.html');
    if (!abs.startsWith(ROOT)) return null;
    try {
      await stat(abs);
      return abs;
    } catch {
      // fall through
    }
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  const filePath = await resolvePath(req.url);
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 — not found in apps/blog/');
    return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(data);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 — read error');
  }
});

server.listen(PORT, () => {
  console.log(`\n  📝  Blog (apps/blog/) — isolated`);
  console.log(`      → http://localhost:${PORT}/\n`);
  console.log(`      This server is SEPARATE from the PWA dev server.`);
  console.log(`      PWA runs on :5173 (vite). Landing runs on :5174.\n`);
});
