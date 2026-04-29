# LOGIN PROTECTED — NO TOCAR

## GUARDRAIL PARA AGENTES AI

Los siguientes archivos están **PROTEGIDOS** y **NO deben ser modificados** por ningún agente AI
a menos que el usuario (Mauri) lo pida **explícitamente** con una instrucción directa tipo
"modificá el login" o "cambiá LoginScreen":

### Archivos protegidos:
- `LoginScreen.tsx` — Pantalla de login (email/password + Google)
- `AuthContext.tsx` — Contexto de autenticación (Firebase Auth + Firestore profile)
- `AuthPageShell.tsx` — Shell visual compartido entre login y registro
- `authActionLinks.ts` — URLs de acción para reset de password

### Rutas protegidas en `routes.tsx`:
- `/login` → LoginScreen
- `/welcome` → redirect a /login
- `/onboarding` → redirect a /login

## Por qué existe este guardrail

El login fue roto múltiples veces por agentes AI que, al recibir tareas de seguridad,
performance o features nuevas, tocaron el login "de paso" sin que se les pidiera.
Cada vez costó mucho recuperar el flujo correcto.

## Reglas

1. **Si la tarea NO menciona explícitamente "login", "LoginScreen", "autenticación" o "auth flow", NO toques estos archivos.**
2. **Si creés que hay un bug de seguridad en el login, REPORTALO al usuario — no lo arregles solo.**
3. **Si necesitás cambiar rutas en `routes.tsx`, NO modifiques las rutas de login/welcome/onboarding.**
4. **Los aria-labels y mejoras de a11y en estos archivos están OK y ya fueron aplicados.**
5. **`fetchSignInMethodsForEmail` se usa intencionalmente para dar error específico a usuarios Google. NO remover.**
6. **El `navigate("/home")` explícito después de Google sign-in es INTENCIONAL. NO depender solo del useEffect.**
7. **El `console.error` en Google auth es INTENCIONAL para diagnóstico. NO remover.**

## Historial de incidentes
- **2026-03-23**: Claude Opus 4.6 (commit 57c07ef) removió fetchSignInMethodsForEmail,
  navigate explícito post-Google, y console.error de diagnóstico como parte de un "fix de seguridad"
  que nadie pidió. Rompió el login. Revertido manualmente.
