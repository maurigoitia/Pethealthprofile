# Pessy — Branch & Deploy Model

## Branches

| Branch | Purpose | Auto-deploy | Protection |
|---|---|---|---|
| `main` | Production. pessy.app live state. | `deploy-prod.yml` on workflow_dispatch (CI runs first via PR) | PR required, 1 approval, no force-push |
| `develop` | Staging integration branch. | `deploy-staging.yml` on push (hosting only) | PR required, CI must pass |
| `feature/<scope>-<name>` | New features | None | None |
| `hotfix/<scope>-<name>` | Urgent fixes from main | None | None |

## Deploy environments

| Environment | URL | Firebase site | Branch | Auto-deployed by |
|---|---|---|---|---|
| Production | https://pessy.app | `polar-scene-488615-i0` | `main` | `deploy-prod.yml` |
| Staging | https://pessy-qa-app-1618a.web.app | `pessy-qa-app-1618a` | `develop` | `deploy-staging.yml` |

## ⚠️ Single Firebase project — important limitation

We have **only one Firebase project** (`polar-scene-488615-i0`). Production and staging share:

- Cloud Functions (callables, triggers, scheduled jobs)
- Firestore rules + indexes
- Storage rules
- Authentication

**Implications:**

- `deploy-staging.yml` deploys ONLY hosting (`hosting:appqa`).
- Functions, Firestore rules, and Storage rules are **deployed only from `main`**.
- A new callable function written in a feature branch will NOT be available on staging until it is merged to `main`.
- This is **staging visual** — you preview UI changes against the **production backend** snapshot.

If you need staging real (full backend isolation), the medium-term plan is to add a second Firebase project (e.g. `pessy-staging`). See roadmap notes at the bottom of this file.

## PR workflow (estándar)

1. Branch from `develop`: `git checkout -b feature/auth-google-signin develop`.
2. Open PR → `develop`. CI runs (TS + tests + build).
3. Merge to `develop` → auto-deploys to staging hosting.
4. Validate visually on https://pessy-qa-app-1618a.web.app.
5. When ready, open PR `develop` → `main`. 1 approval required.
6. Merge to `main` → manually trigger `deploy-prod.yml` (workflow_dispatch).
7. Validate https://pessy.app.

## Hotfix flow

1. Branch from `main`: `git checkout -b hotfix/csp-emergency main`.
2. PR → `main`. CI must pass.
3. Merge to `main` → trigger `deploy-prod.yml`.
4. **Backport to `develop`**: open PR `main` → `develop` to keep branches in sync.

## Forbidden

- ❌ Manual `firebase deploy` from local terminal.
- ❌ Force-push to `main`.
- ❌ Direct commit to `main` or `develop` (must go via PR).
- ❌ Skipping CI checks.
- ❌ Deploying functions or rules from a branch other than `main` (until second Firebase project exists).

## Branch protection rules to enable on GitHub

Set these in **Settings → Branches → Add rule**.

### Rule for `main`

- ✅ Require a pull request before merging
- ✅ Require approvals: **1**
- ✅ Dismiss stale approvals when new commits are pushed
- ✅ Require status checks to pass: `check` (CI)
- ✅ Require branches to be up to date before merging
- ✅ Require conversation resolution
- ✅ Restrict who can push to matching branches (nobody pushes directly)
- ❌ Do NOT allow force pushes
- ❌ Do NOT allow deletions

### Rule for `develop`

- ✅ Require a pull request before merging
- ✅ Require status checks to pass: `check`
- ✅ Require branches to be up to date before merging
- ❌ Do NOT allow deletions
- ⚠️ Force pushes: leave disabled if possible (only enable in emergency, log via audit)

### `feature/*` and `hotfix/*`

- No protection rules. Free to iterate.
- Naming convention:
  - `feature/<scope>-<short-name>` (e.g. `feature/pdf-ai-narrative`)
  - `hotfix/<scope>-<short-name>` (e.g. `hotfix/auth-redirect-loop`)

## File responsibilities

| File / folder | Owned by | Notes |
|---|---|---|
| `firebase.json` | infra | Hosting targets + functions config + emulators |
| `.firebaserc` | infra | Project ID + hosting targets mapping |
| `firestore.rules` | infra/security | Deployed only from `main` |
| `firestore.indexes.json` | infra | Deployed only from `main` |
| `storage.rules` | infra/security | Deployed only from `main` |
| `functions/` | backend | Deployed only from `main` |
| `apps/pwa/src/` | frontend PWA | Deployed via hosting (both staging and prod) |
| `apps/web/` | landing | Static, copied to dist by postbuild |
| `apps/blog/` | blog | Static, copied to dist by postbuild |
| `capacitor.config.ts`, `ios/`, `android/` | mobile | Wraps the same `dist/` |

## Roadmap — staging real (medium term)

Right now staging shares backend with prod. To have a fully isolated staging:

1. Create second Firebase project (e.g. `pessy-staging`).
2. Update `.firebaserc` with two aliases (`default` = prod, `staging` = new).
3. Update `deploy-staging.yml` to use `--project staging` and to also deploy `functions`, `firestore:rules`, `firestore:indexes`, `storage`.
4. Add staging-specific GitHub repo vars (`STAGING_VITE_FIREBASE_*`).
5. Optional: register web app + mobile apps in the new project.

Until that exists, staging is **staging visual**, not staging real. Treat it accordingly.
