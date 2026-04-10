# Pessy — Store Readiness Checklist

Pre-launch checklist para envio a App Store y Google Play.

---

## Administrativo y Legal

- [ ] **Privacy Policy:** Actualizar https://pessy.app/privacidad para incluir:
  - Tratamiento de datos de salud animal
  - Uso de IA (Gemini) para procesamiento de documentos medicos
  - Almacenamiento de imagenes/PDFs subidos por el usuario
  - Politica de retencion y eliminacion de datos
- [ ] **Terms of Service:** Verificar que https://pessy.app/terminos cubre uso de la app nativa
- [ ] **Review Account:** Preparar cuenta de prueba con:
  - Email: reviewer@pessy.app (o similar)
  - Password documentado en Review Notes
  - Mascota precargada con datos medicos de ejemplo
  - Documentos de muestra ya subidos (para demostrar el scanner)
- [ ] **Data Safety (Google Play):** Declarar en el formulario:
  - Se recolectan: archivos (imagenes/PDFs), datos de salud animal, email
  - Se usan: Firebase Analytics, Firestore, FCM, Cloud Functions
  - Procesamiento con IA: documentos enviados a Gemini para extraccion
- [ ] **App Privacy (Apple):** Completar el nutrition label en App Store Connect

---

## Visual Assets

### Icons (completado)
- [x] Android: 5 densidades (mdpi → xxxhdpi)
- [x] iOS: 15 PNGs + Contents.json (AppIcon set completo)

### Splash Screen
- [ ] **iOS Splash:** Generar PNG de 2732x2732px
  - Fondo plano (color: #F0FAF9 o #074738)
  - Logo Pessy centralizado
  - Margen de seguridad del 25% en bordes (evita recortes)
  - Colocar en `ios/App/App/Assets.xcassets/Splash.imageset/`
  - Actualizar `Contents.json` del Splash.imageset
- [ ] **Android Splash:** Configurar via Capacitor SplashScreen plugin
  - Ya habilitado en `capacitor.config.ts` (`launchAutoHide: true`)

### Screenshots para Stores
- [ ] iPhone 15 Pro (6.7") — minimo 3 screenshots
- [ ] iPhone SE (4.7") — minimo 3 screenshots (si se soporta)
- [ ] Android Phone — minimo 2 screenshots
- [ ] Feature Graphic (Google Play): 1024x500px

---

## Tecnico

### Firebase Config
- [ ] `android/app/google-services.json` descargado y colocado
- [ ] `ios/App/App/GoogleService-Info.plist` descargado y colocado

### Code Signing
- [ ] iOS: DEVELOPMENT_TEAM configurado en Xcode
- [ ] iOS: Provisioning profile creado en developer.apple.com
- [ ] Android: Keystore `.jks` generado y guardado de forma segura
- [ ] Android: `key.properties` creado (NO commitear)

### Build Verification
- [ ] `bash scripts/setup-mobile.sh` pasa sin errores
- [ ] `npm run build:mobile` completa exitosamente
- [ ] Build de Android genera APK/AAB sin errores
- [ ] Build de iOS genera archivo sin errores
- [ ] App abre correctamente en emulador Android
- [ ] App abre correctamente en simulador iOS
- [ ] App testeada en dispositivo fisico Android
- [ ] App testeada en dispositivo fisico iOS

### Funcionalidad Critica
- [ ] Login funciona (email + Google OAuth en WebView)
- [ ] Registro de usuario y mascota completo
- [ ] Home screen carga datos correctamente
- [ ] Document scanner abre camara y procesa
- [ ] Historial medico muestra eventos
- [ ] Navegacion no muestra landing page en contexto nativo
- [ ] Deep links funcionan (si configurados)

---

## Store Listings

### App Store (iOS)
- [ ] Titulo: Pessy (max 30 chars)
- [ ] Subtitulo definido (max 30 chars)
- [ ] Descripcion completa redactada
- [ ] Keywords definidos
- [ ] Categoria primaria: Lifestyle
- [ ] Categoria secundaria: Health & Fitness
- [ ] Age rating: 4+
- [ ] Privacy URL: https://pessy.app/privacidad
- [ ] Support URL: https://pessy.app/soporte

### Google Play
- [ ] Titulo: Pessy (max 30 chars)
- [ ] Descripcion corta (max 80 chars)
- [ ] Descripcion completa (max 4000 chars)
- [ ] Categoria: Lifestyle
- [ ] Content rating completado
- [ ] Target audience: 18+
- [ ] Privacy policy URL configurada
