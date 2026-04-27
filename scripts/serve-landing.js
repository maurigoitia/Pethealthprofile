#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
 *  serve-landing.js — ISOLATED DEV SERVER FOR THE LANDING PAGE
 *  ─────────────────────────────────────────────────────────────────────────
 *  Serves apps/web/ as plain static HTML on localhost:5174.
 *  Zero dependencies on Vite, React, Tailwind, or the PWA bundle.
 *
 *  Why a standalone server?
 *  The PWA dev server (Vite, localhost:5173) and the landing page must NEVER
 *  share a process. A bug in Vite config, a service worker collision, or a
 *  route fallback cannot leak into the landing when they run on different
 *  ports with different servers.
 *
 *  Usage:  npm run dev:landing
 *  ══════════════════════════════════════════════════════════════════════════ */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', 'apps', 'web');
const PORT = Number(process.env.LANDING_PORT || 5174);

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
  // Strip query string
  const clean = (urlPath || '/').split('?')[0];
  const safePath = clean === '/' ? '/index.html' : clean;
  const abs = join(ROOT, safePath);

  // Prevent directory traversal
  if (!abs.startsWith(ROOT)) return null;

  try {
    const s = await stat(abs);
    if (s.isDirectory()) return join(abs, 'index.html');
    return abs;
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const filePath = await resolvePath(req.url);
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 — not found in apps/web/');
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
  console.log(`\n  🌐  Landing page (apps/web/) — isolated`);
  console.log(`      → http://localhost:${PORT}/\n`);
  console.log(`      This server is SEPARATE from the PWA dev server.`);
  console.log(`      PWA runs on :5173 (vite). Blog runs on :5175.\n`);
});
