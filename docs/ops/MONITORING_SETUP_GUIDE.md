# GUÍA DE MONITORING PARA PESSY (50K USUARIOS)

## Estado Actual: ❌ SIN MONITORING

Este documento describe la implementación de un stack de monitoring production-ready para escalar a 50K usuarios.

---

## 1. FIREBASE ERROR REPORTING (Gratis, nativo)

### Setup Inmediato

```typescript
// functions/src/utils/errorHandler.ts
import * as functions from "firebase-functions";

export function handleError(error: unknown, context: any) {
  const timestamp = new Date().toISOString();
  
  console.error(JSON.stringify({
    timestamp,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    uid: context?.auth?.uid,
    function: context?.functionName,
    severity: "ERROR",
  }));
}

// En cada Cloud Function:
export const myFunction = functions.https.onCall(async (data, context) => {
  try {
    // logic
  } catch (error) {
    handleError(error, context);
    throw new functions.https.HttpsError("internal", "Error processing request");
  }
});
```

### Configurar Alerts

1. Ir a Firebase Console → Project Settings → Integrations
2. Habilitar Cloud Logging integration
3. Crear alert policy en Cloud Console:
   - Metric: Error Reporting > Error Count
   - Threshold: >5 errors en 5 min
   - Notification: Email

**Costo:** Gratis (hasta 1M eventos/mes)

---

## 2. CLOUD LOGGING + ALERTING

### Métricas Críticas a Monitorear

```
1. Cloud Functions Metrics:
   - Execution count (calls/min)
   - Execution time (latency)
   - Failure rate (%)
   - Memory usage (MB)
   - CPU time (ms)

2. Firestore Metrics:
   - Document read count (ops/day)
   - Document write count (ops/day)
   - Index utilization (%)
   - Query latency (p95, p99)

3. Storage Metrics:
   - Upload/download operations
   - Total size (GB)
   - Bandwidth (GB/month)

4. Application Metrics:
   - User active count
   - Error rate by function
   - Auth failures
   - API latency by endpoint
```

### Cloud Monitoring Dashboard

Crear en Google Cloud Console:

```bash
# Script para crear dashboard
gcloud monitoring dashboards create --config-from-file=dashboard.yaml
```

```yaml
# dashboard.yaml
displayName: "PESSY Production Monitoring"
mosaicLayout:
  columns: 12
  tiles:
  - width: 6
    height: 4
    widget:
      title: "Cloud Functions Errors (24h)"
      xyChart:
        dataSets:
        - timeSeriesQuery:
            timeSeriesFilter:
              filter: 'metric.type="cloudfunctions.googleapis.com/function/error_count"'
              aggregation:
                alignmentPeriod: 60s
                perSeriesAligner: ALIGN_RATE

  - width: 6
    height: 4
    widget:
      title: "Firestore Operations (24h)"
      xyChart:
        dataSets:
        - timeSeriesQuery:
            timeSeriesFilter:
              filter: 'metric.type="firestore.googleapis.com/document/read_operations"'

  - width: 6
    height: 4
    widget:
      title: "Cloud Functions Latency (p95)"
      xyChart:
        dataSets:
        - timeSeriesQuery:
            timeSeriesFilter:
              filter: 'metric.type="cloudfunctions.googleapis.com/function/execution_times"'
              aggregation:
                alignmentPeriod: 60s
                perSeriesAligner: ALIGN_PERCENTILE_95
```

### Alert Policies Recomendadas

```
1. Error Rate Spike
   - Condition: function error_count > 10 en 5 min
   - Action: Email + Slack webhook

2. High Latency
   - Condition: function execution_time p95 > 10s
   - Action: Email + PagerDuty

3. Firestore Read Spike
   - Condition: read_operations > 100k en 1 min
   - Action: Email (warning)

4. Storage Quota
   - Condition: storage usage > 80GB
   - Action: Email (informativo)
```

**Costo:** ~$5/mes para ~50 alert policies

---

## 3. SENTRY.IO (Opcional, Premium)

### Cuándo Usar

Para equipos que quieren:
- Source maps automáticos
- Performance monitoring
- Release tracking
- Workflow integrations (Slack, GitHub)

### Setup

```bash
# Frontend
npm install @sentry/react

# functions/
npm install @sentry/google-cloud-serverless
```

```typescript
// main.tsx - Frontend
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  replaySessionSampleRate: 0.01, // 1% of sessions
  replayOnErrorSampleRate: 0.5,    // 50% of error sessions
});

export const SentryRoutes = Sentry.withSentryRouting(AppRoutes);
```

```typescript
// functions/src/utils/sentryHandler.ts
import * as Sentry from "@sentry/google-cloud-serverless";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.2,
});

export function wrapFunction(fn: any) {
  return Sentry.wrapCloudFunction(fn);
}
```

**Costo:** $29/mes (50K events tier)

---

## 4. CUSTOM METRICS (Data Studio)

### Crear Dashboard con BigQuery

```sql
-- Tabla: logs_pessy_metrics
-- Ingesta logs JSON desde Cloud Logging

SELECT
  timestamp,
  json_extract_scalar(payload, '$.function') as function_name,
  json_extract_scalar(payload, '$.severity') as severity,
  CAST(json_extract_scalar(payload, '$.duration_ms') AS INT64) as duration_ms,
  json_extract_scalar(payload, '$.uid') as user_id,
  COUNT(*) as error_count
FROM `project.dataset.cloud_logging_events`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY timestamp, function_name, severity, duration_ms, user_id
ORDER BY timestamp DESC
```

