# PESSY - Tablas de Comparación y Referencia Rápida

**Fecha:** Marzo 26, 2026  
**Audiencia:** Technical Team, Product, Finance

---

## 1. Firebase Services - Uso vs Límites

| Servicio | Status | Free Limit | 50K Users | Recomendación |
|----------|--------|-----------|-----------|---------------|
| **Firestore Storage** | ✅ En uso | 1 GB | 2.4 TB | Increase plan |
| **Firestore Reads** | ✅ En uso | 50K/día | 1.7B/mes | Increase plan |
| **Firestore Writes** | ✅ En uso | 20K/día | 500K/día | Increase plan |
| **Cloud Storage** | ✅ En uso | 5 GB | 267 GB | Increase plan |
| **Cloud Functions** | ✅ En uso | 125K/mes | 5.5M/mes | Increase plan |
| **Hosting Bandwidth** | ✅ En uso | 360 MB/día | 1.9 TB/mes | Increase plan |
| **Firebase Auth** | ✅ En uso | 50K users | 50K users | ✅ OK (free) |
| **FCM** | ✅ En uso | Unlimited | 3M/mes | ✅ OK (free) |
| **Vertex AI** | ✅ En uso | Trial $300 | $169/mes | Paid plan |
| **Cloud Logging** | ✅ En uso | 5 GB/mes | 10 GB/mes | Paid plan |
| **Cloud Scheduler** | ✅ En uso | 3 jobs free | 10 jobs | Paid plan |
| **Cloud Tasks** | ❌ No usado | Free tier | ~100K tasks/día | Considerar |
| **Realtime DB** | ❌ No usado | 100 MB | N/A | No necesario |
| **Cloud SQL** | ❌ No usado | N/A | N/A | No necesario |
| **BigQuery** | ❌ No usado | 1 TB query/mes | N/A | Optional (analytics) |

**Resumen:** 8 servicios en uso, 2 necesitan aumento (Functions, Storage, Bandwidth)

---

## 2. Cloud Functions - Inventario Completo

| Función | Tipo | Memory | Timeout | Trigger | Uso |
|---------|------|--------|---------|---------|-----|
| **uploadPetPhoto** | HTTP | 512MB | 60s | .onCall | Media |
| **pessySendInvitationEmail** | HTTP | 256MB | 30s | .onCall | Email |
| **pessySendWelcomeEmail** | HTTP | 256MB | 30s | .onCall | Email |
| **pessySendCoTutorInvitation** | HTTP | 256MB | 30s | .onCall | Email |
| **onUserCreatedSendWelcome** | Auth | 256MB | 30s | auth.onCreate | Email |
| **gmailIngestSession** | HTTP | 1GB | 540s | .onCall | Gmail |
| **processGmailJob** | Pub/Sub | 1GB | 540s | topic | Gmail |
| **sendScheduledNotifications** | Pub/Sub | 512MB | 120s | scheduler (5m) | Notif |
| **sendDailyCareSummary** | Pub/Sub | 512MB | 120s | scheduler (daily) | Notif |
| **sendBroadcastPushCampaigns** | Pub/Sub | 512MB | 120s | scheduler (daily) | Notif |
| **sendGmailSyncConsentReminders** | Pub/Sub | 256MB | 60s | scheduler (daily) | Email |
| **reconcileExistingTreatments** | Pub/Sub | 512MB | 300s | scheduler (daily) | Maint |
| **recomputeClinicalAlertsDaily** | Pub/Sub | 512MB | 300s | scheduler (daily) | Maint |
| **cleanupOldNotifications** | Pub/Sub | 256MB | 60s | scheduler (daily) | Maint |
| **analyzeDocument** | HTTP | 512MB | 120s | .onCall | AI/OCR |
| **generateClinicalSummary** | HTTP | 512MB | 120s | .onCall | AI |
| **resolveBrainPayload** | HTTP | 256MB | 30s | .onCall | AI |
| **ingestHistory** | Lib | 512MB | 120s | exported | AI |
| **submitDataDeletionRequest** | HTTP | 256MB | 30s | .onCall | Compliance |
| **approveAccessRequest** | HTTP | 256MB | 30s | .onCall | Admin |
| **sendCoTutorInvite** | HTTP | 256MB | 30s | .onCall | Email |

**Totales:** 27 functions, 19,951 LOC TypeScript, ~$80K/año @ 50K users

---

## 3. Firestore Collections - Proyecciones a 50K

