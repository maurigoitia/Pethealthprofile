# 🗺️ Mapa de Navegación - PESSY

## Flujo Principal de Navegación

```
┌─────────────┐
│  Splash     │  (2.5 segundos)
│  Screen     │
└──────┬──────┘
       │ Auto-navega
       ▼
┌─────────────┐
│  Welcome    │  
│  Screen     │  [Ingresar] [Crear cuenta]
└──────┬──────┘
       │ Tap "Ingresar" o "Crear cuenta"
       ▼
┌─────────────┐
│   Login     │
│   Screen    │  [Email] [Password] [Ingresar]
└──────┬──────┘
       │ Tap "Ingresar"
       ▼
┌─────────────┐
│  Register   │  
│  Pet        │  3 pasos: Info básica → Detalles → Salud
│  Screen     │  [Continuar] [Omitir]
└──────┬──────┘
       │ Tap "Completar registro" o "Omitir"
       ▼
┌─────────────┐
│   Home      │  ← PANTALLA PRINCIPAL
│   Feed      │
└─────────────┘
```

## Bottom Navigation (Disponible en Home Feed)

```
┌──────────────────────────────────────────────┐
│              HOME FEED                       │
│  ┌────────────────────────────────────┐     │
│  │  Header [+ Agregar mascota]        │     │
│  │  ActionTray (Pendientes)           │     │
│  │  Timeline (Historial)              │     │
│  │  Quick Stats                       │     │
│  │  Export Report Card                │     │
│  └────────────────────────────────────┘     │
│                                              │
│  [FAB: Escanear Documento] 📷               │
└──────────────────────────────────────────────┘
         │         │          │
    ┌────┘    ┌────┘     └────┐
    │         │               │
    ▼         ▼               ▼
  HOME    MASCOTAS         PERFIL
```

---

## 🏠 Tab 1: HOME (Inicio)

### Pantalla: Home Feed
**Elementos interactivos:**
- **Header [+]** → Abre `PetProfileModal`
- **ActionTray Cards [Tap]** → Expande/colapsa tarjeta de tarea
- **ActionTray [Agendar]** → (Futuro: Abrir calendario)
- **ActionTray [Posponer]** → (Futuro: Reprogramar tarea)
- **Timeline Cards [Tap]** → Expande/colapsa evento
- **Timeline [Ver todo]** → Muestra todos los eventos
- **Export Report [Ver opciones]** → Abre `ExportReportModal`
- **FAB [📷]** → Abre `DocumentScannerModal`

### Modal: PetProfileModal
**Navegación:**
- **[X Cerrar]** → Regresa a Home Feed
- **[Schedule Visit]** → (Futuro: Abrir calendario)
- **[View Health Data]** → (Futuro: Abrir gráficas)

### Modal: ExportReportModal
**Navegación:**
- **[X Cerrar]** → Regresa a Home Feed
- **[Compartir]** → Abre selector de compartir del OS
- **[Descargar]** → Descarga PDF

### Modal: DocumentScannerModal
**Flujo interno:**
```
Seleccionar tipo → Escanear → Procesar IA → Resultados
                                              │
                                              ├─ [Reintentar] → Vuelve a Seleccionar
                                              └─ [Confirmar] → Guarda y cierra
```
**Navegación:**
- **[X Cerrar]** → Regresa a Home Feed
- **[Seleccionar tipo]** → Inicia escaneo
- **[Reintentar]** → Vuelve al selector
- **[Confirmar y Guardar]** → Guarda datos y cierra

---

## 🐾 Tab 2: MASCOTAS

### Pantalla: PetsListScreen
**Elementos interactivos:**
- **[← Atrás]** → Regresa a Home (Tab: Inicio)
- **[+]** (top-right) → (Futuro: Abrir RegisterPetScreen)
- **Pet Card [Tap]** → Abre `PetProfileModal`
- **[Agregar mascota]** (empty state) → (Futuro: Abrir RegisterPetScreen)
- **[Próximas citas]** → (Futuro: Ver calendario)
- **[Vacunación]** → (Futuro: Ver cartilla de vacunas)

**Estados:**
- **Empty State**: Si no hay mascotas registradas
  - Muestra ilustración + mensaje
  - Botón "Agregar primera mascota"

---

## 👤 Tab 3: PERFIL

### Pantalla: UserProfileScreen
**Elementos interactivos:**
- **[← Atrás]** → Regresa a Home (Tab: Inicio)
- **Menu Items [Tap]**:
  - **Información personal** → (Futuro: Pantalla de edición)
  - **Notificaciones** → (Futuro: Configuración de alertas)
  - **Privacidad y seguridad** → (Futuro: Cambiar password)
  - **Apariencia** → (Futuro: Toggle dark mode)
  - **Ayuda y soporte** → (Futuro: FAQ/Contact)
  - **Acerca de PESSY** → (Futuro: About screen)
- **[Cerrar sesión]** → Navega a `/welcome` (WelcomeScreen)

---

## 📊 Estados de cada pantalla

### Home Feed
- **Loading**: Skeleton cards mientras carga
- **Empty**: 
  - ActionTray: "No tienes tareas pendientes 🎉"
  - Timeline: "Aún no hay eventos médicos registrados"
- **Error**: Mensaje de error con botón "Reintentar"

### PetsListScreen
- **Loading**: Skeleton cards de mascotas
- **Empty**: Ilustración + "Agrega tu primera mascota"
- **Error**: "No se pudieron cargar las mascotas"

### DocumentScannerModal
- **Stages**:
  1. **select**: Selector de tipos
  2. **scanning**: Loading con animación
  3. **processing**: Loading IA con pasos
  4. **results**: Datos extraídos
- **Error**: Si falla OCR → Botón "Reintentar"

---

## 🔄 Flujos Especiales

### Primer uso (Onboarding)
```
Splash → Welcome → Login → RegisterPet (3 pasos) → Home Feed
                                                     │
                                                     └─ Empty states everywhere
```

### Usuario existente
```
Splash → Home Feed (con datos)
```

### Cerrar sesión
```
UserProfileScreen [Cerrar sesión] → Welcome Screen
```

### Escanear documento
```
Home Feed [FAB] → DocumentScannerModal
                  │
                  ├─ Éxito → Actualiza ActionTray/Timeline
                  └─ Error → Muestra mensaje de error
```

---

## 🎯 Acciones que actualizan múltiples pantallas

### Después de escanear documento con IA:
1. **ActionTray**: Actualiza tareas pendientes
2. **Timeline**: Agrega nuevo evento
3. **Quick Stats**: Incrementa contador de documentos
4. **PetProfileModal**: Actualiza datos de salud

### Después de completar una tarea:
1. **ActionTray**: Remueve tarea
2. **Timeline**: Agrega evento "completado"
3. **Quick Stats**: Actualiza contadores

---

## 📱 Gestos y navegación

- **Tap**: Abrir/Expandir
- **Swipe down**: Cerrar modales (bottom sheet)
- **Tap backdrop**: Cerrar modales
- **Bottom nav tap**: Cambiar de tab
- **Back button (Android)**: Cerrar modal o volver a Home

---

## 🚀 Pantallas futuras (placeholders)

- Calendario de citas
- Gráficas de salud
- Editar perfil de usuario
- Editar perfil de mascota
- Configuración de notificaciones
- FAQ / Ayuda
- Compartir en redes sociales

---

**Nota**: Todos los modales usan animación de bottom sheet (slide up) con backdrop blur.
