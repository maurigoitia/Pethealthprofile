# Firebase Secret Manager — Secrets requeridos (SCRUM-90)

Estos secrets deben estar configurados en **Google Cloud Secret Manager** antes de desplegar las Cloud Functions de Gmail.

## Cómo crear un secret

```bash
# Crear secret vacío
gcloud secrets create SECRET_NAME --replication-policy="automatic"

# Asignar valor
echo -n "valor" | gcloud secrets versions add SECRET_NAME --data-file=-
```

## Secrets requeridos

| Secret name                | Descripción                                                                 | Dónde obtenerlo |
|----------------------------|-----------------------------------------------------------------------------|-----------------|
| `GMAIL_OAUTH_CLIENT_ID`    | OAuth 2.0 Client ID para Gmail                                              | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client |
| `GMAIL_OAUTH_CLIENT_SECRET`| OAuth 2.0 Client Secret                                                      | Mismo lugar que el Client ID |
| `GMAIL_OAUTH_REDIRECT_URI` | URI de redirección post-OAuth. En prod: `https://us-central1-polar-scene-488615-i0.cloudfunctions.net/gmailAuthCallback` | Configurar en Google Cloud Console → Authorized redirect URIs |
| `MAIL_TOKEN_ENCRYPTION_KEY`| Clave AES-256 para cifrar tokens en Secret Manager (32 bytes en hex)        | Generar con `openssl rand -hex 32` |

## Permisos IAM

El service account de Cloud Functions necesita el rol `Secret Manager Secret Accessor`:

```bash
gcloud projects add-iam-policy-binding polar-scene-488615-i0 \
  --member="serviceAccount:polar-scene-488615-i0@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Functions que los usan

- `getGmailConnectUrl` → `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_REDIRECT_URI`
- `gmailAuthCallback` → `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REDIRECT_URI`, `MAIL_TOKEN_ENCRYPTION_KEY`
- `syncAppointmentCalendarEvent` → `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `MAIL_TOKEN_ENCRYPTION_KEY`
- `disconnectGmailSync` → `MAIL_TOKEN_ENCRYPTION_KEY`

## Verificar que están configurados

```bash
gcloud secrets list --filter="name:GMAIL OR name:MAIL_TOKEN"
```
