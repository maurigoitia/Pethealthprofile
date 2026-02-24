# 📦 Guía de Exportación de Assets - PESSY

## Assets Actuales en el Proyecto

### ✅ Ya implementados:

#### 1. Iconos Material Symbols
- **Fuente**: Google Material Symbols
- **Implementación**: Via CDN en `/index.html`
- **Uso**: Componente `<MaterialIcon name="icon_name" />`
- **Estado**: ✅ Completamente funcional

**Iconos principales en uso**:
- `pets` - Mascotas
- `vaccines` - Vacunas
- `medication` - Medicamentos
- `document_scanner` - Escaneo de documentos
- `timeline` - Historial
- `calendar_month` - Calendario
- `psychology` - IA/Procesamiento
- `error`, `warning`, `info` - Estados
- Y más de 50+ iconos en total

---

#### 2. Fuente Manrope
- **Fuente**: Manrope (Google Fonts)
- **Implementación**: Via `/src/styles/fonts.css`
- **Pesos**: 400, 500, 600, 700, 800, 900
- **Estado**: ✅ Completamente funcional

---

## 🎨 Assets Necesarios del Diseñador

### Ilustraciones para Empty States

Para mejorar la experiencia de usuario, necesitamos ilustraciones SVG o PNG transparentes:

#### 1. **Ilustración de Mascota Feliz**
**Uso**: Empty state de PetsListScreen
**Especificaciones**:
- Formato: SVG (preferido) o PNG transparente
- Tamaño: 300x300px
- Estilo: Minimalista, line-art, colores azul (#2b6fee) y morado
- Concepto: Perro o gato sonriente con corazones

**Contexto de uso**:
```
"Agrega tu primera mascota"
[ILUSTRACIÓN AQUÍ]
"Comienza a cuidar la salud de tu compañero peludo"
```

---

#### 2. **Ilustración de Documentos/Carpeta**
**Uso**: Empty state de Timeline (historial médico vacío)
**Especificaciones**:
- Formato: SVG o PNG transparente
- Tamaño: 300x300px
- Estilo: Iconografía moderna con líneas suaves
- Concepto: Carpeta médica abierta vacía o documento con estetoscopio

**Contexto de uso**:
```
"Sin historial médico"
[ILUSTRACIÓN AQUÍ]
"Sube tu primer documento médico"
```

---

#### 3. **Ilustración de Calendario Limpio**
**Uso**: Empty state de próximas citas
**Especificaciones**:
- Formato: SVG o PNG transparente
- Tamaño: 300x300px
- Estilo: Minimalista
- Concepto: Calendario mensual sin marcas, con check en azul

---

#### 4. **Ilustración de Checkmark/Success**
**Uso**: Empty state de tareas completadas (ActionTray)
**Especificaciones**:
- Formato: SVG o PNG transparente
- Tamaño: 300x300px
- Estilo: Celebratorio pero sutil
- Concepto: Checkmark grande con partículas o estrellas

**Contexto de uso**:
```
"¡Todo al día!"
[ILUSTRACIÓN AQUÍ]
"No tienes tareas pendientes"
```

---

#### 5. **Ilustración de IA/Robot**
**Uso**: Procesamiento OCR/IA en DocumentScanner
**Especificaciones**:
- Formato: SVG o PNG transparente
- Tamaño: 200x200px
- Estilo: Moderno, tech
- Concepto: Robot amigable escaneando documento o cerebro digital

---

### Backgrounds Decorativos

#### 6. **Patrón de Huellas (Paws Pattern)**
**Uso**: Fondos sutiles en empty states y splash screen
**Especificaciones**:
- Formato: SVG pattern seamless
- Tamaño: 100x100px (para repetir)
- Estilo: Huellas de perro/gato muy sutiles
- Color: Azul #2b6fee con 10% de opacidad

**Ya implementado en**: SplashScreen (background de huellas azules)

---

### Avatares de Mascotas (Opcional)

#### 7. **Set de Avatares de Mascotas**
**Uso**: Placeholder cuando el usuario no sube foto de mascota
**Especificaciones**:
- Formato: PNG transparente o SVG
- Tamaño: 200x200px
- Cantidad: 6-8 avatares diferentes
- Estilo: Ilustraciones minimalistas de diferentes razas
- Variedad: 
  - Perros: Golden, Bulldog, Chihuahua, Husky
  - Gatos: Siamés, Persa, Gato naranja, Gato negro

**Contexto de uso**:
```tsx
// En PetProfileModal cuando no hay foto
<div className="avatar-placeholder">
  <img src="/assets/avatars/golden-dog.svg" />
</div>
```

---

## 📁 Estructura Recomendada de Assets

```
/public/
  /assets/
    /illustrations/
      - pet-happy.svg              # Mascota feliz
      - documents-folder.svg       # Carpeta médica
      - calendar-clean.svg         # Calendario
      - checkmark-success.svg      # Success state
      - ai-robot.svg              # IA procesando
      
    /avatars/
      /dogs/
        - golden-retriever.svg
        - bulldog.svg
        - chihuahua.svg
        - husky.svg
      /cats/
        - siamese.svg
        - persian.svg
        - orange-cat.svg
        - black-cat.svg
        
    /patterns/
      - paws-pattern.svg          # Ya tenemos esto
      
    /backgrounds/
      - gradient-orb-blue.svg     # Decoración opcional
      - gradient-orb-purple.svg   # Decoración opcional
```

---

## 🎯 Cómo Usar los Assets en el Código

### Método 1: SVG Inline (Recomendado)
```tsx
import petHappy from '/assets/illustrations/pet-happy.svg';

<img src={petHappy} alt="Happy pet" className="w-48 h-48" />
```

### Método 2: SVG como Componente React
```tsx
import { ReactComponent as PetHappy } from '/assets/illustrations/pet-happy.svg';

<PetHappy className="w-48 h-48 text-[#2b6fee]" />
```

### Método 3: ImageWithFallback (Para PNG)
```tsx
import { ImageWithFallback } from './components/figma/ImageWithFallback';

<ImageWithFallback 
  src="/assets/illustrations/pet-happy.png"
  alt="Happy pet"
  className="w-48 h-48"
/>
```

---

## ⚙️ Especificaciones Técnicas

### Para SVG:
- **Optimizar con SVGO**: Eliminar metadatos innecesarios
- **Usar viewBox**: En lugar de width/height fijos
- **Paths limpos**: Sin elementos ocultos
- **Colores**: Usar `currentColor` para permitir cambio de color via CSS
- **Tamaño**: Mantener bajo 20KB por archivo

Ejemplo de SVG optimizado:
```xml
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <path fill="currentColor" d="M150,50 L200,150 L100,150 Z"/>
</svg>
```

### Para PNG:
- **Transparencia**: Siempre usar canal alpha
- **Resolución**: @2x y @3x para retina
- **Compresión**: TinyPNG o similar
- **Formato**: PNG-24 con transparencia

---

## 🚀 Implementación de Nuevas Ilustraciones

### Paso 1: Recibir Assets del Diseñador
1. Solicitar en formatos SVG (preferido) y PNG de respaldo
2. Verificar que cumplan especificaciones de tamaño
3. Confirmar que usen la paleta de colores de PESSY

### Paso 2: Optimizar
```bash
# Instalar SVGO
npm install -g svgo

# Optimizar SVG
svgo pet-happy.svg -o pet-happy-optimized.svg
```

### Paso 3: Colocar en Proyecto
```bash
# Mover a carpeta public
mv pet-happy.svg /public/assets/illustrations/
```

### Paso 4: Actualizar EmptyState Component
```tsx
// En EmptyState.tsx, agregar nueva ilustración
const illustrations = {
  pet: '/assets/illustrations/pet-happy.svg',
  document: '/assets/illustrations/documents-folder.svg',
  calendar: '/assets/illustrations/calendar-clean.svg',
  success: '/assets/illustrations/checkmark-success.svg',
  medical: '/assets/illustrations/medical-kit.svg',
};
```

### Paso 5: Usar en Componentes
```tsx
<EmptyState
  illustration="pet"
  title="Agrega tu primera mascota"
  description="Comienza a cuidar la salud de tu compañero peludo"
/>
```

---

## 📋 Checklist para el Diseñador

Cuando entregue los assets, verificar que incluya:

- [ ] **Ilustración Mascota Feliz** (SVG + PNG @2x)
- [ ] **Ilustración Documentos** (SVG + PNG @2x)
- [ ] **Ilustración Calendario** (SVG + PNG @2x)
- [ ] **Ilustración Checkmark Success** (SVG + PNG @2x)
- [ ] **Ilustración IA/Robot** (SVG + PNG @2x)
- [ ] **Set de 4 Avatares de Perros** (SVG o PNG transparente)
- [ ] **Set de 4 Avatares de Gatos** (SVG o PNG transparente)
- [ ] **Patrón de Huellas** (SVG seamless pattern)

### Información adicional a solicitar:
- [ ] Guía de estilo (si hay colores específicos diferentes a #2b6fee)
- [ ] Versiones dark mode (si aplica)
- [ ] Animaciones Lottie (opcional, para loading states más elaborados)

---

## 🎨 Paleta de Colores para Referencia del Diseñador

```css
/* Colores principales */
--primary-blue: #2b6fee;
--primary-blue-light: #5a8aff;
--primary-blue-dark: #1a4bcc;

/* Colores secundarios */
--purple: #8b5cf6;
--emerald: #10b981;
--amber: #f59e0b;
--red: #ef4444;

/* Grises */
--slate-50: #f8fafc;
--slate-100: #f1f5f9;
--slate-200: #e2e8f0;
--slate-900: #0f172a;

/* Dark mode backgrounds */
--dark-bg: #101622;
--dark-bg-secondary: #1a2332;
```

---

## 🔄 Assets Alternativos si No Hay Diseñador

Si no tienes diseñador disponible, puedes usar:

### 1. Undraw Illustrations (Gratis)
- URL: https://undraw.co/illustrations
- Buscar: "pet", "document", "calendar", "success"
- Cambiar color primario a #2b6fee en el sitio

### 2. Iconos grandes de Material Symbols
- Ya los tenemos implementados
- Usar iconos a 96px como "ilustración"
```tsx
<MaterialIcon name="pets" className="text-[96px] text-[#2b6fee]" />
```

### 3. Heroicons Illustrations
- URL: https://heroicons.com/
- SVGs gratuitos, MIT license

---

## 📸 Cómo Exportar desde Figma

Instrucciones para el diseñador:

1. **Seleccionar el elemento** en Figma
2. **Panel derecho > Export**
3. **Configuración**:
   - SVG: Scale 1x, sin fondo
   - PNG: 2x y 3x, fondo transparente
4. **Nombrar archivos**: usar kebab-case (pet-happy.svg)
5. **Exportar** y enviar

---

**Última actualización**: 24 Feb 2026
**Próximo paso**: Recibir assets del diseñador e implementar
