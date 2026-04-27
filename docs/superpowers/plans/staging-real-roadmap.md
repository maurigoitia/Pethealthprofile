# Staging Real — Roadmap

**Status:** Draft — planning only, not approved for execution
**Owner:** Mauricio Goitia
**Created:** 2026-04-27
**Related:** deploy-prod.yml, deploy-staging.yml, .firebaserc, ENVIRONMENTS.md

---

## 1. Estado actual del staging

Hoy `appqa` (site `pessy-qa-app`) **comparte el proyecto Firebase de producción** (`polar-scene-488615-i0`). Significa:

- Mismo Firestore (mismas collections, mismos índices, mismos datos reales)
- Mismas Cloud Functions
- Mismo Auth
- Mismo Storage
- Mismas Security Rules
- Mismas API keys (las del cliente)

Lo único que está realmente separado es **la URL del hosting**. Por eso decimos "staging visual only".

Esto significa que hoy no se puede:
- Probar migraciones de Firestore sin tocar prod
- Probar nuevas Cloud Functions sin riesgo
- Probar cambios de rules sin afectar usuarios reales
- Romper datos en QA sin romper datos de producción

## 2. Por qué staging real importa

- El feature de export source-backed va a tocar pipelines de Gemini y Firestore. Si rompe algo, rompe prod.
- Cuando Pessy escale, cualquier migración de schema sin staging real es ruleta.
- Compliance / legal: separar datos reales de datos de prueba es higiene básica.
- Releases de mobile (Capacitor wrapper) van a necesitar un backend de staging para test antes de subir a App Store / Play Store.

Sin staging real, cada deploy a `main` es un deploy a producción ciego.

## 3. Proyecto propuesto

**Nombre:** `pessy-staging`
**GCP project ID:** `pessy-staging` (o el siguiente ID disponible si está tomado)
**Display name:** `Pessy Staging`
**Region default:** misma que prod (verificar en `firebase.json` de prod antes de crear)

Convención: `pessy-staging` corre con datos sintéticos, NUNCA con backups de producción. Si hace falta data realista, se generan fixtures.

## 4. Recursos Firebase requeridos en `pessy-staging`

- Firebase Authentication habilitado (Email + Google)
- Firestore (modo Native, misma región que prod)
- Cloud Functions (mismo runtime que prod — Node 22)
- Cloud Storage (un bucket default)
- Hosting con sites:
  - `pessy-staging-app` → mapeado a target `appqa` (reemplaza el actual)
- Secret Manager habilitado
- Cloud Scheduler habilitado (si Functions lo necesita)
- App Check (opcional, fase 2)

Todo aprovisionado por consola al inicio. Después se puede reproducir con `firebase init` corriendo contra el nuevo project.

## 5. GitHub vars y secrets necesarios

Nuevos:
- `FIREBASE_PROJECT_STAGING` = `pessy-staging`
- `FIREBASE_HOSTING_SITE_STAGING` = `pessy-staging-app`
- `WIF_PROVIDER_STAGING` = provider del nuevo proyecto
- `WIF_SERVICE_ACCOUNT_STAGING` = `pessy-github-deploy@pessy-staging.iam.gserviceaccount.com`
- `VITE_FIREBASE_CONFIG_STAGING` = config JSON del nuevo proyecto (para builds de QA)
- Cualquier `VITE_*` key que prod use, replicada con sufijo `_STAGING` o gestionada por environment

Existentes (no se tocan):
- Todo lo que termina en `_PROD` o sin sufijo apunta a `polar-scene-488615-i0`

Regla: ningún secret de prod se reusa en staging. Si se pisa una key, no debe afectar al otro.

## 6. WIF y service account

1. Crear service account `pessy-github-deploy@pessy-staging.iam.gserviceaccount.com`
2. Roles a otorgar (mismo set que prod):
   - Firebase Admin
   - Administrador de Secret Manager
   - Editor (`roles/editor`) — para Scheduler / Functions IAM
3. Configurar Workload Identity Federation:
   - Pool: reusar el de prod si la organización GCP lo permite, o crear uno nuevo
   - Provider de GitHub Actions con `repo:maurigoitia/pessy:ref:refs/heads/develop` permitido
4. Output → guardar como `WIF_PROVIDER_STAGING` y `WIF_SERVICE_ACCOUNT_STAGING`

