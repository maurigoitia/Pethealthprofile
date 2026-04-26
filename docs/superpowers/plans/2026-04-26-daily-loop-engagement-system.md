# Pessy Daily Loop + Engagement Tracking — Production Plan

**Goal:** Sistema tipo Duolingo aplicado a Pet Care: 3-5 micro-sesiones por día, cada una <10s. Notificaciones inteligentes (no spam) + tracking real de retención.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ TRIGGERS (Cloud Scheduler)                              │
│  morning  (08-10 local)  → dailyLoopMorning            │
│  midday   (12-14 local)  → dailyLoopMidday             │
│  afternoon(16-18 local)  → dailyLoopAfternoon          │
│  night    (20-22 local)  → dailyLoopNight              │
│  recovery (24/48/72h idle) → dailyLoopRecovery         │
└─────────────────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────┐
│ DECISION ENGINE                                         │
│  read pet+events+meds+appointments                      │
│  decide should_notify? (action / context / engagement)  │
│  pick reason + urgency                                  │
│  log decision to notification_decisions                 │
└─────────────────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────┐
│ FCM SEND                                                │
│  payload = { title, body, deeplink, type }             │
│  log result to notification_events                      │
└─────────────────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────┐
│ CLIENT TRACKING                                         │
│  on app open → recordEngagementEvent("open")           │
│  on action  → recordEngagementEvent("action_done")     │
│  on complete → recordEngagementEvent("day_closed")     │
└─────────────────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────┐
│ DAILY AGGREGATOR (cron 03:00 UTC)                       │
│  computes per-day:                                      │
│   - DAU/WAU/MAU                                         │
│   - notification_to_open_rate                           │
│   - notification_to_action_rate                         │
│   - streak_distribution                                 │
│   - avg_micro_sessions_per_day                          │
│  writes to daily_loop_metrics/{YYYY-MM-DD}             │
└─────────────────────────────────────────────────────────┘
```

## Firestore schema

### `notification_decisions/{decisionId}`
```ts
{
  uid, petId, ts,
  trigger: "morning"|"midday"|"afternoon"|"night"|"recovery",
  decision: "send"|"skip",
  reason: "action"|"context"|"engagement"|"no_action_needed"|"already_active_today",
  urgency: "high"|"medium"|"low",
  payload?: { title, body, deeplink, type }
}
```

### `notification_events/{eventId}`
Cada FCM enviado:
```ts
{
  uid, petId, ts, decisionId,
  type, title, body, deeplink,
  fcmMessageId,
  delivered: bool,
  opened?: ts,
  actionDone?: ts
}
```

### `engagement_events/{eventId}`
Cada interacción del usuario:
```ts
{
  uid, petId, ts,
  type: "open"|"action_done"|"day_closed"|"notification_opened",
  source: "app"|"notification"|"deeplink",
  notificationEventId?: string,
  actionType?: string  // "confirm_meal"|"confirm_walk"|"medication_check"|...
}
```

### `daily_loop_metrics/{YYYY-MM-DD}`
Agregado diario:
```ts
{
  date,
  dau, wau, mau,
  notificationsSent, notificationsOpened, openRate,
  actionsCompleted, actionRate,
  avgSessionsPerActiveUser,
  streakDistribution: { "1d": N, "3d": N, "7d": N, ... },
  recoveryAttempts, recoverySuccess,
  computedAt
}
```

## Decision rules per trigger

### morning (08-10 local)
- Si hay tareas pendientes hoy → notificar "Hoy tenés N cosas para {pet}"
- Si no hay tareas → buscar contexto (clima/season) → "Buen día para X"
- Si nada → skip

### midday (12-14 local)
- Si user no entró hoy + hay tareas mañana sin completar → "Te falta esto (1 tap)"
- Si user ya entró hoy → skip

### afternoon (16-18 local)
- Si rutina del día sin cerrar → "¿Confirmaste el paseo?"
- Else context-based (weather permitting walk, etc.)

### night (20-22 local)
- Si día cerrado → silencio
- Si abrió app pero no completó tareas → "Te falta cerrar el día"
- Si no abrió app → "¿Cómo estuvo {pet} hoy?"

### recovery (cada 6h, decide internamente)
- Si lastActivity < 24h → skip
- 24-48h: "Te toma menos de 1 minuto"
- 48-72h: "Ayer no registraste nada"
- 72h+: "Podés retomar en 1 minuto"
- 7d+: stop sending (anti-spam)

## Tasks

1. ✅ `functions/src/engagement/dailyLoop.ts` — 5 scheduled functions
2. ✅ `functions/src/engagement/engagementTracking.ts` — callable + aggregator
3. ✅ Firestore rules para nuevas colecciones (read own data, write via Functions only)
4. ✅ Export desde `functions/src/index.ts`
5. ⏳ Cliente: `recordEngagementEvent` wrapper en `src/lib/engagement.ts`
6. ⏳ Cliente: hooks en App.tsx (open), QuickActions (action_done), routine completion (day_closed)
7. ⏳ Dashboard interno: tabla con `daily_loop_metrics` (admin-only)

## Anti-spam guardrails

- Máx 5 notificaciones/día por usuario (hard cap)
- Cooldown 90 min entre notificaciones del mismo usuario
- Si user abrió app en últimas 2h → skip todos los triggers excepto recovery
- Settings respect: `notificationSettings.dailyLoop = false` → opt-out global
- Quiet hours: 22:00-07:00 local (no enviar)

## Out of scope (next iteration)

- A/B testing framework para mensajes
- ML-driven personalización de horarios (fase 2 con suficiente data)
- Web push (solo FCM mobile por ahora)
- Email fallback si FCM token expirado
