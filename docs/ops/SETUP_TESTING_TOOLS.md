# SETUP DE HERRAMIENTAS DE TESTING - PESSY

Guía paso a paso para configurar testing, linting y CI/CD.

---

## 1. VITEST CONFIGURATION

### 1.1 Crear `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
      all: true,
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### 1.2 Actualizar `src/test/setup.ts`

```typescript
import '@testing-library/jest-dom/vitest'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Firebase globally
vi.mock('../lib/firebase', () => ({
  auth: {
    currentUser: null,
  },
  db: {},
  functions: {},
  storage: {},
  analytics: {},
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn() as any
```

### 1.3 Actualizar `package.json` scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:integration": "vitest run --include '**/*.integration.test.ts'",
    "test:unit": "vitest run --include '**/*.test.ts' --exclude '**/*.integration.test.ts'"
  }
}
```

### 1.4 Ejecutar para verificar

```bash
npm run test
# Debería pasar el test existente: PrivacySecurityScreen.test.tsx
```

---

## 2. ESLINT CONFIGURATION

### 2.1 Instalar dependencias

```bash
npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react eslint-plugin-react-hooks
```

### 2.2 Crear `.eslintrc.json`

```json
{
  "root": true,
  "env": {
    "browser": true,
    "es2021": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "ignorePatterns": ["dist", "node_modules", "build"],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "plugins": [
    "react-refresh",
    "@typescript-eslint",
    "react",
    "react-hooks"
  ],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "no-console": [
      "warn",
      {
        "allow": ["warn", "error"]
      }
    ]
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

### 2.3 Crear `.eslintignore`

```
node_modules/
dist/
build/
.next/
.nuxt/
out/
coverage/
functions/
android/
ios/
```

### 2.4 Actualizar `package.json` scripts

```json
{
  "scripts": {
    "lint": "eslint src --ext .ts,.tsx --max-warnings 5",
    "lint:fix": "eslint src --ext .ts,.tsx --fix"
  }
}
```

---

## 3. PRETTIER CONFIGURATION

### 3.1 Instalar

```bash
npm install --save-dev prettier eslint-config-prettier eslint-plugin-prettier
```

### 3.2 Crear `.prettierrc`

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "bracketSpacing": true,
  "endOfLine": "lf"
}
```

### 3.3 Crear `.prettierignore`

```
node_modules/
dist/
build/
coverage/
functions/
android/
ios/
*.svg
*.pdf
```

### 3.4 Actualizar `.eslintrc.json` para Prettier

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:prettier/recommended"
  ]
}
```

### 3.5 Actualizar `package.json` scripts

```json
{
  "scripts": {
    "format": "prettier --write 'src/**/*.{ts,tsx,json,css}'",
    "format:check": "prettier --check 'src/**/*.{ts,tsx,json,css}'"
  }
}
```

---

## 4. PLAYWRIGHT E2E CONFIGURATION

### 4.1 Crear `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reportSlowTests: null,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['list'],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
})
```

### 4.2 Crear estructura de E2E tests

```bash
mkdir -p e2e/smoke
mkdir -p e2e/security
mkdir -p e2e/mobile
mkdir -p e2e/flows

# Crear archivo base
touch e2e/smoke/auth.spec.ts
touch e2e/smoke/pet-management.spec.ts
touch e2e/security/security-headers.spec.ts
touch e2e/mobile/responsive.spec.ts
```

### 4.3 Ejemplo E2E test: `e2e/smoke/auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Smoke: Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display login form', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.locator('button:has-text("Ingresar")')

    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
    await expect(submitButton).toBeVisible()
  })

  test('should show validation error for empty fields', async ({ page }) => {
    const submitButton = page.locator('button:has-text("Ingresar")')
    await submitButton.click()

    const error = page.locator('[role="alert"]')
    await expect(error).toBeVisible()
  })

  test('should show validation error for invalid email', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]')
    const submitButton = page.locator('button:has-text("Ingresar")')

    await emailInput.fill('invalid-email')
    await submitButton.click()

    const error = page.locator('[role="alert"]')
    await expect(error).toBeVisible()
  })
})
```

### 4.4 Actualizar `package.json` scripts

```json
{
  "scripts": {
    "e2e": "playwright test",
    "e2e:watch": "playwright test --watch",
    "e2e:debug": "playwright test --debug",
    "e2e:smoke": "playwright test --grep @smoke",
    "e2e:report": "playwright show-report",
    "e2e:ui": "playwright test --ui"
  }
}
```

### 4.5 Instalar browsers

```bash
npx playwright install chromium firefox webkit
```

---

## 5. GITHUB ACTIONS CI/CD

### 5.1 Crear `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    strategy:
      matrix:
        node-version: [20]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint
        continue-on-error: true

      - name: Check formatting
        run: npm run format:check
        continue-on-error: true

      - name: Run unit tests
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: unittests
          fail_ci_if_error: false

      - name: Build application
        run: npm run build

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run e2e

      - name: Upload Playwright report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - name: Check npm audit
        run: npm audit --production
        continue-on-error: true
```

### 5.2 Crear `.github/workflows/deploy.yml`

```yaml
name: Deploy to Firebase

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: pessy-app
          channelId: live
```

---

## 6. SECURITY CONFIGURATION

### 6.1 Actualizar `firebase.json` con security headers

```json
{
  "hosting": {
    "public": "dist",
    "cleanUrls": true,
    "trailingSlash": false,
    "rewrites": [
      {
        "source": "**",
        "destination": "/app.html"
      }
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=31536000; includeSubDomains; preload"
          },
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://*.cloudfunctions.net"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          },
          {
            "key": "Permissions-Policy",
            "value": "geolocation=(), microphone=(), camera=(), payment=()"
          }
        ]
      },
      {
        "source": "/offline.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache"
          }
        ]
      }
    ],
    "cacheConfig": {
      "default": 3600,
      "public/**": 31536000,
      "dist/**": 31536000
    }
  }
}
```

### 6.2 npm audit script para CI

```json
{
  "scripts": {
    "audit": "npm audit --production",
    "audit:fix": "npm audit fix",
    "audit:report": "npm audit --json > audit-report.json"
  }
}
```

---

## 7. TYPESCRIPT STRICT MODE

### 7.1 Actualizar `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

---

## 8. PRE-COMMIT HOOKS (Optional)

### 8.1 Instalar husky

```bash
npm install --save-dev husky
npx husky install
```

### 8.2 Crear pre-commit hook

```bash
npx husky add .husky/pre-commit "npm run lint && npm run format:check"
```

---

## 9. QUICK START COMMANDS

```bash
# Install everything
npm install

# Run linter
npm run lint
npm run lint:fix

# Format code
npm run format

# Run tests
npm run test                    # once
npm run test:watch            # watch mode
npm run test:coverage         # with coverage
npm run test:integration      # integration only

# Run E2E
npx playwright install
npm run e2e

# Security check
npm audit
npm audit fix

# Build
npm run build

# Full validation (pre-commit)
npm run lint && npm run format:check && npm run test && npm run build
```

---

## 10. TROUBLESHOOTING

### Vitest no encuentra módulos
```bash
# Asegurar que paths en tsconfig.json coinciden con vite.config.ts
# Patrón: "@/*" -> "./src/*" en ambos lugares
```

### Playwright timeout en CI
```yaml
# Aumentar timeout en .github/workflows/test.yml
timeout-minutes: 60
```

### Firebase mocks no funcionan
```typescript
// Usar vi.mock() ANTES de imports
// Orden importa en vitest
import { vi } from 'vitest'
vi.mock('firebase/auth')
```

---

**Última actualización:** Marzo 2026