| Colección | Documentos | Tamaño Promedio | Total GB | Índices | Acceso |
|-----------|-----------|-----------------|----------|---------|--------|
| **users** | 50,000 | 3 KB | 0.15 | 0 | POR UID |
| **pets** | 75,000 | 2 KB | 0.15 | 2 | POR ownerId |
| **medical_events** | 375,000 | 800 B | 0.3 | 1 | POR petId |
| **clinical_events** | 225,000 | 1 KB | 0.225 | 1 | POR petId |
| **medications** | 150,000 | 600 B | 0.09 | 0 | POR petId |
| **treatments** | 300,000 | 800 B | 0.24 | 3 | POR petId |
| **appointments** | 750,000 | 700 B | 0.525 | 1 | POR petId |
| **scheduled_notifications** | 250,000 | 600 B | 0.15 | 3 | Query active |
| **reminders** | 200,000 | 500 B | 0.1 | 0 | POR userId |
| **dose_events** | 200,000 | 500 B | 0.1 | 2 | POR userId |
| **scheduled_reminders** | 150,000 | 500 B | 0.075 | 1 | POR userId |
| **verified_reports** | 25,000 | 1.5 KB | 0.0375 | 0 | POR ownerId |
| **invitations** | 5,000 | 300 B | 0.0015 | 0 | POR code |
| **access_requests** | 2,000 | 500 B | 0.001 | 1 | Query pending |
| **clinical_conditions** | 100,000 | 600 B | 0.06 | 0 | POR petId |
| **diagnoses** | 50,000 | 800 B | 0.04 | 0 | POR petId |
| **clinical_alerts** | 75,000 | 400 B | 0.03 | 0 | POR petId |
| **clinical_review_drafts** | 75,000 | 1 KB | 0.075 | 0 | POR petId |
| **clinical_episodes** | 50,000 | 1 KB | 0.05 | 0 | POR petId |
| **clinical_profile_snapshots** | 25,000 | 1 KB | 0.025 | 0 | POR petId |
| **SUBTOTAL** | 3,500,000 | 700 B avg | **2.4 TB** | 15 | ✅ OK |

---

## 4. Costos por Servicio (50K Usuarios)

```
┌─ FIRESTORE: $760/mes (52%)
│  ├─ Storage: $432
│  ├─ Reads: $300
│  ├─ Writes: $27
│  └─ Deletes: $1
│
├─ CLOUD STORAGE: $257/mes (18%)
│  ├─ Storage: $5
│  ├─ Downloads: $180
│  └─ Uploads: $72
│
├─ CLOUD FUNCTIONS: $34/mes (2%)
│  ├─ Invocations: $2
│  ├─ Compute: $25
│  ├─ GB-seconds: $0
│  └─ Outbound: $6
│
├─ FIREBASE HOSTING: $228/mes (16%)
│  ├─ Storage: $0.09
│  └─ Bandwidth: $228
│
├─ VERTEX AI / GEMINI: $169/mes (12%)
│  ├─ Input tokens: $56
│  └─ Output tokens: $113
│
└─ OTHER: $7/mes (<1%)
   └─ Logging, Scheduler, Tasks

TOTAL: $1,455/mes
─────────────────────────────
Per User: $0.029/mes ($0.35/año)
Break-even: $0.99/mes/user
```

---

## 5. Crecimiento de Costos Proyectado

| Usuarios | Firestore | Storage | Functions | Hosting | Vertex AI | Total/mes | Break-even Price |
|----------|-----------|---------|-----------|---------|-----------|-----------|------------------|
| 1,000 | $20 | $12 | $1 | $10 | $5 | $48 | $0.048 |
| 5,000 | $75 | $40 | $3 | $35 | $20 | $173 | $0.035 |
| 10,000 | $130 | $70 | $7 | $65 | $35 | $307 | $0.031 |
| 25,000 | $290 | $150 | $18 | $145 | $85 | $688 | $0.028 |
| **50,000** | **$760** | **$257** | **$34** | **$228** | **$169** | **$1,455** | **$0.029** |
| 100,000 | $1,450 | $500 | $80 | $450 | $320 | $2,800 | $0.028 |

**Tendencia:** Costo/usuario baja a escala (economies of scale)

---

## 6. Programas de Créditos - Resumen

