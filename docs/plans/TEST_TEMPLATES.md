# PLANTILLAS DE TESTS - PESSY

Ejemplos de tests listos para copiar y adaptar.

---

## UNIT TESTS

### 1. Test de Utilidad (dateUtils)

```typescript
// src/app/utils/__tests__/dateUtils.test.ts
import { describe, it, expect } from 'vitest'
import { toDateKeySafe, toTimestampSafe, formatDateForDisplay } from '../dateUtils'

describe('dateUtils', () => {
  describe('toDateKeySafe', () => {
    it('should convert valid date to YYYY-MM-DD format', () => {
      const date = new Date('2026-03-15T10:30:00Z')
      const result = toDateKeySafe(date)
      expect(result).toBe('2026-03-15')
    })

    it('should handle null input gracefully', () => {
      const result = toDateKeySafe(null)
      expect(result).toBeNull()
    })

    it('should handle undefined input gracefully', () => {
      const result = toDateKeySafe(undefined)
      expect(result).toBeNull()
    })

    it('should handle edge case: leap year', () => {
      const date = new Date('2024-02-29')
      const result = toDateKeySafe(date)
      expect(result).toBe('2024-02-29')
    })

    it('should handle edge case: year boundary', () => {
      const date = new Date('2026-12-31')
      const result = toDateKeySafe(date)
      expect(result).toBe('2026-12-31')
    })
  })

  describe('toTimestampSafe', () => {
    it('should convert date to timestamp', () => {
      const date = new Date('2026-03-15T10:30:00Z')
      const result = toTimestampSafe(date)
      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThan(0)
    })

    it('should handle null input', () => {
      const result = toTimestampSafe(null)
      expect(result).toBeNull()
    })
  })

  describe('formatDateForDisplay', () => {
    it('should format date for user display in Spanish', () => {
      const date = new Date('2026-03-15')
      const result = formatDateForDisplay(date)
      expect(result).toMatch(/15 de marzo/)
    })
  })
})
```

---

### 2. Test de Servicio (notificationService)

```typescript
// src/app/services/__tests__/notificationService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { subscribeToNotifications, sendNotification } from '../notificationService'
import { auth, db } from '../../../lib/firebase'

vi.mock('../../../lib/firebase')

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('subscribeToNotifications', () => {
    it('should subscribe to user notifications', () => {
      const userId = 'test-user-123'
      const callback = vi.fn()

      const unsubscribe = subscribeToNotifications(userId, callback)

      expect(unsubscribe).toBeDefined()
      expect(typeof unsubscribe).toBe('function')
    })

    it('should handle subscription errors gracefully', () => {
      const userId = 'test-user-123'
      const callback = vi.fn()

      // Mock Firebase error
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const unsubscribe = subscribeToNotifications(userId, callback)

      expect(unsubscribe).toBeDefined()
    })
  })

  describe('sendNotification', () => {
    it('should send notification with valid payload', async () => {
      const payload = {
        userId: 'test-user-123',
        title: 'Test Notification',
        message: 'This is a test',
      }

      const result = await sendNotification(payload)

      expect(result).toHaveProperty('id')
      expect(result.status).toBe('sent')
    })

    it('should reject notification with missing required fields', async () => {
      const payload = {
        userId: 'test-user-123',
        // Missing title and message
      }

      await expect(sendNotification(payload as any)).rejects.toThrow()
    })
  })
})
```

---

### 3. Test de Context (AuthContext)

```typescript
// src/app/contexts/__tests__/AuthContext.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../AuthContext'

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}))

vi.mock('../../../lib/firebase', () => ({
  auth: {},
}))

function TestComponent() {
  const { user, loading, logout } = useAuth()

  if (loading) return <div>Loading...</div>

  return (
    <div>
      {user ? (
        <>
          <p>Welcome, {user.email}</p>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <p>Not logged in</p>
      )}
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should provide loading state initially', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should provide user object when logged in', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })
  })

  it('should handle logout', async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    const logoutButton = screen.getByRole('button', { name: /logout/i })
    await user.click(logoutButton)

    // Verify logout was called
    // Depends on implementation
  })
})
```

