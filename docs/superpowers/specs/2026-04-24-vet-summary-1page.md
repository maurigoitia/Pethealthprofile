# Spec — "Resumen Vet" PDF de 1 página

## Contexto

Reddit research (r/Pets, thread `1slcs9c`, comentario #12):
> "My husband and I have a shared Google sheet where we can add health stuff for our pets. When we see our vet, we'll create a **single page summary with data to give to her (she loves it)**."

Comentario #8 mencionando competidor:
> "I use Paw AI, **the PDF export is clutch, just hands the vet a clean report** and saves a ton of awkward explaining."

## Problema actual

`ExportReportModal.tsx` (1182 LOC) genera un PDF estructurado pero **multi-página**:
- 24 `checkY()` llamadas que agregan páginas cuando overflow
- Incluye: pet info, conditions, allergies, alerts, active meds, treatments, upcoming, events sorted, vaccines, observations
- 3 tipos hoy: `health` | `vaccine` | `treatment` — todos pueden generar 2-5 páginas

El vet no quiere 5 páginas — quiere **una sola** con lo crítico de hoy.

## Objetivo

Agregar tipo `vet_summary` que genere **exactamente 1 página A4** con:

1. **Header compacto** (3 líneas):
   - Nombre + especie + raza + edad + peso
   - Última consulta (fecha + clínica)
   - Tutor + email/tel

2. **Estado de hoy** (caja izquierda — 40%):
   - Condiciones activas (max 4 chips)
   - Alertas urgentes (si hay)
   - Próximo turno (si hay)

3. **Tratamientos activos** (caja derecha — 60%):
   - Tabla compacta: medicamento · dosis · frecuencia · empezó
   - Max 6 filas

4. **Timeline reciente** (full width):
   - Últimos 5 eventos: fecha · tipo · resumen 1 línea

5. **Footer**:
   - QR code → URL al historial completo en pessy.app
   - Disclaimer "No reemplaza consulta presencial"

## Implementación propuesta

**Archivo nuevo:** `src/app/components/medical/VetSummaryExport.tsx` (~250 LOC)
- NO modificar `ExportReportModal.tsx` existente (mantener compatibilidad)
- Función `generateVetSummary(activePet, events, meds, conditions, ...)` que genera PDF 1 página
- Botón nuevo en `ExportReportModal` o en `/cuidados`: "Imprimir resumen para vet"

**Trade-offs:**
- Si el contenido overflows → **truncar** (no agregar página)
- Mostrar contador "...y 12 eventos más en pessy.app/inicio"
- QR code lleva al vet a la app si quiere ver más

## Roadmap

| Fase | Tarea | Tiempo |
|---|---|---|
| A | Schema de datos compacto + función layout | 1h |
| B | Implementación PDF con jspdf + truncate logic | 1h |
| C | Botón en /cuidados + ExportReportModal | 30min |
| D | QR code lib (qrcode.js o canvas-qr) o link | 30min |
| E | Test con pets reales (Thor — pocos events; Lupo — muchos events) | 30min |

Total: ~3.5h. Post-launch, no bloquea launch.

## Decisiones pendientes

1. ¿Incluir QR code o solo URL textual? QR es mejor UX pero requiere lib (-30KB)
2. ¿Permitir al user customizar qué incluir? Vs preset fijo. Voto: preset fijo (vet quiere consistencia)
3. ¿Multi-mascota en 1 PDF? Voto: NO, una mascota = una hoja

## Por qué se postpone al launch

- El export actual funciona y es completo (vets pueden imprimir 2-3 páginas)
- El "1 página perfecta" es un nice-to-have, no un blocker
- El día 1 los users pueden compartir el PDF actual + link a `/inicio`
- Iteramos basado en feedback real de vets post-launch

## Mientras tanto (workaround)

En el modal de export actual, el tipo "health" tiene la info más relevante. Si el vet recibe 2 páginas, sigue siendo mejor que el camera roll caótico que la usuaria del Reddit describió como baseline. El compromiso "Pessy < camera roll caos" se cumple.
