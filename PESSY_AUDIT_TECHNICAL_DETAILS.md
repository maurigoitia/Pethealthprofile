# PESSY PWA Audit - Technical Details & File References

## File Structure Reference

### Core Application Files

**Entry Point:**
```
index.html                          # Main HTML entry (28 lines)
src/main.tsx                        # React app initialization
src/app/App.tsx                     # Root component with Context providers
src/app/routes.tsx                  # React Router configuration (140 lines)
```

**Component Library (40+ components):**
```
src/app/components/
├── auth/                           # 8 files (Login, Register, Email Link, Admin)
├── pet/                            # 10 files (Profile, Selector, Registration)
├── medical/                        # 13 files (Timeline, Vaccines, Meds, Scanner, etc)
├── community/                      # 8 files (Adoption, Lost/Found Pet features)
├── home/                           # 12 files (Dashboard, Daily Check-in, Tips, etc)
├── nearby/                         # 1 file (NearbyVetsScreen)
├── appointments/                   # 2 files (Appointments, Add Appointment)
├── reminders/                      # 2 files (Reminders, Add Reminder)
├── settings/                       # 7 files (Privacy, Appearance, Help, About, etc)
├── onboarding/                     # 4 files (Splash, Slides, Welcome, App Entry Gate)
├── preferences/                    # Preference-related components
├── shared/                         # Reusable components (Header, BottomNav, etc)
└── __tests__/                      # Unit test files
```

### Context Providers (State Management)

```
src/app/contexts/
├── AuthContext.tsx                 # User authentication state
├── PetContext.tsx                  # Pet management & multi-pet support
├── MedicalContext.tsx              # Medical events, medications, timeline
├── RemindersContext.tsx            # Reminder scheduling & management
├── NotificationContext.tsx         # In-app notifications + FCM
├── PreferenceContext.tsx           # User preferences (theme, language, etc)
└── GamificationContext.tsx         # Points, achievements, streaks
```

### Services (Backend Integration)

```
src/app/services/
├── notificationService.ts          # FCM push notifications (100+ lines)
├── gmailSyncService.ts             # Gmail OAuth & sync status (60+ lines)
├── analysisService.ts              # Medical data extraction & analysis
├── calendarSyncService.ts          # iCal export for appointments
├── dataExportService.ts            # PDF/Excel export logic
├── brainKnowledgeService.ts        # Pessy AI knowledge base queries
├── petPhotoService.ts              # Photo upload to Firebase Storage
└── accountDeletionService.ts       # GDPR data deletion
```

### Utilities (Helper Functions)

```
src/app/utils/
├── medicalRulesEngine.ts           # Rules for medical analysis & triage
├── clinicalBrain.ts                # Clinical reasoning logic
├── clinicalNarrative.ts            # Generate medical narratives
├── clinicalRouting.ts              # Route events to appropriate handlers
├── pdfExport.ts                    # jsPDF + PDF generation (80+ lines)
├── calendarExport.ts               # iCal format generation
├── deduplication.ts                # Prevent duplicate events from email sync
├── coTutorInvite.ts                # Co-tutor invitation logic
├── gamification.ts                 # Points & achievement calculations
├── authActionLinks.ts              # Email link auth URL builder
├── breedSearch.ts                  # Dog/cat breed database search
├── dateUtils.ts                    # Date parsing & formatting
├── cleanText.ts                    # Text sanitization
├── platformInvite.ts               # Cross-platform sharing
├── secureStorage.ts                # Encrypted local storage
├── storageUpload.ts                # File upload progress tracking
├── runtimeFlags.ts                 # Feature flags for dev/prod
├── aiTransparency.ts               # AI disclosure messaging
├── acquisitionTracking.ts          # User acquisition tracking
├── inAppBrowser.ts                 # In-app browser for external links
├── pwaInstall.ts                   # PWA install prompt handling
├── reportVerification.ts           # Medical report verification
└── pricing.ts                      # Subscription/pricing logic
```

### Data & Types

```
src/app/data/
├── breeds.ts                       # Dog & cat breed database (~1000 breeds)
└── countries.ts                    # Country & timezone list

src/app/types/
└── medical.ts                      # TypeScript interfaces for medical data

src/app/constants/
├── designTokens.ts                 # Tailwind/color tokens
├── legal.ts                        # Legal text constants
├── petDefaults.ts                  # Default pet data
└── STYLE_GUIDE.md                  # Design system documentation
```