---

## INTEGRATION TESTS

### 1. Test de Flujo: Login → Home

```typescript
// src/app/components/__tests__/LoginScreen.integration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router'
import { LoginScreen } from '../LoginScreen'
import { AuthProvider } from '../../contexts/AuthContext'

// Mock Firebase Auth
const mockSignIn = vi.fn()
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: mockSignIn,
}))

vi.mock('../../../lib/firebase', () => ({
  auth: { currentUser: null },
}))

function renderWithProviders(component: React.ReactNode) {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('LoginScreen Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignIn.mockResolvedValue({
      user: {
        uid: 'test-uid-123',
        email: 'test@example.com',
      },
    })
  })

  it('should login user and update auth context', async () => {
    const user = userEvent.setup()

    renderWithProviders(<LoginScreen />)

    const emailInput = screen.getByPlaceholderText(/email/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)
    const submitButton = screen.getByRole('button', { name: /ingresar/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com',
        'password123'
      )
    })
  })

  it('should show error for invalid credentials', async () => {
    const user = userEvent.setup()
    mockSignIn.mockRejectedValue({
      code: 'auth/user-not-found',
    })

    renderWithProviders(<LoginScreen />)

    const emailInput = screen.getByPlaceholderText(/email/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)
    const submitButton = screen.getByRole('button', { name: /ingresar/i })

    await user.type(emailInput, 'wrong@example.com')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /usuario no encontrado/i
      )
    })
  })

  it('should validate email format before submission', async () => {
    const user = userEvent.setup()

    renderWithProviders(<LoginScreen />)

    const emailInput = screen.getByPlaceholderText(/email/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)
    const submitButton = screen.getByRole('button', { name: /ingresar/i })

    await user.type(emailInput, 'invalid-email')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    expect(mockSignIn).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/email inválido/i)
  })
})
```

---

### 2. Test de Flujo: Pet CRUD

```typescript
// src/app/contexts/__tests__/PetContext.integration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PetProvider, usePets } from '../PetContext'

const mockGetDocs = vi.fn()
const mockAddDoc = vi.fn()
const mockUpdateDoc = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: mockGetDocs,
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
}))

function TestPetComponent() {
  const { pets, loading, createPet, updatePet } = usePets()

  return (
    <div>
      {loading ? (
        <p>Loading pets...</p>
      ) : (
        <>
          <ul>
            {pets.map((pet) => (
              <li key={pet.id}>{pet.name}</li>
            ))}
          </ul>
          <button
            onClick={() =>
              createPet({
                name: 'Fluffy',
                species: 'cat',
                breed: 'Persian',
                birthDate: '2020-01-15',
              })
            }
          >
            Add Pet
          </button>
        </>
      )}
    </div>
  )
}

describe('PetContext Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'pet-1',
          data: () => ({
            name: 'Max',
            species: 'dog',
            breed: 'Labrador',
          }),
        },
      ],
    })
  })

  it('should load pets on mount', async () => {
    render(
      <PetProvider>
        <TestPetComponent />
      </PetProvider>
    )

    expect(screen.getByText('Loading pets...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Max')).toBeInTheDocument()
    })
  })

  it('should create new pet', async () => {
    const user = userEvent.setup()
    mockAddDoc.mockResolvedValue({
      id: 'pet-2',
    })

    render(
      <PetProvider>
        <TestPetComponent />
      </PetProvider>
    )

    const addButton = screen.getByRole('button', { name: /add pet/i })
    await user.click(addButton)

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalled()
    })
  })

  it('should handle create pet error', async () => {
    const user = userEvent.setup()
    mockAddDoc.mockRejectedValue(new Error('Permission denied'))

    render(
      <PetProvider>
        <TestPetComponent />
      </PetProvider>
    )

    const addButton = screen.getByRole('button', { name: /add pet/i })
    await user.click(addButton)

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalled()
    })
  })
})
```

