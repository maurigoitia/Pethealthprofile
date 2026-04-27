# Pessy — Repo Stabilization Status

> Snapshot of the repo stabilization work in progress.
> Updated: 2026-04-26.

---

## 1 · Completed phases

### ✅ Phase 0a — Branch model + protection

- **PR #75 merged** into `develop`.
- `docs/BRANCHES.md` documents:
  - branch model (`main`, `develop`, `feature/*`, `hotfix/*`),
  - deploy environments (production = pessy.app, staging = pessy-qa-app-1618a.web.app),
  - single-Firebase-project limitation,
  - PR + hotfix workflows,
  - file ownership.
- **Branch protection active:**
  - `main`: PR required, 1 approval, dismiss stale reviews, required status check `check`, conversation resolution required, enforce admins, no force-push, no deletions.
  - `develop`: PR required, required status check `check`, no force-push, no deletions.

### ✅ Phase 0b — Staging workflow safety

- **PR #76 merged** into `develop`.
- `.github/workflows/deploy-staging.yml` updated:
  - Header comment makes explicit that staging deploys HOSTING ONLY because backend resources are shared with production in the same Firebase project.
  - Smoke test step added after the deploy: `curl` to `https://pessy-qa-app-1618a.web.app` with retries; workflow fails red if HTTP != 200.
- Post-merge run of `Deploy — Staging (appqa)`: **green**.
- Smoke test step: **passed**.

---

## 2 · Current deploy model

| Branch | Purpose | Hosting site | Workflow |
|---|---|---|---|
| `main` | Production | `polar-scene-488615-i0` (pessy.app) | `deploy-prod.yml` |
| `develop` | Staging visual | `pessy-qa-app-1618a` | `deploy-staging.yml` |

- **Staging deploys hosting only.**
- **Backend resources** (Cloud Functions, Firestore rules, Firestore indexes, Storage rules, Authentication) are **shared** because there is only one Firebase project (`polar-scene-488615-i0`).
- Functions, rules, indexes, and storage are deployed **only from `main`** via `deploy-prod.yml`.

---

## 3 · Risks still open

- ⚠️ `preview.yml` failed on PR #76. The failure is **not required** by branch protection and was **unrelated** to the change in this PR (it tries to deploy a preview channel against the prod site, which has been failing on prior PRs as well). Not investigated yet.
- ⚠️ **Staging is visual, not real.** A new callable function or rule change that lives on `develop` is not testable on staging — it only goes live when merged to `main`.
- ⚠️ **Functions / rules / indexes / storage remain shared with production.** Any backend deploy from `main` impacts both environments simultaneously.

---

## 4 · Recommended next steps (not approved yet)

In suggested order:

1. **Phase 0c** — PR warning when a PR touches shared backend resources (`functions/`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`) from a branch other than `main`. Adds a comment in the PR explaining the change will not appear in staging.
2. **Phase 1** — Clean orphan Firebase config: remove `appit` and `appfocusqa` targets from `.firebaserc` and the matching blocks from `firebase.json` (their sites do not exist in the project). Optionally delete the dormant `develop` preview channel on the prod site.
3. **Later** — Create a second Firebase project (e.g. `pessy-staging`) so staging can deploy its own functions, rules, and indexes without touching production. This converts staging visual → staging real.

Separately (independent track):

- Review the **source-backed export** plan at `docs/superpowers/plans/2026-04-27-export-source-backed-safety-core.md`. Decide whether to schedule its implementation. Plan only — no code yet.

---

## 5 · Explicit non-actions

- 🚫 **No folder moves yet.** `src/`, `apps/website/`, `apps/blog/`, `capacitor.config.ts`, `ios/`, `android/`, `functions/` all stay where they are.
- 🚫 **No Firebase config cleanup yet.** `.firebaserc` and `firebase.json` keep their current orphan targets until Phase 1 is approved.
- 🚫 **No export implementation yet.** The source-backed safety plan is documented but not started.
- 🚫 **No deploys triggered manually.** Both environments are reaching their hosting from automated workflows on branch push.
- 🚫 **No new branches created.** The only protected branches are `main` and `develop`.
