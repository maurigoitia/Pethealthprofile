# 🎨 Guía de Estados de UI - PESSY

## Componentes Reutilizables

### 1. EmptyState
**Ubicación**: `/src/app/components/EmptyState.tsx`

**Props**:
```typescript
{
  icon?: string;              // Material Icon name
  title: string;              // Título principal
  description: string;        // Descripción
  actionLabel?: string;       // Texto del botón (opcional)
  onAction?: () => void;     // Función del botón
  illustration?: "pet" | "document" | "calendar" | "report" | "medical";
}
```

**Uso**:
```tsx
<EmptyState
  icon="task_alt"
  title="¡Todo al día!"
  description="No tienes tareas pendientes."
  illustration="medical"
  actionLabel="Agregar tarea"
  onAction={() => console.log('clicked')}
/>
```

---

### 2. LoadingState
**Ubicación**: `/src/app/components/LoadingState.tsx`

**Props**:
```typescript
{
  message?: string;           // Mensaje de carga
  type?: "spinner" | "dots" | "progress" | "ai";
  progress?: number;         // Solo para type="progress" (0-100)
}
```

**Tipos de loading**:
- **spinner**: Rueda giratoria clásica
- **dots**: Tres puntos animados
- **progress**: Barra de progreso con porcentaje
- **ai**: Animación especial para procesamiento de IA

**Uso**:
```tsx
<LoadingState 
  message="Analizando documento con IA..."
  type="ai"
/>

<LoadingState 
  message="Subiendo archivo..."
  type="progress"
  progress={65}
/>
```

---

### 3. ErrorState
**Ubicación**: `/src/app/components/ErrorState.tsx`

**Props**:
```typescript
{
  title?: string;            // Título del error (opcional)
  message: string;           // Mensaje de error
  type?: "error" | "warning" | "offline" | "upload";
  onRetry?: () => void;     // Función de reintentar
  onDismiss?: () => void;   // Función de cerrar
  retryLabel?: string;      // Texto del botón reintentar
}
```

**Tipos de error**:
- **error**: Error genérico (rojo)
- **warning**: Advertencia (amarillo)
- **offline**: Sin conexión (gris)
- **upload**: Error de subida (morado)

**Uso**:
```tsx
<ErrorState
  title="Error de conexión"
  message="No se pudo conectar al servidor. Verifica tu conexión a internet."
  type="offline"
  onRetry={() => retryConnection()}
  onDismiss={() => closeModal()}
/>
```

---

## Estados por Pantalla

### 📱 Home Feed

#### ActionTray (Pendientes)
**Estados**:

1. **Con datos** (Default):
   ```tsx
   // 3 tarjetas expandibles con tareas pendientes
   ```

2. **Empty State**:
   ```tsx
   // Cambiar en ActionTray.tsx línea 80:
   const isEmpty = true; // false por defecto
   
   // Muestra:
   // ✓ "¡Todo al día!"
   // ✓ "No tienes tareas pendientes..."
   // ✓ Ilustración con huellas de mascotas
   ```

3. **Loading** (Por implementar):
   ```tsx
   <LoadingState message="Cargando tareas..." type="spinner" />
   ```

4. **Error** (Por implementar):
   ```tsx
   <ErrorState
     message="No se pudieron cargar las tareas"
     type="error"
     onRetry={() => loadActions()}
   />
   ```

---

#### Timeline (Historial)
**Estados**:

1. **Con datos** (Default):
   ```tsx
   // 5 eventos médicos con detalles expandibles
   ```

2. **Empty State** (Por implementar):
   ```tsx
   <EmptyState
     icon="timeline"
     title="Sin historial médico"
     description="Aún no hay eventos registrados. Sube tu primer documento médico."
     illustration="document"
     actionLabel="Escanear documento"
     onAction={() => openScanner()}
   />
   ```

3. **Loading** (Por implementar):
   ```tsx
   <LoadingState message="Cargando historial..." type="dots" />
   ```

---

### 🐾 PetsListScreen

**Estados**:

1. **Con mascotas** (Default):
   ```tsx
   // Grid de 2 mascotas (Rocky y Luna)
   ```

2. **Empty State** (Por implementar):
   ```tsx
   <EmptyState
     icon="pets"
     title="Agrega tu primera mascota"
     description="Comienza a cuidar la salud de tu compañero peludo."
     illustration="pet"
     actionLabel="Registrar mascota"
     onAction={() => navigate('/register-pet')}
   />
   ```

3. **Loading**:
   ```tsx
   <LoadingState message="Cargando mascotas..." type="spinner" />
   ```

4. **Error**:
   ```tsx
   <ErrorState
     message="No se pudieron cargar las mascotas"
     type="error"
     onRetry={() => loadPets()}
   />
   ```

---

### 📄 DocumentScannerModal

**Flujo de estados**:

```
1. SELECT
   └─ Usuario selecciona tipo de documento

2. SCANNING (1.5s)
   └─ <LoadingState 
        message="Escaneando documento..." 
        type="spinner" 
      />

3. PROCESSING (2.5s)
   └─ <LoadingState 
        message="Analizando con IA..." 
        type="ai" 
      />

4a. RESULTS (Éxito)
    └─ Muestra datos extraídos con confianza %

4b. ERROR (Fallo)
    └─ <ErrorState
         title="No se pudo procesar"
         message="La imagen no tiene buena calidad o no es un documento médico."
         type="upload"
         onRetry={() => resetScanner()}
       />
```

**Estados de error específicos**:

- **Archivo muy grande**:
```tsx
<ErrorState
  title="Archivo muy grande"
  message="El archivo supera el límite de 10MB. Comprime la imagen e intenta de nuevo."
  type="upload"
  onRetry={() => openFilePicker()}
/>
```

- **Sin conexión**:
```tsx
<ErrorState
  title="Sin conexión"
  message="Necesitas internet para usar el reconocimiento con IA."
  type="offline"
  onRetry={() => checkConnection()}
/>
```

- **OCR falló**:
```tsx
<ErrorState
  title="No se detectó texto"
  message="Asegúrate de que el documento sea legible y esté bien iluminado."
  type="warning"
  onRetry={() => retakePicture()}
/>
```

---

### 📊 ExportReportModal

**Estados**:

1. **Generando reporte**:
```tsx
<LoadingState 
  message="Generando PDF..." 
  type="progress"
  progress={75}
/>
```

2. **Error de exportación**:
```tsx
<ErrorState
  title="Error al exportar"
  message="No se pudo generar el reporte. Intenta de nuevo."
  type="error"
  onRetry={() => generateReport()}
  onDismiss={() => closeModal()}
/>
```

---

## Skeleton Loaders

Para listas y cards, usa skeleton placeholders:

```tsx
// Skeleton de ActionTray
<div className="space-y-2.5">
  {[1, 2, 3].map((i) => (
    <div key={i} className="bg-white dark:bg-slate-900 rounded-xl p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="size-11 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
        </div>
      </div>
    </div>
  ))}
</div>
```

---

## Estados Globales de la App

### 1. Primer Uso (Onboarding)
```
Splash → Welcome → Login → RegisterPet → Home Feed
                                           └─ ALL EMPTY STATES
```

**Qué mostrar**:
- ActionTray: Empty state "¡Todo al día!"
- Timeline: Empty state "Sin historial"
- PetsListScreen: Empty state "Agrega tu primera mascota"
- Quick Stats: Todos en 0

---

### 2. Sin Conexión
**Mensaje global**:
```tsx
<div className="fixed top-0 left-0 right-0 bg-amber-500 text-white py-2 px-4 text-center text-sm font-bold z-50">
  <MaterialIcon name="wifi_off" className="inline mr-2" />
  Sin conexión a internet
</div>
```

---

### 3. Mantenimiento / Error del servidor
```tsx
<ErrorState
  icon="construction"
  title="Servicio en mantenimiento"
  message="Estamos mejorando PESSY para ti. Vuelve pronto."
  type="warning"
/>
```

---

## Testing de Estados

Para probar cada estado, modifica estas variables:

### ActionTray Empty State
```typescript
// En ActionTray.tsx línea 80
const isEmpty = true; // Cambia a true para ver empty state
```

### Timeline Empty State
```typescript
// En Timeline.tsx
const events: TimelineEvent[] = []; // Array vacío
```

### PetsListScreen Empty State
```typescript
// En PetsListScreen.tsx
const pets = []; // Array vacío
```

### DocumentScanner Error
```typescript
// En DocumentScannerModal.tsx, handleSelectType()
// Simula error en lugar de success:
setTimeout(() => {
  setScanStage("error");
  setError({
    type: "upload",
    message: "No se pudo procesar el documento"
  });
}, 2500);
```

---

## Mejores Prácticas

1. **Siempre mostrar feedback**: Nunca dejar la pantalla en blanco
2. **Loading rápido**: Máximo 3 segundos antes de mostrar contenido o error
3. **Mensajes claros**: Explicar QUÉ pasó y CÓMO solucionarlo
4. **Acciones útiles**: Siempre ofrecer "Reintentar" o "Cancelar"
5. **Empty states atractivos**: Usar ilustraciones y CTAs claros
6. **Errores específicos**: No usar "Error genérico", sino mensajes contextuales

---

## Animaciones

Todos los estados usan Motion (Framer Motion):

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.3 }}
>
  {/* Contenido */}
</motion.div>
```

Para transiciones de estado:
```tsx
<AnimatePresence mode="wait">
  {isLoading && <LoadingState key="loading" />}
  {isError && <ErrorState key="error" />}
  {data && <DataView key="data" />}
</AnimatePresence>
```

---

**Última actualización**: 24 Feb 2026
