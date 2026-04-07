# PESSY - PLAN DE QA Y TESTING 2026

## 📋 ÍNDICE DE DOCUMENTOS

Este plan completo de QA está compuesto por 4 documentos interconectados. **Lee primero el resumen ejecutivo**, luego elige según tu rol.

### 1. **QA_EXECUTIVE_SUMMARY.md** ⭐ COMIENZA AQUÍ
   - **Para:** Directores, Product Managers, CTOs
   - **Contenido:** Snapshot actual, riesgos críticos, plan mínimo de 2 semanas
   - **Lectura:** 5 minutos
   - **Acción:** Aprueba recursos y timeline

### 2. **PLAN_QA_TESTING_2026.md** 📊 EL PLAN COMPLETO
   - **Para:** QA Engineers, Tech Leads
   - **Contenido:** 
     - Estado actual detallado (tests, cobertura, herramientas)
     - Plan de testing por capas (unit, integration, E2E, mobile, performance)
     - Security audit completo (Firestore, Storage, Auth, dependencias)
     - Checklist pre-launch
     - Estimación de esfuerzo (364 horas, 4 semanas)
   - **Lectura:** 60 minutos
   - **Acción:** Implementar estrategia de testing

### 3. **SETUP_TESTING_TOOLS.md** 🔧 CONFIGURACIÓN PASO A PASO
   - **Para:** Developers, DevOps
   - **Contenido:**
     - Configurar Vitest (unit tests)
     - Configurar ESLint + Prettier (code quality)
     - Configurar Playwright (E2E tests)
     - Setup GitHub Actions (CI/CD)
     - Security headers en Firebase
   - **Lectura:** 30 minutos
   - **Acción:** Ejecutar comandos y crear archivos de configuración

### 4. **TEST_TEMPLATES.md** 💻 EJEMPLOS LISTOS PARA COPIAR
   - **Para:** QA Engineers, Developers
   - **Contenido:**
     - Unit test templates (utilities, services, contexts)
     - Integration test templates (login flow, pet CRUD)
     - E2E test templates (smoke tests, security, mobile)
     - Firebase mock fixtures
   - **Lectura:** A demanda
   - **Acción:** Copiar, adaptar, ejecutar

---

## 🚨 ESTADO ACTUAL: CRÍTICO

| Métrica | Valor | Status |
|---------|-------|--------|
| Cobertura Testing | 2-5% | 🔴 CRÍTICO |
| Tests Unitarios | 1 archivo | 🔴 Insuficiente |
| Tests Integración | 0 | 🔴 Ninguno |
| Tests E2E | 0 | 🔴 Ninguno |
| CI/CD | No configurado | 🔴 No existe |
| Vulnerabilidades | 1 (dompurify) | 🟡 Fixeable |

**Riesgo Pre-Launch:** ⚠️ **INACEPTABLE SIN TESTS MÍNIMOS**

---

## ⏱️ TIMELINE RECOMENDADO

### Semana 1: Fundamentos (40h)
```
Lunes-Miércoles:
  ✅ Vitest + ESLint setup (6h)
  ✅ Unit tests: AuthContext, PetContext, LoginScreen (20h)
  ✅ Fix dompurify vulnerability (1h)

Jueves:
  ✅ Integration test: login→home (8h)
  ✅ GitHub Actions basic workflow (3h)

Viernes:
  ✅ Review + bugs fixes (2h)
```

### Semana 2: Validación (40h)
```
Lunes-Miércoles:
  ✅ Integration tests: document scan, analysis (12h)
  ✅ E2E smoke tests with Playwright (8h)
  ✅ Mobile responsive tests (4h)

Jueves:
  ✅ Cloud Functions for security headers (6h)
  ✅ Monitoring setup: Sentry + Analytics (4h)

Viernes:
  ✅ Final testing + go/no-go decision (6h)
```

**GO-LIVE:** End of Week 2 ✅

---

## 👥 RECURSOS REQUERIDOS

| Rol | Horas | Timeline |
|-----|-------|----------|
| QA Engineer (Lead) | 160 | 4 semanas full-time |
| QA Engineer (2) | 160 each | 4 semanas full-time |
| DevOps (CI/CD setup) | 16 | Part-time Week 1-2 |
| Developers (mocks/fixtures) | 24 | Part-time Week 1-3 |

**Total:** 360 horas, 4 personas, 4 semanas

