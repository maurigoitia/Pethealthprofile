# Pessy — Deploy Guide

## Entornos

| Entorno | Branch | URL | Firebase target |
|---------|--------|-----|-----------------|
| Staging | `develop` | appqa.web.app | `appqa` |
| Producción | `main` | pessy.app | `app` |

---

## Deploy manual

### Staging
```bash
git checkout develop
./scripts/deploy-staging.sh
# Con functions:
./scripts/deploy-staging.sh --with-functions
```

### Producción
```bash
git checkout main
./scripts/deploy-prod.sh
```

---

## CI/CD automático (GitHub Actions)

| Trigger | Workflow | Acción |
|---------|----------|--------|
| PR a `main`/`develop` | `ci.yml` | TypeScript + lint + build |
| Push a `develop` | `deploy-staging.yml` | Deploy automático a appqa |
| Push a `main` | `deploy-prod.yml` | Deploy a prod |
| Push a `main` | `android-build.yml` | Build AAB firmado |

---

## Secrets requeridos en GitHub

```
FIREBASE_TOKEN       # firebase login:ci
KEYSTORE_BASE64      # base64 < android/app/pessy-release.keystore
KEYSTORE_PASSWORD    # jOeAuYRej9gAHn2WBev9tMbz
KEY_ALIAS            # pessy-key
KEY_PASSWORD         # jOeAuYRej9gAHn2WBev9tMbz
```

Para obtener el FIREBASE_TOKEN:
```bash
npx firebase-tools login:ci
```