### Domain Models (Business Logic)

```
src/domain/
├── community/
│   ├── adoption.contract.ts        # Adoption data contracts
│   ├── adoptionMatcher.ts          # Pet matching algorithm
│   └── lostPet.contract.ts         # Lost pet contracts
├── gamification/
│   └── gamification.contract.ts    # Achievement/points contracts
├── intelligence/
│   ├── pessyIntelligenceEngine.ts  # Main AI engine
│   ├── smartSuggestionGenerator.ts # Smart suggestions
│   └── userRoutinePreferences.ts   # Routine preference tracking
├── preferences/
│   ├── questionPool.ts             # Questions for preference discovery
│   └── questionSelector.ts         # Question selection logic
├── training/
│   └── training_master_book.ts     # Training data for AI
└── wellbeing/
    ├── wellbeingMasterBook.ts      # Wellbeing protocols
    └── wellbeingProtocol.contract.ts # Wellbeing contracts
```

### Configuration Files

```
vite.config.ts                      # Vite + PWA plugin config (160 lines)
firebase.json                       # Firebase Hosting config
firebase.pwa.json                   # Alternate PWA hosting config
index.html                          # Entry HTML
tsconfig.json                       # TypeScript config
tailwind.config.js                  # Tailwind CSS config (via @tailwindcss/vite)
postcss.config.mjs                  # PostCSS config
vitest.functions.config.ts          # Unit testing config

.env.example                        # Environment variables template
.env.local                          # Local environment (Git ignored)
```

### Firebase Setup

```
src/lib/firebase.ts                 # Firebase initialization (65 lines)
  - VITE_FIREBASE_PROJECT_ID
  - VITE_FIREBASE_API_KEY
  - VITE_FIREBASE_AUTH_DOMAIN
  - VITE_FIREBASE_STORAGE_BUCKET
  - VITE_FIREBASE_MESSAGING_SENDER_ID
  - VITE_FIREBASE_APP_ID
  - VITE_FIREBASE_VAPID_KEY (FCM)
```

### Public Assets

```
public/
├── manifest.webmanifest            # PWA manifest (minified JSON)
├── pwa-192x192.png                 # App icon (192x192)
├── pwa-512x512.png                 # App icon (512x512)
├── apple-touch-icon.png            # iOS PWA icon
├── pessy-logo.png                  # Logo
├── pessy-logo.svg                  # Logo SVG
├── og-cover.png                    # OG image for social
├── robots.txt                      # Search engine crawling
├── sitemap.xml                     # Sitemap for SEO
├── 404.html                        # Custom 404 page
├── firebase-messaging-sw.js        # Firebase messaging service worker
└── landing.html & blog.html        # Landing pages

dist/                               # Build output (production)
├── index.html                      # Built PWA (minified, 1567 bytes)
├── manifest.webmanifest            # Generated manifest
├── sw.js                           # Generated service worker (minified)
├── assets/                         # Split code chunks
└── pwa-*.png                       # Icons
```

---

## Key Code Examples

### 1. Firebase Configuration

**File:** `src/lib/firebase.ts`
```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Allowed hosts for security
const ALLOWED_HOSTS = new Set([
  "pessy.app",
  "app.pessy.app",
  "polar-scene-488615-i0.web.app",
  "localhost"
]);
```

### 2. Service Worker (Workbox) Configuration

**File:** `vite.config.ts` (PWA plugin section)
```typescript
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
  manifest: {
    name: 'Pessy',
    short_name: 'Pessy',
    display: 'standalone',
    orientation: 'portrait',
  },
  workbox: {
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    navigateFallback: '/index.html',
    runtimeCaching: [
      { urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i, handler: 'CacheFirst' },
      { urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i, handler: 'NetworkFirst' },
    ]
  }
})
```

### 3. Firebase Authentication Context

**File:** `src/app/contexts/AuthContext.tsx` (structure)
```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

// Provides: 
// - User state
// - Authentication functions
// - Session persistence
```

### 4. Medical Data Model

**File:** `src/app/types/medical.ts` (structure)
```typescript
interface MedicalEvent {
  id: string;
  petId: string;
  type: 'vaccine' | 'medication' | 'analysis' | 'appointment' | 'procedure';
  title: string;
  date: string;
  veterinarian?: string;
  notes?: string;
  source?: 'manual' | 'scanned' | 'email';
}

interface ActiveMedication {
  id: string;
  petId: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  prescribedBy?: string;
}
```