---

## 🎯 QUICK START (Hoy)

```bash
# 1. Lee resumen ejecutivo (5 min)
cat QA_EXECUTIVE_SUMMARY.md

# 2. Luego sigue setup tools (30 min)
cat SETUP_TESTING_TOOLS.md

# 3. Comienza con primer test
cd src/app/contexts/__tests__
# Copiar AuthContext.test.ts de TEST_TEMPLATES.md
# Ejecutar: npm run test:watch
```

---

## 📚 CÓMO NAVEGAR ESTE PLAN

### Si eres **DIRECTOR / PRODUCT MANAGER**:
1. Lee: QA_EXECUTIVE_SUMMARY.md (5 min)
2. Decide: ¿Aprobamos 2 semanas de testing?
3. Action: Asigna 4 QA engineers full-time

### Si eres **QA ENGINEER**:
1. Lee: QA_EXECUTIVE_SUMMARY.md (5 min)
2. Lee: PLAN_QA_TESTING_2026.md (60 min)
3. Lee: SETUP_TESTING_TOOLS.md (30 min)
4. Comienza: TEST_TEMPLATES.md (as needed)
5. Action: Implementa tests en orden de prioridad

### Si eres **DEVELOPER**:
1. Lee: QA_EXECUTIVE_SUMMARY.md (5 min)
2. Lee: SETUP_TESTING_TOOLS.md (30 min)
3. Skipped: PLAN_QA_TESTING_2026.md (opcional, completo)
4. Action: Ejecuta comandos de setup, crea mocks/fixtures

### Si eres **DEVOPS / SRE**:
1. Lee: QA_EXECUTIVE_SUMMARY.md (5 min)
2. Sección: "SETUP_TESTING_TOOLS.md" → "5. GITHUB ACTIONS CI/CD"
3. Sección: "PLAN_QA_TESTING_2026.md" → "6. CI/CD PIPELINE"
4. Action: Crea workflows de GitHub Actions, configura Firebase deploy

---

## ✅ CHECKLIST PRE-LECTURA

Antes de empezar, asegúrate de tener:

- [ ] Acceso al codebase PESSY
- [ ] Node.js 20+ instalado
- [ ] Git configurado
- [ ] VSCode o IDE con TypeScript support
- [ ] Acceso a Firebase Console
- [ ] GitHub repo con permisos de admin (para CI/CD)

---

## 🔗 CONEXIONES ENTRE DOCUMENTOS

```
QA_EXECUTIVE_SUMMARY.md (Resumen 5min)
    ↓
    ├─→ Riesgos? Ver PLAN_QA_TESTING_2026.md → Security Audit
    ├─→ Cómo implementar? Ver SETUP_TESTING_TOOLS.md
    ├─→ Ejemplos de tests? Ver TEST_TEMPLATES.md
    └─→ Timeline? Ver PLAN_QA_TESTING_2026.md → Estimación

PLAN_QA_TESTING_2026.md (Plan completo 60min)
    ↓
    ├─→ Unit tests? Ver TEST_TEMPLATES.md → Unit Tests
    ├─→ Integration tests? Ver TEST_TEMPLATES.md → Integration Tests
    ├─→ E2E tests? Ver TEST_TEMPLATES.md → E2E Tests
    ├─→ Cómo configurar? Ver SETUP_TESTING_TOOLS.md
    └─→ CI/CD pipeline? Ver SETUP_TESTING_TOOLS.md → GitHub Actions

SETUP_TESTING_TOOLS.md (Configuración 30min)
    ↓
    ├─→ Vitest setup → Ejecutar, luego ver TEST_TEMPLATES.md
    ├─→ ESLint setup → Ejecutar, incluir en CI/CD
    ├─→ Playwright setup → Ver TEST_TEMPLATES.md E2E examples
    └─→ GitHub Actions → Conectar a Firebase deploy

TEST_TEMPLATES.md (Ejemplos on-demand)
    ↓
    ├─→ Necesitas unit test? Copiar de Unit Tests section
    ├─→ Necesitas integration test? Copiar de Integration Tests section
    ├─→ Necesitas E2E test? Copiar de E2E Tests section
    └─→ Necesitas mocks? Ver Fixtures & Helpers section
```

---

## 🛑 CRITICAL PATH (Mínimo para go-live)

En orden de importancia:

