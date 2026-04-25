# Pessy — Sprint Summary 24-25 abril 2026

> Listo para pegar a Notion. Cada `##` es bloque heading 2. Cada `|` tabla.

## 🎯 Objetivo del sprint

Cerrar el **audit feb-baseline** + integrar **Stitch design system** + cross-device persistence + features Gemini doc (QR, gamification streaks).

## 📦 Deploys a producción (pessy.app)

| # | Fecha | Highlights |
|---|---|---|
| 1 | 24-abr | OCR pipeline minimal + Co-tutor 4 canales |
| 2 | 24-abr | extractVetsFromArchives + IAM fix |
| 3 | 24-abr | Audit Feb-baseline 5/6 épicas |
| 4 | 24-abr | Cross-device intakes + Stitch preview + rioplatense policy |
| 5 | 24-abr | Gamification streaks + QR público |
| 6 | 25-abr | Stitch design en LoginScreen + WelcomeScreen reales |

## 🚀 Features shipped

### 1. Cross-device "tomado hoy" (Firestore `medication_intakes`)

- Reemplaza localStorage v1 por colección Firestore real
- Sync entre devices del owner + co-tutores
- Append-only (audit trail), no updates
- Firestore rules: read owner+coTutor, create con `takenBy === auth.uid`, delete solo owner
- Base para gamification streaks

### 2. Stitch design integrado (LoginScreen + WelcomeScreen)

