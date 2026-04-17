/**
 * routesV2.tsx — Route-based navigation replacing the viewMode pattern.
 *
 * Key changes from routes.tsx:
 * - AppLayout wraps all authenticated routes (auth guard, nav, modals)
 * - Each "viewMode" is now a real route with its own URL
 * - Deep linking and back button work correctly
 * - Old URLs redirect to new routes for backward compatibility
 *
 * Route structure:
 *   /inicio          → Home (PetHomeView / FocusedHomeExperience)
 *   /historial       → Medical Timeline + ActionTray
 *   /turnos          → Appointments
 *   /tratamientos    → Medications / Treatments
 *   /comunidad       → Lost Pets Feed (+ future Adoption)
 *   /comunidad/reportar → Report Lost Pet
 *   /explorar        → Nearby Places (unified RecommendationFeed)
 *   /perfil          → User Profile / Settings
 */
import type { ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { RegisterUserScreen } from "./components/auth/RegisterUserScreen";
import { RegisterPetStep1 } from "./components/pet/RegisterPetStep1";
import { RegisterPetStep2 } from "./components/pet/RegisterPetStep2";
import { LoginScreen } from "./components/auth/LoginScreen";
import { ForgotPasswordScreen } from "./components/auth/ForgotPasswordScreen";
import { VerifyReportScreen } from "./components/medical/VerifyReportScreen";
import { EmailLinkSignInScreen } from "./components/auth/EmailLinkSignInScreen";
import { RouteErrorFallback } from "./components/shared/RouteErrorFallback";
import { ClinicalReviewScreen } from "./components/medical/ClinicalReviewScreen";
import LandingEcosystemPreviewPage from "./pages/LandingEcosystemPreviewPage";
import LandingSocialPage from "./pages/LandingSocialPage";
import EmpezarLandingPage from "./pages/EmpezarLandingPage";
import LegalPage from "./pages/LegalPage";
import { RequestAccessScreen } from "./components/auth/RequestAccessScreen";
import { isProductionAppHost, isNativeAppContext } from "./utils/runtimeFlags";
import { VetLoginScreen } from "./components/vet/VetLoginScreen";
import { VetRegisterScreen } from "./components/vet/VetRegisterScreen";
import VetDashboard from "./components/vet/VetDashboard";
import { VetNewConsultation } from "./components/vet/VetNewConsultation";

// Lazy imports for code-split routes
const AppLayout = () => import("./components/layout/AppLayout").then(m => ({ Component: m.default }));
const HomeScreenSimplified = () => import("./components/home/HomeScreenSimplified").then(m => ({ Component: m.default }));
const AdminAccessRequests = () => import("./components/auth/AdminAccessRequests").then(m => ({ Component: m.AdminAccessRequests }));

// Route wrappers — each is a thin adapter around the existing screen component
const lazyRouteWrapper = (name: string) => () =>
  import("./components/routes/RouteWrappers").then(m => ({ Component: (m as Record<string, React.ComponentType>)[name] }));

const withErrorBoundary = <T extends Record<string, unknown>>(route: T): T => ({
  ...route,
  errorElement: <RouteErrorFallback />,
});

function PreviewOnlyRoute({ children }: { children: ReactNode }) {
  return isProductionAppHost() ? <Navigate to="/" replace /> : <>{children}</>;
}

const previewRoutesEnabled =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_PREVIEW_ROUTES === "true";

const previewRoutes = previewRoutesEnabled
  ? [
      withErrorBoundary({
        path: "/preview/landing-ecosistema",
        element: (
          <PreviewOnlyRoute>
            <LandingEcosystemPreviewPage />
          </PreviewOnlyRoute>
        ),
      }),
      withErrorBoundary({
        path: "/preview/wellbeing",
        lazy: async () => {
          const module = await import("./pages/WellbeingProductPreviewPage");
          const Page = module.default;
          return {
            Component: function PreviewWellbeingRoute() {
              return (
                <PreviewOnlyRoute>
                  <Page />
                </PreviewOnlyRoute>
              );
            },
          };
        },
      }),
      withErrorBoundary({
        path: "/preview/wellbeing-master",
        lazy: async () => {
          const module = await import("./pages/WellbeingMasterBookPreviewPage");
          const Page = module.default;
          return {
            Component: function PreviewWellbeingMasterRoute() {
              return (
                <PreviewOnlyRoute>
                  <Page />
                </PreviewOnlyRoute>
              );
            },
          };
        },
      }),
      withErrorBoundary({
        path: "/preview/vaccination-card",
        lazy: async () => {
          const module = await import("./pages/VaccinationCardPreviewPage");
          const Page = module.default;
          return {
            Component: function PreviewVaccinationCardRoute() {
              return (
                <PreviewOnlyRoute>
                  <Page />
                </PreviewOnlyRoute>
              );
            },
          };
        },
      }),
    ]
  : [];

function RootRoute() {
  const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  if (isNativeAppContext()) return <Navigate to="/inicio" replace />;
  if (host === "app.pessy.app") return <Navigate to="/inicio" replace />;
  if (host === "localhost" || host === "127.0.0.1") return <Navigate to="/inicio" replace />;
  return <LandingEcosystemPreviewPage />;
}

function CatchAllRedirect() {
  if (isNativeAppContext()) return <Navigate to="/login" replace />;
  const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  if (host === "localhost" || host === "127.0.0.1") return <Navigate to="/login" replace />;
  return <Navigate to="/" replace />;
}

export const router = createBrowserRouter([
  // ── Public routes ──
  withErrorBoundary({ path: "/", Component: RootRoute }),
  withErrorBoundary({ path: "/welcome", element: <Navigate to="/login" replace /> }),
  withErrorBoundary({ path: "/onboarding", element: <Navigate to="/login" replace /> }),
  withErrorBoundary({ path: "/register", element: <Navigate to="/register-user" replace /> }),
  withErrorBoundary({ path: "/register-user", Component: RegisterUserScreen }),
  withErrorBoundary({ path: "/register-pet", Component: RegisterPetStep1 }),
  withErrorBoundary({ path: "/register-pet-step1", element: <Navigate to="/register-pet" replace /> }),
  withErrorBoundary({ path: "/register-pet/step2", Component: RegisterPetStep2 }),
  withErrorBoundary({ path: "/register-pet-step2", element: <Navigate to="/register-pet/step2" replace /> }),
  withErrorBoundary({ path: "/login", Component: LoginScreen }),
  withErrorBoundary({ path: "/forgot-password", Component: ForgotPasswordScreen }),
  withErrorBoundary({ path: "/solicitar-acceso", Component: RequestAccessScreen }),
  withErrorBoundary({ path: "/admin/access-requests", lazy: AdminAccessRequests }),
  withErrorBoundary({
    path: "/empezar",
    Component: isNativeAppContext() ? () => <Navigate to="/inicio" replace /> : EmpezarLandingPage,
  }),
  withErrorBoundary({ path: "/privacidad", Component: LegalPage }),
  withErrorBoundary({ path: "/terminos", Component: LegalPage }),
  withErrorBoundary({ path: "/legal", Component: LegalPage }),
  withErrorBoundary({ path: "/email-link", Component: EmailLinkSignInScreen }),
  withErrorBoundary({ path: "/verify/:hash", Component: VerifyReportScreen }),
  withErrorBoundary({ path: "/review/:reviewId", Component: ClinicalReviewScreen }),

  // ── Vet portal ──
  withErrorBoundary({ path: "/vet", element: <Navigate to="/vet/login" replace /> }),
  withErrorBoundary({ path: "/vet/login", Component: VetLoginScreen }),
  withErrorBoundary({ path: "/vet/register", Component: VetRegisterScreen }),
  withErrorBoundary({ path: "/vet/dashboard", Component: VetDashboard }),
  withErrorBoundary({ path: "/vet/new-consultation", Component: VetNewConsultation }),

  // ── App routes (wrapped in AppLayout with auth guard + bottom nav) ──
  // Each route gets its own path; AppLayout handles auth, nav, modals.
  withErrorBoundary({ path: "/inicio", lazy: AppLayout, children: [{ index: true, lazy: HomeScreenSimplified }] }),
  withErrorBoundary({ path: "/home", lazy: AppLayout, children: [{ index: true, lazy: HomeScreenSimplified }] }),
  withErrorBoundary({ path: "/historial", lazy: AppLayout, children: [{ index: true, lazy: lazyRouteWrapper("HistorialRoute") }] }),
  withErrorBoundary({ path: "/turnos", lazy: AppLayout, children: [{ index: true, lazy: lazyRouteWrapper("TurnosRoute") }] }),
  withErrorBoundary({ path: "/tratamientos", lazy: AppLayout, children: [{ index: true, lazy: lazyRouteWrapper("TratamientosRoute") }] }),
  withErrorBoundary({ path: "/comunidad", lazy: AppLayout, children: [
    { index: true, lazy: lazyRouteWrapper("ComunidadRoute") },
    { path: "reportar", lazy: lazyRouteWrapper("ReportarPerdidoRoute") },
  ]}),
  withErrorBoundary({ path: "/explorar", lazy: AppLayout, children: [{ index: true, lazy: lazyRouteWrapper("ExplorarRoute") }] }),
  withErrorBoundary({ path: "/perfil", lazy: AppLayout, children: [{ index: true, lazy: lazyRouteWrapper("PerfilRoute") }] }),

  // ── Ecosistema Digital — nuevas rutas (Lovable handoff) ──
  // TODO: reemplazar placeholder con componente real cuando Lovable entregue
  withErrorBoundary({ path: "/identidad", lazy: AppLayout, children: [{ index: true, lazy: lazyRouteWrapper("IdentidadRoute") }] }),
  withErrorBoundary({ path: "/rutinas-eco", lazy: AppLayout, children: [{ index: true, lazy: lazyRouteWrapper("RutinasEcoRoute") }] }),
  withErrorBoundary({ path: "/cuidados", lazy: AppLayout, children: [{ index: true, lazy: lazyRouteWrapper("CuidadosRoute") }] }),
  withErrorBoundary({ path: "/buscar-vet", lazy: AppLayout, children: [{ index: true, lazy: lazyRouteWrapper("BuscarVetRoute") }] }),
  withErrorBoundary({ path: "/tienda", lazy: AppLayout, children: [{ index: true, lazy: lazyRouteWrapper("TiendaRoute") }] }),

  // ── Backward compatibility redirects ──
  withErrorBoundary({ path: "/app", element: <Navigate to="/inicio" replace /> }),
  withErrorBoundary({ path: "/inicio/vacunas", element: <Navigate to="/historial" replace /> }),
  withErrorBoundary({ path: "/inicio/medicacion", element: <Navigate to="/tratamientos" replace /> }),
  withErrorBoundary({ path: "/inicio/historial-medico", element: <Navigate to="/historial" replace /> }),
  withErrorBoundary({ path: "/soluciones/vacunas", element: <Navigate to="/historial" replace /> }),
  withErrorBoundary({ path: "/soluciones/medicacion", element: <Navigate to="/tratamientos" replace /> }),
  withErrorBoundary({ path: "/soluciones/historial", element: <Navigate to="/historial" replace /> }),

  // ── Preview routes ──
  ...previewRoutes,

  // ── Catch-all ──
  withErrorBoundary({ path: "*", element: <CatchAllRedirect /> }),
]);
