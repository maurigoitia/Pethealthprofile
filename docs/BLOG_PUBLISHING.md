# Blog publishing workflow

Source of truth for every published article on `pessy.app/blog/*` is this
repo, branch `main`, deployed via `deploy-prod.yml`. Anything that
bypasses this path WILL drift and eventually break production.

## What "published" means

An article counts as published only when **all six** of these are true on
`main`:

1. The article HTML lives at one of these paths:
   - `apps/blog/articles/<slug>/index.html` (folder pattern, preferred for new posts), or
   - `apps/blog/articles/<slug>.html` (flat pattern, kept for legacy posts)
2. A card for the article exists in `apps/blog/blog.html` with `<a href="/blog/<slug>">`.
3. A rewrite for `/blog/<slug>` exists in `firebase.json` pointing to the
   correct destination (folder → `/blog/<slug>/index.html`,
   flat → `/blog/<slug>.html`).
4. The canonical URL is listed in `public/sitemap.xml`.
5. `public/llms.txt` references the blog (already global; no per-article
   change required).
6. `.github/workflows/indexnow-ping.yml` knows how to map the changed
   article path to the public URL — used for IndexNow pings on push to
   `main`.

If any of those is missing, the article is invisible, broken, or
unindexed — even if the file is on disk.

## How to publish a new article (manual)

1. Create the article HTML at `apps/blog/articles/<slug>/index.html`.
   Match the structure of an existing article (same Tailwind config,
   header/footer, breadcrumb, Pessy CTA, JSON-LD `BlogPosting`).
2. Add the rewrite:
   ```
   node scripts/add-blog-rewrite.js <slug>
   ```
   Then verify the destination in `firebase.json` matches the file you
   created (folder vs flat).
3. Add a card in `apps/blog/blog.html` near the other cards. Reuse an
   existing card as template, change the `href`, image, category badge
   (Salud / Tips / Legal/Docs / Comunidad / Rutinas), title, excerpt,
   and date.
4. Add an entry to `public/sitemap.xml`:
   ```xml
   <url>
       <loc>https://pessy.app/blog/<slug></loc>
       <lastmod>YYYY-MM-DD</lastmod>
       <changefreq>monthly</changefreq>
       <priority>0.7</priority>
   </url>
   ```
5. Update `.github/workflows/indexnow-ping.yml` if the slug uses a path
   pattern not yet handled (most new slugs do).
6. Open a PR into `develop`, not `main`. Wait for CI green and the
   staging deploy. Verify `https://pessy-qa-app-1618a.web.app/blog/<slug>`
   serves the actual article (not the SPA shell — check the `<title>` in
   the response body).
7. Merge to `develop` → after staging verification, open `develop` → `main`.

## How to publish via automation (must follow)

The external skills in `~/Documents/Claude/Scheduled/pessy-blog-*` are
the most common automation surface. They MUST be updated to follow the
flow below. Until they are, every automated post will drift.

**Required automation contract:**

- Write the article HTML to `apps/blog/articles/<slug>/index.html`.
  **Never** write directly to `dist/` or `public/blog/` — those are
  build outputs.
- Update `apps/blog/blog.html` to add the card.
- Run `node scripts/add-blog-rewrite.js <slug>` to add the rewrite.
- Add the article to `public/sitemap.xml`.
- Commit on a branch named `blog/<slug>`, push, and open a PR to
  `develop`. Do not push directly to `main`. Do not run `firebase deploy`
  from the script — only `deploy-prod.yml` deploys to production.

**Hard rules for the automation:**

- Never use `git push origin main`.
- Never use `firebase deploy`.
- Never write to `dist/` or `public/blog/`.
- Never skip the rewrite update.
- Never skip the sitemap update.

If any rule is violated the next deploy can lose published articles —
because `develop`/`main` becomes a smaller subset of what the bot
deployed by hand, and any later promotion to prod overwrites it.

## Migrations / drift recovery

If an article is on prod but not in the repo (drift), recover it:

1. Locate the HTML in the deployed dist (e.g. `~/Pethealthprofile/dist/blog/<slug>.html`).
2. Copy it into `apps/blog/articles/<slug>.html` (or convert to folder
   pattern if you prefer).
3. Apply steps 2–6 of the manual workflow.

Resolve duplicate slugs by inspecting the canonical URL (`<link rel="canonical">`)
of each candidate and keeping the one that matches the SEO calendar.

## Files involved

| File | Role |
|---|---|
| `apps/blog/articles/<slug>/index.html` | Article source |
| `apps/blog/blog.html` | Index grid that lists every published article |
| `firebase.json` (`hosting.rewrites`) | URL → file mapping |
| `public/sitemap.xml` | Search engines |
| `public/robots.txt` | Crawler allow rules |
| `public/llms.txt` | LLM discoverability |
| `scripts/sync-blog.js` | Pre-build copy `apps/blog/` → `public/blog/` |
| `scripts/add-blog-rewrite.js` | Idempotent rewrite inserter |
| `.github/workflows/indexnow-ping.yml` | Post-deploy IndexNow ping |
| `.github/workflows/deploy-staging.yml` | Auto-deploys `develop` to staging |
| `.github/workflows/deploy-prod.yml` | Auto-deploys `main` to production |