1. **AuthContext unit test** (16h)
   - Todos los sistemas dependen de esto
   - Sin auth = sin acceso a datos médicos

2. **LoginScreen integration test** (12h)
   - Usuarios no pueden entrar = nada funciona

3. **PetContext unit + integration tests** (20h)
   - Sin mascotas = sin app

4. **Document analysis mock + test** (12h)
   - Feature crítica: escaneo de documentos

5. **Firestore rules manual testing** (8h)
   - Evita data leakage en producción

6. **GitHub Actions CI** (8h)
   - Prevenir breaking changes

7. **Sentry + Firebase Analytics setup** (6h)
   - Monitorear errores en producción

8. **E2E smoke tests** (8h)
   - Validar flujos antes de launch

**Total Critical Path: 90 horas = 1.1 semanas (4 devs)**

---

## 📞 SOPORTE & ESCALACIÓN

### Estoy atascado en:

**Configuración (vitest, eslint, playwright)?**
→ Ver SETUP_TESTING_TOOLS.md

**¿Qué test escribir?**
→ Ver TEST_TEMPLATES.md (copiar ejemplo más cercano)

**¿Cuáles son los riesgos?**
→ Ver PLAN_QA_TESTING_2026.md → Security Audit

**¿Cuánto tiempo estimar?**
→ Ver PLAN_QA_TESTING_2026.md → Estimación de Esfuerzo

**¿Qué hacer primero?**
→ Ver PLAN_QA_TESTING_2026.md → Checklist Pre-Launch → Tier 1

**¿Cómo configurar CI/CD?**
→ Ver SETUP_TESTING_TOOLS.md → GitHub Actions

---

## 📈 MÉTRICAS DE ÉXITO

Después de implementar este plan, esperamos:

| Métrica | Actual | Target (4 semanas) |
|---------|--------|-------------------|
| Test Coverage | 2-5% | ≥ 70% |
| Unit Tests | 280 LOC | ≥ 2000 LOC |
| Integration Tests | 0 | ≥ 1000 LOC |
| E2E Tests | 0 | ≥ 500 LOC |
| Bug Escape Rate | ? | < 1 crítico/mes |
| Security Vulnerabilities | 1 | 0 |
| Performance Score | No medido | ≥ 80 (Lighthouse) |

---

## 🎓 LEARNING RESOURCES

Si no estás familiarizado con las herramientas:

- **Vitest:** https://vitest.dev/guide/
- **Testing Library:** https://testing-library.com/docs/react-testing-library/intro/
- **Playwright:** https://playwright.dev/docs/intro
- **Firebase Testing:** https://firebase.google.com/docs/rules/unit-tests
- **GitHub Actions:** https://docs.github.com/en/actions

---

## 🗂️ ARCHIVOS EN ESTE PLAN

```
PESSY_PRODUCCION/
├── QA_PLAN_README.md (este archivo)
├── QA_EXECUTIVE_SUMMARY.md (resumen 5 min)
├── PLAN_QA_TESTING_2026.md (plan completo 60 min)
├── SETUP_TESTING_TOOLS.md (configuración 30 min)
├── TEST_TEMPLATES.md (ejemplos on-demand)
└── (archivos de configuración por crear)
    ├── vitest.config.ts
    ├── .eslintrc.json
    ├── .prettierrc
    ├── playwright.config.ts
    ├── .github/workflows/test.yml
    └── .github/workflows/deploy.yml
```

---

## 🚀 COMIENZA AHORA

1. **Lee resumen (5 min):**
   ```bash
   cat QA_EXECUTIVE_SUMMARY.md
   ```

2. **Aprueba recursos con tu PM/CTO**

3. **Asigna team (4 QA engineers)**

4. **Comienza configuración (Week 1, Lunes):**
   ```bash
   cat SETUP_TESTING_TOOLS.md
   # Sigue los pasos paso a paso
   ```

5. **Escribe primer test (Week 1, Martes):**
   ```bash
   cat TEST_TEMPLATES.md
   # Copia AuthContext.test.ts
   # npm run test:watch
   ```

---

**Preparado por:** Equipo QA & Testing  
**Versión:** 1.0 | **Fecha:** Marzo 2026  
**Aprobación:** CTO/Product Manager

**¿Preguntas?** Ver sección "Soporte & Escalación" arriba.

**Ready to start?** → `cat QA_EXECUTIVE_SUMMARY.md` 🎯