---

## E2E TESTS

### 1. Smoke Test: Login

```typescript
// e2e/smoke/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Smoke: Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display login form with all fields', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.locator('button:has-text("Ingresar")')
    const forgotLink = page.locator('a:has-text("Olvidé mi contraseña")')

    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
    await expect(submitButton).toBeVisible()
    await expect(forgotLink).toBeVisible()
  })

  test('should show validation error for empty email', async ({ page }) => {
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.locator('button:has-text("Ingresar")')

    await passwordInput.fill('password123')
    await submitButton.click()

    const alert = page.locator('[role="alert"]')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('email')
  })

  test('should show validation error for invalid email format', async ({
    page,
  }) => {
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.locator('button:has-text("Ingresar")')

    await emailInput.fill('invalid-email')
    await passwordInput.fill('password123')
    await submitButton.click()

    const alert = page.locator('[role="alert"]')
    await expect(alert).toBeVisible()
  })

  test('should show loading state on submit', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.locator('button:has-text("Ingresar")')

    await emailInput.fill('test@example.com')
    await passwordInput.fill('password123')

    // Click and check for loading state
    const clickPromise = submitButton.click()

    // Loading button should be disabled
    await expect(submitButton).toBeDisabled()

    await clickPromise
  })
})
```

---

### 2. Smoke Test: Pet Management

```typescript
// e2e/smoke/pet-management.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Smoke: Pet Management @smoke', () => {
  test.beforeEach(async ({ page, context }) => {
    // Simular login primero
    // En producción, usar fixtures para persistir auth
    await page.goto('/login')

    // Mock login si es necesario
    await page.waitForURL('/home', { timeout: 5000 }).catch(() => {
      // Si falla login, seguir de todas formas
    })
  })

  test('should display pet list on home', async ({ page }) => {
    await page.goto('/home')

    const petList = page.locator('[data-testid="pet-list"]')
    await expect(petList).toBeVisible()
  })

  test('should open pet creation modal', async ({ page }) => {
    await page.goto('/home')

    const addButton = page.locator('button:has-text("Agregar mascota")')
    await addButton.click()

    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible()
    await expect(modal).toContainText('Información de la mascota')
  })

  test('should validate pet creation form', async ({ page }) => {
    await page.goto('/home')

    const addButton = page.locator('button:has-text("Agregar mascota")')
    await addButton.click()

    const modal = page.locator('[role="dialog"]')
    const submitButton = modal.locator('button:has-text("Crear")')

    // Submit empty form
    await submitButton.click()

    // Should show validation errors
    const alert = modal.locator('[role="alert"]')
    await expect(alert).toBeVisible()
  })

  test('should show pet details after creation', async ({ page }) => {
    // Navigate to home
    await page.goto('/home')

    // If no pets, create one
    const petList = page.locator('[data-testid="pet-list"]')
    const petCount = await petList.locator('li').count()

    if (petCount === 0) {
      const addButton = page.locator('button:has-text("Agregar mascota")')
      await addButton.click()

      const modal = page.locator('[role="dialog"]')
      const nameInput = modal.locator('input[name="name"]')
      const speciesInput = modal.locator('select[name="species"]')
      const submitButton = modal.locator('button:has-text("Crear")')

      await nameInput.fill('Fluffy')
      await speciesInput.selectOption('cat')
      await submitButton.click()

      await page.waitForURL('/home/*/profile', { timeout: 5000 })
    }

    // Click on pet
    const firstPet = petList.locator('li').first()
    await firstPet.click()

    // Should show pet details
    const petName = page.locator('[data-testid="pet-name"]')
    await expect(petName).toBeVisible()
  })
})
```

---

### 3. Security Test: Security Headers