### Data Studio Queries

```
1. Errors by Function
   - SELECT function_name, COUNT(*) FROM logs WHERE severity='ERROR'

2. Top Slow Endpoints
   - SELECT function_name, AVG(duration_ms) FROM logs 
     GROUP BY function_name ORDER BY AVG DESC

3. User Errors
   - SELECT uid, COUNT(*) FROM logs WHERE severity='ERROR' 
     GROUP BY uid HAVING COUNT(*) > 10

4. Daily Active Users
   - SELECT DATE(timestamp), COUNT(DISTINCT uid) FROM logs 
     GROUP BY DATE(timestamp)
```

**Costo:** Gratis (BigQuery free tier: 1TB/mes)

---

## 5. IMPLEMENTATION ROADMAP

### Week 1: Immediate
- [x] Firebase Error Reporting setup
- [x] Basic console.error() logging with JSON structure
- [ ] Email alerts for errors
- [ ] Cloud Logging dashboard

### Week 2: Core Monitoring
- [ ] Implement custom error handler wrapper
- [ ] Add structured logging to all Cloud Functions
- [ ] Setup alert policies for critical functions
- [ ] Create monitoring dashboard

### Week 3: Enhanced
- [ ] Sentry integration (optional)
- [ ] Performance monitoring
- [ ] BigQuery log analysis
- [ ] Data Studio dashboards

### Week 4: Advanced
- [ ] Budget alerts for GCP costs
- [ ] Automated remediation (scaling, etc)
- [ ] Weekly monitoring reports
- [ ] Incident response runbooks

---

## 6. STRUCTURED LOGGING FORMAT

### Standard Log Format (JSON)

```typescript
interface StructuredLog {
  timestamp: string;        // ISO 8601
  severity: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  function: string;         // Cloud Function name
  uid?: string;             // User ID if authenticated
  petId?: string;           // Pet ID if relevant
  duration_ms: number;      // Execution time
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  context?: Record<string, any>;
}
```

### Usage Example

```typescript
function log(data: StructuredLog) {
  console.log(JSON.stringify(data));
}

export const ingestHistory = functions.https.onCall(async (data, context) => {
  const startTime = Date.now();
  
  try {
    // logic
    log({
      timestamp: new Date().toISOString(),
      severity: "INFO",
      function: "ingestHistory",
      uid: context.auth?.uid,
      duration_ms: Date.now() - startTime,
    });
  } catch (error) {
    log({
      timestamp: new Date().toISOString(),
      severity: "ERROR",
      function: "ingestHistory",
      uid: context.auth?.uid,
      duration_ms: Date.now() - startTime,
      error: {
        code: error.code || "UNKNOWN",
        message: error.message,
        stack: error.stack,
      },
    });
    throw error;
  }
});
```

---

## 7. COST ESTIMATES (50K Users)

```
Service                  | Monthly Cost | Notes
─────────────────────────────────────────────────────────
Firebase Error Report.   | Gratis       | Up to 1M events
Cloud Logging            | ~$5          | 50 alert policies
BigQuery                 | Gratis       | 1TB free tier
Data Studio              | Gratis       | 
Sentry.io (optional)     | $29          | 50K events tier
─────────────────────────────────────────────────────────
TOTAL (with Sentry)      | ~$34/month   | 
TOTAL (without Sentry)   | ~$5/month    | Recommended start
```

---

## 8. DASHBOARDS TO CREATE

### 1. Executive Dashboard
- DAU (Daily Active Users)
- Error rate (%)
- API availability (%)
- Cost (GCP spending)

### 2. Engineering Dashboard
- Errors by function
- Latency by endpoint
- Firestore ops/day
- Cloud Functions memory usage
- Error trends (24h)

### 3. Compliance Dashboard
- Auth failures
- Data access logs
- Account deletion requests
- GDPR deletion timeline

### 4. Performance Dashboard
- Gemini API latency
- Gmail sync duration
- Photo upload speed
- Report generation time

---

## 9. INCIDENT RESPONSE PLAYBOOKS

### Scenario: High Error Rate in ingestHistory

```
1. Alert triggered: >10 errors in 5 min
2. Check:
   - Recent code deploys
   - Storage quota issues
   - Firestore limits
   - Gemini API status
3. Rollback if needed
4. Check logs in Cloud Logging:
   SELECT * FROM logs 
   WHERE function='ingestHistory' AND severity='ERROR'
   ORDER BY timestamp DESC LIMIT 100
5. Document incident in Sentry
6. Post-mortem within 24h
```

### Scenario: Firestore Read Spike

```
1. Alert: >100k reads in 1 min
2. Check:
   - N+1 query patterns in functions
   - Batch operations too large
   - User activity surge
3. If sustained:
   - Scale Firestore reads quota
   - Optimize queries with indexes
   - Implement caching
4. Log in Dashboard for pattern analysis
```

---

## 10. NEXT REVIEW

- **Date:** 2026-06-26
- **Metrics to Check:**
  - Error trends
  - Alert accuracy (false positives)
  - Cost vs usage
  - Performance bottlenecks
  
---

**Implementado por:** Tech Lead Backend  
**Fecha:** 2026-03-26  
**Estado:** Ready for Implementation