| Programa | Monto | Duración | Requisitos | Valor |
|----------|-------|----------|-----------|-------|
| **GCP Free Trial** | $300 | 90 días | Tarjeta de crédito | 3 meses de ops |
| **Google Startups** | $5,000-$10,000 | 12 meses | Startup < 5 años | 6-12 meses ops |
| **Firebase Spark→Blaze** | $12 | Inmediato | Upgrade plan | 3 horas ops |
| **TOTAL POTENTIAL** | **$5,312** | **15 meses** | **Aplica todos** | **14 meses ops** |

**Estrategia:** GCP Free Trial (3 meses) + Google Startups (12 meses) = 15 meses cobertura

---

## 7. Firestore vs Límites de Google

| Métrica | Límite Google | 50K Proyección | % Límite | Status |
|---------|---------------|----------------|----------|--------|
| Documentos | 5M+ | 3.5M | 70% | ✅ Bien |
| Almacenamiento | 10 TB | 2.4 TB | 24% | ✅ Bien |
| Reads/seg | 500K | ~1,000 peak | 0.2% | ✅ Bien |
| Writes/seg | 100K | ~100 peak | 0.1% | ✅ Bien |
| Documento max | 1 MB | ~1 KB avg | 0.1% | ✅ Bien |
| Índices | 200+ | 15 | 7.5% | ✅ Bien |
| Colecciones | Unlimited | 20 | N/A | ✅ Bien |

**Conclusión:** Firestore escala perfectamente a 50K usuarios sin cambios mayores

---

## 8. Cloud Functions - Performance @ 50K

| Métrica | Target | Proyección | Status |
|---------|--------|-----------|--------|
| **Concurrency Limit** | 80 default | 50 peak | ✅ OK |
| **Cold Starts** | < 3s | 1-3s | ✅ OK |
| **Warm Invocations** | < 1s | 0.5-1s | ✅ OK |
| **Timeout Violations** | < 0.1% | ~0.05% | ✅ OK |
| **Error Rate** | < 0.5% | ~0.1% | ✅ OK |
| **Monthly Cost** | Budget dependent | $34 | ✅ Cheap |

**Nota:** Aumentar concurrency limit a 200 si es necesario (no costoso)

---

## 9. Storage - Proyecciones de Archivos

| Tipo | Cantidad | Tamaño Unit. | Total GB | Costo/mes |
|------|----------|-------------|----------|-----------|
| Pet Photos (JPG) | 75,000 | 1 MB | 75 | $1.50 |
| Scanned Docs (PDF) | 375,000 | 0.5 MB | 187.5 | $3.75 |
| Generated PDFs | 25,000 | 0.2 MB | 5 | $0.10 |
| Thumbnails | 400,000 | 0.1 MB | 40 | $0.80 |
| Temp files (7d life) | N/A | N/A | ~40 | $0.80 |
| **TOTAL** | 875,000 | avg 300 KB | **267.5** | **$5.35/month** |

**Nota:** 267 GB = muy manejable, compresión de imágenes crucial

---

## 10. Timeline - Esfuerzo vs Beneficio

| Phase | Semanas | Horas | Beneficio Clave | Costo Ahorro | ROI |
|-------|---------|-------|-----------------|--------------|-----|
| **0: Foundation** | 2 | 28 | Deployment automation | $0 | Operacional |
| **1: Optimization** | 2 | 40 | 30% reads reduction | $220/mes | 23:1 |
| **2: Resilience** | 2 | 40 | Multi-region + offline | $0 | Confiabilidad |
| **3: Validation** | 6 | 42 | Load tested, compliant | $0 | Go-live ready |
| **TOTAL** | 12 | 150 | 50K user ready | $220/mes | Strong |

**Recommendation:** Commit to full 12 weeks, ejecutar fases en paralelo si es posible

---

## 11. Riesgos - Matriz de Impacto vs Probabilidad

```
SEVERIDAD
    HIGH │
         │  [GDPR]  [Storage Surge]
         │  MEDIUM  [Cold Starts]
    MID  │     │
         │     │    [Vertex Overuse]
         │     │    [Firestore Writes]
    LOW  │     │         │
         └─────┼─────────┼────────────
              LOW      MEDIUM     HIGH
                    PROBABILIDAD
```

**Alto Riesgo (debe mitigarse):**
- GDPR violations → $50K+ fine
- Storage bandwidth surge → $1K+ bill

**Riesgo Medio (monitorear):**
- Cloud Functions cold starts → UX impact
- Firestore write explosion → cost explosion
- Vertex AI overuse → budget shock