### 5. Document Scanner Extraction

**File:** `src/app/components/medical/DocumentScannerModal.tsx` (snippet)
```typescript
interface DocumentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type UploadStage = "select" | "processing" | "treatment_questions" | "success" | "error";

// Stages:
// 1. select - File picker
// 2. processing - OCR simulation
// 3. treatment_questions - Review extracted data
// 4. success - Data saved
// 5. error - Error handling
```

### 6. Notification Service (FCM)

**File:** `src/app/services/notificationService.ts` (snippet)
```typescript
class NotificationServiceClass {
  private messaging: Messaging | null = null;
  
  pushStatus: "unknown" | "available" | "denied" | "unsupported" | "error";
  
  async requestPermissionAndGetToken(): Promise<string | null> {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const token = await getToken(this.messaging, { vapidKey: VAPID_KEY });
      return token;
    }
    return null;
  }
  
  async scheduleNotification(options: ScheduledNotification): Promise<void> {
    // Store in Firestore for backend delivery
    await addDoc(collection(db, "notifications"), options);
  }
}
```

### 7. Pet Context (Multi-pet Support)

**File:** `src/app/contexts/PetContext.tsx` (structure)
```typescript
interface PetContextType {
  activePetId: string;
  setActivePetId: (id: string) => void;
  pets: Pet[];
  activePet: Pet | undefined;
  addPet: (pet: Pet) => void;
  updatePet: (petId: string, updates: Partial<Pet>) => void;
  removePet: (petId: string) => void;
}

// Persisted in localStorage
// Synced with Firestore
```

### 8. Routes Configuration

**File:** `src/app/routes.tsx` (key routes)
```typescript
export const router = createBrowserRouter([
  { path: "/", Component: RootRoute },                    // Landing or Home
  { path: "/login", Component: LoginScreen },
  { path: "/register-user", Component: RegisterUserScreen },
  { path: "/register-pet", Component: RegisterPetStep1 },
  { path: "/register-pet/step2", Component: RegisterPetStep2 },
  { path: "/inicio", Component: HomeScreen },            // Main app
  { path: "/review/:reviewId", Component: ClinicalReviewScreen },
  { path: "/adopcion", Component: AdoptionFeed },
  { path: "*", element: <CatchAllRedirect /> },
]);

// Runtime detection:
// - Inside Flutter WebView → /inicio
// - app.pessy.app → /inicio
// - pessy.app → landing
// - localhost → /inicio
```

### 9. Package Dependencies

**File:** `package.json` (key dependencies)
```json
{
  "dependencies": {
    "@capacitor/app": "^7.1.1",
    "@capacitor/browser": "^7.0.2",
    "@capacitor/core": "^7.4.3",
    "firebase": "^12.9.0",
    "heic2any": "^0.0.4",
    "jspdf": "^4.2.1",
    "lucide-react": "^0.487.0",
    "motion": "^12.38.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "7.55.0",
    "react-router": "7.13.0",
    "sonner": "2.0.3",
    "tailwind-merge": "3.2.0"
  },
  "devDependencies": {
    "@capacitor/android": "^7.4.3",
    "@capacitor/ios": "^7.4.3",
    "@capacitor/cli": "^7.4.3",
    "@tailwindcss/vite": "^4.1.12",
    "vite": "^6.3.5",
    "vite-plugin-pwa": "^1.2.0",
    "typescript": "^5.9.2"
  }
}
```

---

## Build & Deployment

### Vite Build Output

```bash
npm run build

# Outputs to dist/
# - index.html (minified SPA entry)
# - manifest.webmanifest
# - sw.js (Service Worker)
# - assets/ (code-split chunks)
#   - firebase-*.js (Firebase modules)
#   - vendor-*.js (heavy libraries)
#   - app-*.js (app code)
#   - *.css (styles)
```

### Firebase Hosting Configuration

**File:** `firebase.json`
```json
{
  "hosting": {
    "predeploy": ["bash pre-deploy-check.sh"],
    "public": "dist",
    "rewrites": [{
      "source": "**",
      "destination": "/index.html"
    }],
    "headers": [{
      "source": "/index.html",
      "headers": [{
        "key": "Cache-Control",
        "value": "no-cache, no-store, must-revalidate"
      }]
    }]
  }
}
```

