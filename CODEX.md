# PESSY — Rules for OpenAI Codex

> **Fuente de verdad completa: `CLAUDE.md`** — leé ese archivo primero.

## ⛔ NEVER run `firebase deploy` manually

Production deploys happen exclusively via GitHub Actions. Running `firebase deploy` from the terminal broke production twice (2026-03-27, 2026-03-28).

**Forbidden:** `firebase deploy` · `firebase deploy --only hosting` · `firebase deploy --only hosting:app`
**OK:** `npm run dev` · `npm run build` · `npm test` · `firebase emulators:start`
