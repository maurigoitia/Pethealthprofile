# Pessy — App Store Submission Guide

## Prerequisites
- Apple Developer Account ($99/year) → developer.apple.com
- Google Play Developer Account ($25 one-time) → play.google.com/console
- Firebase project: `polar-scene-488615-i0`
- Bundle ID: `app.pessy.pessy`

---

## iOS — App Store Connect

### 1. Code Signing
```bash
cd pessy_flutter

# Switch to production config
# In lib/main.dart: change import to 'config.dart'

# Open Xcode to configure signing
open ios/Runner.xcworkspace
```
In Xcode:
- Select Runner target → Signing & Capabilities
- Team: Select your Apple Developer team
- Bundle Identifier: `app.pessy.pessy`
- Enable: Push Notifications capability
- Enable: Associated Domains → `applinks:pessy.app`

### 2. Build Archive
```bash
flutter build ipa --release
```
Output: `build/ios/ipa/pessy.ipa`

### 3. Upload to App Store Connect
- Open Transporter app (Mac) or use `xcrun altool`
- Upload the .ipa
- In App Store Connect: create app listing with:
  - Name: Pessy
  - Subtitle: La identidad digital de tu mascota
  - Category: Lifestyle (primary), Health & Fitness (secondary)
  - Screenshots: iPhone 15 Pro (6.7") and iPhone SE (4.7")
  - Privacy URL: https://pessy.app/privacidad
  - Support URL: https://pessy.app/soporte

### 4. App Review Checklist
- [ ] Privacy policy accessible at https://pessy.app/privacidad
- [ ] Push notification permission has clear purpose string in Info.plist
- [ ] Camera/photo library permission strings if used
- [ ] No placeholder content in screenshots
- [ ] App functions without login (or provide demo account)
- [ ] GDPR/consent flow works before data collection

---

## Android — Google Play Console

### 1. Build Signed AAB
```bash
cd pessy_flutter

# Switch to production config
# In lib/main.dart: change import to 'config.dart'

# Create keystore (first time only)
keytool -genkey -v -keystore ~/pessy-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias pessy -storepass <PASSWORD>
```

Create `android/key.properties`:
```properties
storePassword=<PASSWORD>
keyPassword=<PASSWORD>
keyAlias=pessy
storeFile=/Users/mauriciogoitia/pessy-release.jks
```

Then build:
```bash
flutter build appbundle --release
```
Output: `build/app/outputs/bundle/release/app-release.aab` (40.3MB)

### 2. Google Play Console Setup
- Create app → Pessy
- Category: Lifestyle
- Content rating: complete questionnaire
- Target audience: 18+ (pet owners)
- Data safety: declare Firebase Analytics, Firestore, FCM
- Store listing:
  - Title: Pessy — Tu mascota, organizada
  - Short description: La app con IA para el cuidado integral de tu mascota
  - Full description: (from pessy.app landing copy)
  - Screenshots: Phone (min 2), Tablet (optional)
  - Feature graphic: 1024x500

### 3. Play Console Checklist
- [ ] Data safety form completed
- [ ] Content rating questionnaire done
- [ ] Privacy policy URL: https://pessy.app/privacidad
- [ ] App signing by Google Play enabled (recommended)
- [ ] Internal testing track first, then closed beta, then production
- [ ] Firebase App Distribution for beta testers

---

## Config Switching Cheat Sheet

| Environment | Import in main.dart | URL |
|-------------|-------------------|-----|
| QA/Dev | `config_qa.dart` | localhost:3001 |
| Production | `config.dart` | pessy.app |

**Always switch back to `config_qa.dart` after building release.**

---

## Current Build Status (2026-03-28)
- Android AAB: 40.3MB ✓
- iOS Runner.app: 17.8MB ✓ (unsigned)
- React build: 2.57s, 107 PWA entries ✓
- Lighthouse: Accessibility 93, Best Practices 96 ✓