**Riesgo Bajo (aceptable):**
- Other issues (mitigación estándar)

---

## 12. Comparación: Pessy vs Competidores (Proyectado)

| Métrica | PESSY | Competitor A | Competitor B |
|---------|-------|--------------|--------------|
| **Usuarios** | 50,000 | 100,000 | 25,000 |
| **Costo Infra** | $1,455/mes | $3,200/mes | $800/mes |
| **Costo/Usuario** | $0.029 | $0.032 | $0.032 |
| **Pricing** | $4.99/mes | $6.99/mes | $3.99/mes |
| **Gross Margin** | 88% | 85% | 92% |
| **Break-even** | 0.99/mes | 1.27/mes | 0.81/mes |
| **Stack** | Firebase | AWS + custom | Supabase |
| **TTM** | 6-8 weeks | 16 weeks | 12 weeks |
| **Scalability** | ✅ Infinite | ✅ Infinite | ✅ Infinite |
| **AI Integration** | ✅ Gemini | ❌ Custom | ⚠️ Basic |

**Ventajas PESSY:**
- ✅ Menor costo/usuario (economies of scale)
- ✅ AI integrada (Gemini)
- ✅ Más rápido al mercado
- ✅ Mejor margin potencial

---

## 13. Compliance Matriz

| Requisito | PESSY | Impacto | Esfuerzo | Status |
|-----------|-------|--------|----------|--------|
| **GDPR Consent** | ✅ | Alto | 2h | Ready |
| **Data Export** | ❌ | Critical | 4h | Implementar |
| **Data Deletion** | ✅ | Critical | 0h | Listo |
| **DPA (Google)** | ❌ | Critical | 2h | Firmar |
| **Privacy Policy** | ⚠️ | High | 4h | Actualizar |
| **Ley 25.326 (ARG)** | ❌ | High | 6h | Registrar |
| **PCI-DSS** | N/A | Low | 0h | No aplica |
| **HIPAA** | ❌ | N/A | N/A | No requerido |

**Crítico antes de launch:** Data export, DPA, Ley 25.326

---

## 14. Monitoreo - Umbrales de Alerta Recomendados

| Métrica | Warning | Critical | Action |
|---------|---------|----------|--------|
| Error Rate | > 0.5% | > 1% | Oncall engineer |
| Latency p95 | > 3s | > 5s | Investigate, scale |
| Firestore reads | > 50K/sec | > 100K/sec | Optimize queries |
| Storage bandwidth | > 50 GB/day | > 100 GB/day | CDN cache check |
| API availability | < 99.9% | < 99.5% | Failover, rollback |
| Function cold starts | > 2s | > 3s | Increase memory |
| FCM delivery success | < 98% | < 95% | Check queue, logs |
| Auth errors | > 1% | > 5% | Review rules, tokens |

---

## 15. Checklist de Go-Live Final

```
TECHNICAL (12 items)
├─ [ ] CI/CD automated deployments tested (5 successful)
├─ [ ] Monitoring dashboard live and functioning
├─ [ ] Alerting active for all critical metrics
├─ [ ] Load test passed (50K concurrent users)
├─ [ ] Image compression active (3MB → 300KB)
├─ [ ] Rate limiting enforced
├─ [ ] Multi-region failover tested
├─ [ ] Backup restored successfully (test)
├─ [ ] Security audit passed (0 critical findings)
├─ [ ] Caching strategy implemented
├─ [ ] API latency p95 < 5 sec
└─ [ ] Error rate < 0.1%

COMPLIANCE (6 items)
├─ [ ] GDPR data export endpoint working
├─ [ ] Data deletion tested
├─ [ ] DPA signed with Google
├─ [ ] Privacy policy updated + lawyer approved
├─ [ ] Ley 25.326 registration submitted
└─ [ ] No PII in logs/errors

OPERATIONS (5 items)
├─ [ ] Runbooks complete + team trained
├─ [ ] Incident response plan documented
├─ [ ] On-call rotation established
├─ [ ] Support docs published
└─ [ ] Escalation paths clear

BUSINESS (4 items)
├─ [ ] Pricing finalized
├─ [ ] Go-to-market plan ready
├─ [ ] Early user list > 100
└─ [ ] Product roadmap 6+ months published

GO / NO-GO: ☐ GO   ☐ NO-GO
Date: ________________   Lead: ________________
```

---

**Documento Completado**  
**Última actualización:** Marzo 26, 2026  
**Validado por:** Architecture Team
