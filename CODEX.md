# PESSY — Rules for OpenAI Codex

## ⛔ DO NOT RUN `firebase deploy`

Running `firebase deploy` from ANY branch will break pessy.app production.

Production deploys ONLY happen from the `pessy-website` branch using `bash deploy-with-landing.sh`.

## Allowed
- Read code, write code, run tests
- `npm run dev` (local dev server)
- `npm run build` (local build)
- `firebase deploy --only functions` (Cloud Functions only)

## Forbidden
- `firebase deploy` (breaks hosting)
- `firebase deploy --only hosting`
- `firebase deploy --only hosting:app`
- Any command that pushes to Firebase Hosting

## Why
This has broken production 4 times already. The website and app use a special deploy script that renames files. Deploying directly skips that process and serves a broken site.