### Deploy Commands

```bash
# PWA to Firebase Hosting
firebase deploy --only hosting

# Full stack (Firestore, Functions, Hosting)
firebase deploy

# Functions only
firebase deploy --only functions
```

---

## Database Schema (Firestore)

### Collections Overview

```
users/{userId}
├── displayName: string
├── email: string
├── photoURL: string
├── createdAt: timestamp
├── gmailSync: { connected, accountEmail, scopes, status }
├── preferences: { theme, language, notifications }
└── settings: { privacyLevel, dataRetention }

pets/{petId}
├── name: string
├── species: 'dog' | 'cat'
├── breed: string
├── birthDate: date
├── weight: number
├── sex: 'male' | 'female'
├── isNeutered: boolean
├── photo: { url, storagePath }
├── personality: { energy, sociability, training }
├── microchip: string
├── userId: string
├── createdAt: timestamp
└── updatedAt: timestamp

medical/{petId}/events/{eventId}
├── type: 'vaccine' | 'medication' | 'analysis' | 'appointment' | 'procedure'
├── title: string
├── date: date
├── veterinarian: string
├── clinic: string
├── notes: string
├── attachments: []
├── source: 'manual' | 'scanned' | 'email'
├── confidence: number
├── requiresReview: boolean
├── _semanticKey: string (for deduplication)
└── createdAt: timestamp

medical/{petId}/medications/{medicationId}
├── name: string
├── dosage: string
├── frequency: string
├── startDate: date
├── endDate: date | null
├── prescribedBy: string
├── notes: string
├── reminders: []
└── createdAt: timestamp

notifications/{userId}/scheduled/{notificationId}
├── petId: string
├── type: 'medication' | 'appointment' | 'vaccine_reminder' | 'results'
├── title: string
├── body: string
├── scheduledFor: timestamp
├── sent: boolean
├── repeat: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'none'
└── active: boolean

community/adoption/{adoptionId}
├── petId: string
├── ownerId: string
├── title: string
├── description: string
├── photos: []
├── status: 'available' | 'pending' | 'adopted'
└── createdAt: timestamp
```

---

## Testing & Quality

### Test Configuration

**File:** `vitest.functions.config.ts`
```typescript
{
  environment: 'jsdom',
  exclude: [...configDefaults.exclude, '.claude/**'],
  environmentMatchGlobs: [
    ['functions/**', 'node'],
  ],
}
```

### Test Files Location

```
src/app/components/__tests__/
domain/intelligence/__tests__/
functions/                      # Cloud Functions tests
```

---

## Performance Metrics (Estimated)

**Bundle Size (Production):**
- main.js: ~180-220 KB gzipped
- CSS: ~40-60 KB gzipped
- firebase-auth.js: ~50-70 KB gzipped
- firebase-firestore.js: ~100-130 KB gzipped
- Total: ~300-400 KB gzipped

**Load Times (3G):**
- First Contentful Paint: ~1.5-2s
- Largest Contentful Paint: ~2.5-3s
- Time to Interactive: ~3-4s

**Service Worker:**
- Precache: ~50 assets (~400-500 KB uncompressed)
- Runtime cache: Limited by browser storage (50MB+ available)

---

## Environment Variables

**Required for Production:**

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=pessy.app
VITE_FIREBASE_PROJECT_ID=polar-scene-488615-i0
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=BG4wi3_yDKJa6XYueelKVk-Tz8qt2Adg34fzK5lhCduewZ-CyaPULVu8VqA2oP_jVz9FYpONPy68J_zV9KQ

VITE_USE_BACKEND_ANALYSIS=true
VITE_ENABLE_EMAIL_SYNC=true
VITE_ENABLE_PENDING_ACTIONS=false
VITE_ENABLE_PREVIEW_ROUTES=false
```

---

## Documentation Files

**In Repository:**
- `README.md` - High-level project overview
- `PROJECT_SUMMARY.md` - Detailed feature inventory
- `ONBOARDING_IMPLEMENTATION.md` - Onboarding flow details
- `NAVIGATION_MAP.md` - Screen navigation guide
- `UI_STATES_GUIDE.md` - Component state documentation
- `ASSETS_EXPORT_GUIDE.md` - Asset export specifications
- `CLAUDE.md` - AI behavior guidelines & medical rules
- `CODEX.md` - Architecture reference

---

**Last Updated:** April 1, 2026