- Hero compacto h-64 con illustration cork + logo Pessy
- Form bg-white + inputs Plano focus ring `#1A9B7D/30`
- Primary CTA pill rounded-[16px] bg-[#074738]
- Secondary CTA bg-accent/10 chip
- Material symbols (`visibility`/`visibility_off` en lugar de texto "Mostrar")
- Decorative blurs sutiles
- AuthPageShell removido (legacy dark gradient mobile / split desktop)

### 3. Gamification Fase A — Streaks reales

- Hook `useMedicationStreak(petId)` cliente-side
- Lee `medication_intakes` últimos 90 días
- Calcula racha actual + récord histórico
- Chip `🔥 N días al día con sus meds` en `PendienteHoyCard`
- **Solo aparece si streak ≥3 días** (regla "celebrar pequeño se siente fake")
- Sin XP, sin niveles, tono adulto

### 4. QR público + Perfil rescate

- `/p/:petId` ruta pública sin auth (rescatista no tiene Pessy)
- `PublicPetProfilePage` muestra: nombre, foto, contacto del dueño, alergias críticas
- `PetQRCodeModal` en perfil completo: activar modo perdido + editar contacto + descargar QR
- QR generado vía api.qrserver.com (sin nuevas deps)
- Firestore rules pets: read pública si `publicProfile.enabled === true`

## 🐛 Bugs fixed

| Bug | Severidad | Fix |
|---|---|---|
| OCR "ya registrada" en vacuna nueva | Crítico | Revert pipeline a backend minimal + fileHash dedup |
| Bug appqa /inicio mostraba LandingPreview viejo | Crítico | APP_HOSTS Set incluye pessy-qa-app.web.app |
| Co-tutor `?invite=CODE` perdido en redirect | Crítico | Preservar param en auth guard antes del redirect |
| 7 fotos perdidas de mascotas (commit 8a33c6d) | Crítico | Recovery via Admin SDK (Fase B) + parar sangrado (Fase A) |
| Med tomado no desaparecía | Mayor | Firestore intakes + filter `visibleItems` + fade-out 200ms |
| LostPetFeed mostraba "todas a salvo" inventado | Mayor | Empty state honesto |
| Subir documento duplicado (card + [+]) | Menor | Card eliminada |
| dailySuggestions hardcoded ("Limpieza de pliegues") | Menor | Bloque entero eliminado |

## 📐 Design System Stitch + Plano

> Aplicar este patrón a todas las pantallas (sprint en curso).

### Tokens de color

| Variable | Hex |
|---|---|
| Primary | `#074738` |
| Accent | `#1A9B7D` |
| Surface | `#E0F2F1` |
| Background | `#F0FAF9` |
| Text on surface | `#1A1A1A` |
| Text variant | `#6B7280` |
| Outline | `#E5E7EB` |
| Muted | `#9CA3AF` |

### Tipografía

- Headings: **Plus Jakarta Sans** (700-800)
- Body: **Manrope** (400-600)

### Componentes clave

**Hero compacto**
```html
<div class="h-64 relative overflow-hidden flex items-end px-5 pb-6">
  <img src="/illustrations/dark_top_surprised_cork_head.svg" class="absolute inset-0 w-full h-full object-cover opacity-90" />
  <div class="absolute inset-0 bg-gradient-to-t from-[#F0FAF9] via-[#F0FAF9]/40 to-transparent" />
  <div class="relative z-10">
    <div class="flex items-center gap-2 mb-2">
      <img src="/pessy-logo.svg" class="w-9 h-9" />
      <h1 class="text-[32px] font-extrabold text-[#074738] tracking-tight">Pessy</h1>
    </div>
    <p class="text-[15px] text-[#6B7280] max-w-[260px]">Tu mascota, sus cosas, todo en orden.</p>
  </div>
</div>
```

**Input estándar**
```html
<label class="text-[12px] font-semibold text-[#6B7280] block ml-1 uppercase tracking-wide">Email</label>
<input class="w-full h-14 px-4 bg-white border border-[#E5E7EB] rounded-[14px] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none text-[15px]" />
```

**Primary CTA**
```html
<button class="w-full h-14 bg-[#074738] hover:bg-[#0e5c49] text-white text-[15px] font-bold rounded-[16px] active:scale-[0.97] transition-transform shadow-[0_4px_14px_rgba(7,71,56,0.18)]">
  Ingresar
</button>
```

**Secondary CTA pill**
```html
<button class="px-6 py-2.5 rounded-full bg-[#1A9B7D]/10 text-[#1A9B7D] text-[14px] font-bold">
  Crear cuenta
</button>
```

## 📋 Pendientes próximo sprint

### P0 — Errores reportados por usuario
1. Errores de pantalla en `/comunidad` (debug + fix)
2. Errores de pantalla en módulo veterinario (debug + fix)

### P1 — Aplicar Stitch al resto de la app
1. RegisterUserScreen + RegisterPetStep1 + RegisterPetStep2 *(en curso)*
2. /comunidad
3. /buscar-vet
4. /cuidados
5. /historial
6. PetProfileModal interior (botón QR ya está)

### P2 — Features doc Gemini
1. Adoption matching score (0-100, push proactivo si ≥70)

### USER tasks
1. QA device pessy.app post-deploys
2. Activar QR de Thor + probar `/p/{thor-id}`
3. Curar `seed/learning-videos.csv` (multilingual, NO competidores)
4. Lighthouse mobile re-audit
5. Reportar errores específicos de comunidad/vet con screenshot

## 🔐 Reglas firmes (memoria persistente)

1. NEVER `firebase deploy` manual — solo via GitHub Actions
2. NEVER tocar auth/login/firebase.ts sin aprobación + QA
3. NO inventar data — solo extraída por IA o cargada por tutor
4. NO usar `framer-motion` (CSS transitions only)
5. Rioplatense OK para AR/UY/PY (default voice). Neutral para resto vía i18n
6. Tokens Plano siempre — no Material 3 raw

## 📞 URLs clave

| Entorno | URL |
|---|---|
| Producción | https://pessy.app |
| Staging QA | https://pessy-qa-app.web.app |
| GitHub repo | https://github.com/maurigoitia/Pethealthprofile |
| Firebase Console | proyecto polar-scene-488615-i0 |

## 📊 Métricas del sprint

- **Commits pushados:** ~70
- **Files changed:** 60+
- **Lines added:** +6,500
- **Lines removed:** -2,800 (limpieza)
- **Specs creados:** 6
- **Deploys prod:** 6
- **Bugs críticos arreglados:** 4
- **Features nuevas:** 8
