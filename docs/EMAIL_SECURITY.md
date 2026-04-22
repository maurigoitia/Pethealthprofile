# Email Security — pessy.app

## Estado actual (Abril 2026)

### DNS Records configurados
| Tipo | Host | Valor | Estado |
|------|------|-------|--------|
| SPF | `@` | `v=spf1 include:_spf.google.com ~all` | ✅ Activo |
| DKIM | `google._domainkey` | (clave Google Workspace) | ✅ Activo |
| DMARC | `_dmarc` | `v=DMARC1; p=none; rua=mailto:mauri@pessy.app` | ⚠️ Solo monitoreo |

### DNS Records pendientes (acción manual requerida)

#### 1. DMARC — subir a quarantine
```
_dmarc.pessy.app TXT "v=DMARC1; p=quarantine; pct=25; rua=mailto:mauri@pessy.app; ruf=mailto:mauri@pessy.app; adkim=s; aspf=s"
```
Cambiar de `p=none` → `p=quarantine; pct=25` en Google Cloud DNS.

#### 2. MTA-STS — policy DNS
```
_mta-sts.pessy.app TXT "v=STSv1; id=20260421"
```
El archivo `/.well-known/mta-sts.txt` ya está en Firebase Hosting (modo `enforce`).

#### 3. TLS-RPT — reportes de entrega
```
_smtp._tls.pessy.app TXT "v=TLSRPTv1; rua=mailto:mauri@pessy.app"
```

#### 4. BIMI — logo en bandejas de entrada
```
default._bimi.pessy.app TXT "v=BIMI1; l=https://pessy.app/.well-known/bimi.svg"
```
El logo `/.well-known/bimi.svg` ya está en Firebase Hosting.

#### 5. SPF para Resend (cuando se configure)
Agregar `include:_spf.resend.com` al registro SPF existente:
```
v=spf1 include:_spf.google.com include:_spf.resend.com ~all
```

### Archivos estáticos (ya deployados en pessy.app)
- `/.well-known/mta-sts.txt` — política MTA-STS modo `enforce`
- `/.well-known/bimi.svg` — logo Pessy "P" verde oscuro
- `/.well-known/security.txt` — contacto de seguridad

### Aliases Google Workspace (crear manualmente)
Entrar a https://admin.google.com/ac/users y agregar:
- `hola@pessy.app` → mauri@pessy.app (alias gratis)
- `dmarc@pessy.app` → mauri@pessy.app (alias gratis)
- `seguridad@pessy.app` → it@pessy.app (alias gratis)

### Resend DKIM
Configurar en https://resend.com/domains:
1. Agregar dominio `pessy.app`
2. Copiar registros DKIM y TXT a Google Cloud DNS
3. Verificar → SPF incluir `_spf.resend.com`