```typescript
// e2e/security/headers.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Security: HTTP Headers @security', () => {
  test('should have required security headers', async ({ page }) => {
    const response = await page.goto('/')

    const headers = response?.headers()

    // Content-Type
    expect(headers?.['content-type']).toContain('text/html')

    // Security headers
    expect(headers?.['x-content-type-options']).toBe('nosniff')
    expect(headers?.['x-frame-options']).toBe('DENY')
    expect(headers?.['x-xss-protection']).toContain('1; mode=block')
    expect(headers?.['strict-transport-security']).toBeDefined()
    expect(headers?.['content-security-policy']).toBeDefined()
  })

  test('should enforce HTTPS', async ({ page }) => {
    const url = page.url()
    expect(url).toMatch(/^https:/)
  })

  test('should have CSP header blocking inline scripts', async ({ page }) => {
    const response = await page.goto('/')
    const cspHeader = response?.headers()['content-security-policy']

    expect(cspHeader).toContain("default-src 'self'")
  })
})
```

---

### 4. Mobile Test: Responsive

```typescript
// e2e/mobile/responsive.spec.ts
import { test, expect, devices } from '@playwright/test'

test.describe('Mobile: Responsive Design @mobile', () => {
  test('should render on iPhone 12', async ({ playwright }) => {
    const browser = await playwright.chromium.launch()
    const context = await browser.createBrowserContext({
      ...devices['iPhone 12'],
    })
    const page = await context.newPage()

    await page.goto('/')

    // Check viewport
    const viewport = page.viewportSize()
    expect(viewport?.width).toBe(390)
    expect(viewport?.height).toBe(844)

    // Check layout shifts
    const button = page.locator('button:has-text("Ingresar")')
    await expect(button).toBeVisible()
    await expect(button).toHaveCSS('width', '100%') // Should fill width on mobile

    await context.close()
    await browser.close()
  })

  test('should render on Android (Pixel 5)', async ({ playwright }) => {
    const browser = await playwright.chromium.launch()
    const context = await browser.createBrowserContext({
      ...devices['Pixel 5'],
    })
    const page = await context.newPage()

    await page.goto('/')

    const viewport = page.viewportSize()
    expect(viewport?.width).toBe(393)
    expect(viewport?.height).toBe(851)

    await context.close()
    await browser.close()
  })

  test('should have readable text on mobile (12px+)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    const bodyText = page.locator('body *')
    const count = await bodyText.count()

    for (let i = 0; i < Math.min(count, 20); i++) {
      const fontSize = await bodyText.nth(i).evaluate((el) =>
        window.getComputedStyle(el as HTMLElement).fontSize
      )
      const fontSizeNum = parseInt(fontSize)

      if (fontSizeNum > 0) {
        expect(fontSizeNum).toBeGreaterThanOrEqual(12)
      }
    }
  })

  test('should not have horizontal scroll on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    )
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth
    )

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1) // +1 for rounding errors
  })
})
```

---

## FIXTURES & HELPERS

### Firebase Mock Fixture

```typescript
// src/test/fixtures/firebase.ts
import { vi } from 'vitest'

export const createFirebaseAuthMock = () => ({
  signInWithEmailAndPassword: vi.fn().mockResolvedValue({
    user: {
      uid: 'test-uid',
      email: 'test@example.com',
      displayName: 'Test User',
    },
  }),
  signOut: vi.fn().mockResolvedValue(undefined),
  onAuthStateChanged: vi.fn((callback) => {
    callback({
      uid: 'test-uid',
      email: 'test@example.com',
    })
    return () => {}
  }),
})

export const createFirestoreMock = () => ({
  collection: vi.fn(),
  query: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    docs: [],
  }),
  getDoc: vi.fn().mockResolvedValue({
    data: () => ({}),
  }),
  addDoc: vi.fn().mockResolvedValue({
    id: 'mock-id',
  }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
})
```

---

**Fin de plantillas. Copiar, adaptar y ejecutar.**