## 7. Cambios futuros a `deploy-staging.yml`

(Workflow existe ya o hay que crearlo.)

Cambios:
- `project_id` apunta a `${{ vars.FIREBASE_PROJECT_STAGING }}`
- `auth` con `WIF_PROVIDER_STAGING` y `WIF_SERVICE_ACCOUNT_STAGING`
- Build usa el `.env.staging` correcto (vars con sufijo `_STAGING`)
- Deploy a `--only hosting:appqa,functions,firestore:rules,firestore:indexes,storage`
- Smoke test contra `https://pessy-staging-app.web.app` (no contra prod)
- Trigger: push a `develop`
- NUNCA dispara contra `main`. NUNCA toca `polar-scene-488615-i0`.

## 8. Estrategia de seed de datos

Opciones, en orden de preferencia:

**A. Fixtures sintéticos (recomendado).** Script `scripts/seed-staging.ts` que crea:
- 5 usuarios fake
- 5 mascotas fake (perro, gato, conejo, ave, exótico)
- Eventos médicos sintéticos cubriendo los casos del export source-backed
- Sin datos PII reales

**B. Snapshot anonimizado de prod.** Export de Firestore prod → script de anonimización (hash de emails, blur de campos libres) → import a staging. Sólo si A no alcanza para reproducir un bug.

**C. Datos vacíos.** Staging arranca limpio y el QA va creando datos manualmente. Útil para QA de onboarding.

Default: A. B sólo bajo aprobación explícita por el riesgo de fugas.

## 9. Mobile staging

Capacitor wrapper consume Firebase config del build. Para que mobile pueda probar contra staging:
- Build variant `staging` que inyecta `VITE_FIREBASE_CONFIG_STAGING`
- Bundle ID separado para staging build (ej. `com.pessy.app.staging`) para poder coexistir con prod en el mismo device
- Push notifications: registrar el bundle de staging en FCM del proyecto `pessy-staging`
- Deep links: dominio de staging (`pessy-staging-app.web.app`) configurado como Associated Domain en iOS y App Link en Android

Esto se hace después de que web staging esté funcionando.

## 10. Riesgos

- **Pisar prod por error de configuración.** Mitigación: cualquier workflow que toque `polar-scene-488615-i0` requiere branch `main`. Cualquier workflow contra `pessy-staging` requiere `develop`. Hardcodeado.
- **Costos duplicados.** Staging consume cuota gratis hasta cierto punto, después suma a la factura.
- **Drift entre staging y prod.** Si las rules / indexes / functions divergen, staging deja de ser representativo. Mitigación: ambos workflows usan los mismos archivos del repo, sólo cambia el project_id.
- **Secrets confundidos.** Riesgo de copiar un secret de prod a staging o viceversa. Mitigación: convención de naming estricta, review obligatorio en PRs que tocan workflows.

## 11. Costos estimados

Mientras staging tenga tráfico interno (founder + QA + algún tester):
- Firestore: free tier alcanza
- Functions: free tier alcanza
- Hosting: free tier alcanza
- Storage: free tier alcanza
- Secret Manager: free tier alcanza

Estimación realista: **~USD 0–10 / mes** mientras no haya tráfico real. Compatible con el budget declarado ($200/mes mes 1, $300/mes mes 4, máx $1000/mes año 1).

Si se decide hacer load testing en staging, prever spike y apagarlo después.

## 12. Plan de rollback

Staging no afecta prod por diseño. El "rollback" relevante es:
- Si `pessy-staging` se rompe → se borra el proyecto y se recrea. Sin impacto en prod.
- Si un workflow accidental dispara contra prod → revertir commit, redeploy de prod desde el último tag estable.
- Si los secrets se confunden → rotar todos los secrets de ambos entornos, regenerar service accounts.

Backups de prod siguen siendo responsabilidad del workflow de prod, independientes de este plan.

## 13. Regla explícita

**No ejecutar nada de este plan sin aprobación manual del founder.**

Crear `pessy-staging`, mover secrets, modificar workflows, todo eso requiere un go/no-go explícito. Este documento es checkpoint, no autorización.

## 14. Out of scope

- Crear el proyecto GCP
- Modificar `.firebaserc`
- Modificar `deploy-prod.yml`
- Cambios de DNS
- Migración de datos reales

Esos pasos se planean y aprueban uno por uno cuando se decida arrancar.
