import type { ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { RegisterUserScreen } from "./components/auth/RegisterUserScreen";
import { RegisterPetStep1 } from "./components/pet/RegisterPetStep1";
import { RegisterPetStep2 } from "./components/pet/RegisterPetStep2";
import { LoginScreen } from "./components/auth/LoginScreen";
import { ForgotPasswordScreen } from "./components/auth/ForgotPasswordScreen";
import HomeScreen from "./components/home/HomeScreen";
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

const AdminAccessRequests = () => import("./components/auth/AdminAccessRequests").then(m => ({ Component: m.AdminAccessRequests }));

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
  // Inside Flutter WebView or standalone PWA → go straight to app
  if (isNativeAppContext()) {
    return <Navigate to="/inicio" replace />;
  }
  // app.pessy.app subdomain → app
  if (host === "app.pessy.app") {
    return <Navigate to="/inicio" replace />;
  }
  // localhost in dev → go to app (not landing)
  if (host === "localhost" || host === "127.0.0.1") {
    return <Navigate to="/inicio" replace />;
  }
  // pessy.app website → show landing
  return <LandingEcosystemPreviewPage />;
}

/** Catch-all: native app context → /login, website → / (landing) */
function CatchAllRedirect() {
  if (isNativeAppContext()) return <Navigate to="/login" replace />;
  const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  if (host === "localhost" || host === "127.0.0.1") return <Navigate to="/login" replace />;
  return <Navigate to="/" replace />;
}

export const router = createBrowserRouter([
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
  withErrorBoundary({ path: "/app", element: <Navigate to="/inicio" replace /> }),
  withErrorBoundary({ path: "/inicio", Component: HomeScreen }),
  withErrorBoundary({
    path: "/empezar",
    Component: isNativeAppContext() ? () => <Navigate to="/inicio" replace /> : EmpezarLandingPage,
  }),
  withErrorBoundary({ path: "/inicio/vacunas", element: <Navigate to="/inicio" replace /> }),
  withErrorBoundary({ path: "/inicio/medicacion", element: <Navigate to="/inicio" replace /> }),
  withErrorBoundary({ path: "/inicio/historial-medico", element: <Navigate to="/inicio" replace /> }),
  withErrorBoundary({ path: "/privacidad", Component: LegalPage }),
  withErrorBoundary({ path: "/terminos", Component: LegalPage }),
  withErrorBoundary({ path: "/legal", Component: LegalPage }),
  withErrorBoundary({ path: "/soluciones/vacunas", element: <Navigate to="/inicio" replace /> }),
  withErrorBoundary({ path: "/soluciones/medicacion", element: <Navigate to="/inicio" replace /> }),
  withErrorBoundary({ path: "/soluciones/historial", element: <Navigate to="/inicio" replace /> }),
  withErrorBoundary({ path: "/home", Component: HomeScreen }),
  withErrorBoundary({ path: "/review/:reviewId", Component: ClinicalReviewScreen }),
  ...previewRoutes,
  withErrorBoundary({ path: "/email-link", Component: EmailLinkSignInScreen }),
  withErrorBoundary({ path: "/verify/:hash", Component: VerifyReportScreen }),
  withErrorBoundary({ path: "/vet", element: <Navigate to="/vet/login" replace /> }),
  withErrorBoundary({ path: "/vet/login", Component: VetLoginScreen }),
  withErrorBoundary({ path: "/vet/register", Component: VetRegisterScreen }),
  withErrorBoundary({ path: "/vet/dashboard", Component: VetDashboard }),
  withErrorBoundary({ path: "/vet/new-consultation", Component: VetNewConsultation }),
  withErrorBoundary({ path: "*", element: <CatchAllRedirect /> }),
]);
