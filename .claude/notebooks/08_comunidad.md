# Comunidad PESSY — Protocolos Perdidos y Adopción

## Sistema de Mascotas Perdidas

### Protocolo de reporte
1. **Auto-fill** desde datos de la mascota registrada (foto, nombre, raza, tamaño, color)
2. **Datos adicionales**: última ubicación vista, hora, características distintivas, collar/chip
3. **Geolocalización**: captura automática o manual en mapa
4. **Push geolocalizadas**: notificación a usuarios en la zona

### Estrategia de radio expansivo
| Tiempo desde reporte | Radio | Tipo de alerta |
|---|---|---|
| 0-6 horas | 2 km | Push inmediata a todos los usuarios cercanos |
| 6-24 horas | 5 km | Push extendida + aparece en feed |
| 24-72 horas | 10 km | Push ampliada + redes sociales sugerido |
| 72+ horas | 15 km | Feed permanente + recordatorio semanal zona |

### Avistamientos
- Cualquier usuario puede reportar un avistamiento
- Datos: foto (opcional), ubicación, hora, dirección observada
- Notificación inmediata al dueño con distancia estimada
- Mapa de calor de avistamientos para el dueño
- Verificación: otros usuarios pueden confirmar o descartar

### Gamificación comunidad
| Acción | Puntos |
|---|---|
| Reportar mascota perdida | 10 |
| Avistamiento verificado | 100 |
| Reencuentro exitoso | 500 |
| Compartir en redes | 5 |

## Sistema de Adopción

### Flujo de publicación
1. Refugio o usuario publica mascota en adopción
2. Datos: foto, especie, raza, edad, tamaño, temperamento, necesidades especiales
3. Estado de salud: vacunas, esterilización, condiciones conocidas
4. Compatibilidad: bueno con otros animales, niños, energía

### Matching inteligente — 5 factores
| Factor | Peso | Descripción |
|---|---|---|
| Living Space | 25% | Tamaño del hogar vs tamaño de la mascota |
| Experience | 25% | Experiencia previa del adoptante vs necesidades especiales |
| Other Pets | 20% | Compatibilidad con mascotas existentes |
| Activity Level | 15% | Nivel de actividad del adoptante vs energía de la mascota |
| Schedule | 15% | Horas solo/día vs necesidades de compañía de la especie |

### Labels de compatibilidad
| Score | Label | Acción |
|---|---|---|
| 80-100 | Excellent | Conexión directa, match destacado |
| 60-79 | Good | Sugerido con notas |
| 40-59 | Possible | Mostrar con advertencias claras |
| 0-39 | Incompatible | No mostrar por default, requiere opt-in |

### Gamificación adopción
| Acción | Puntos |
|---|---|
| Publicar en adopción | 20 |
| Completar cuestionario | 15 |
| Adopción exitosa | 200 |
| Review post-adopción (30 días) | 50 |

### Seguimiento post-adopción
- Checkin a los 7 días: "¿Cómo va la adaptación?"
- Checkin a los 30 días: "¿Todo bien con {nombre}?"
- Opcional: compartir fotos de progreso (gamificación)
- Si hay problemas: sugerir recursos de comportamiento + contacto refugio
