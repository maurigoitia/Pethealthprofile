import { createBrowserRouter, Navigate } from "react-router";
import { RegisterUserScreen } from "./components/RegisterUserScreen";
import { RegisterPetStep1 } from "./components/RegisterPetStep1";
import { RegisterPetStep2 } from "./components/RegisterPetStep2";
import { LoginScreen } from "./components/LoginScreen";
import HomeScreen from "./components/HomeScreen";
import { VerifyReportScreen } from "./components/VerifyReportScreen";
import { EmailLinkSignInScreen } from "./components/EmailLinkSignInScreen";
import { RouteErrorFallback } from "./components/RouteErrorFallback";
import { ClinicalReviewScreen } from "./components/ClinicalReviewScreen";
import LandingPage from "./pages/LandingPage";
import LandingUnite from "./pages/LandingUnite";
import LegalPage from "./pages/LegalPage";

const withErrorBoundary = <T extends Record<string, unknown>>(route: T): T => ({
  ...route,
  errorElement: <RouteErrorFallback />,
});

export const router = createBrowserRouter([
  withErrorBoundary({ path: "/", element: <Navigate to="/inicio" replace /> }),
  withErrorBoundary({ path: "/welcome", element: <Navigate to="/" replace /> }),
  withErrorBoundary({ path: "/onboarding", element: <Navigate to="/" replace /> }),
  withErrorBoundary({ path: "/register", element: <Navigate to="/register-user" replace /> }),
  withErrorBoundary({ path: "/register-user", Component: RegisterUserScreen }),
  withErrorBoundary({ path: "/register-pet", Component: RegisterPetStep1 }),
  withErrorBoundary({ path: "/register-pet-step1", element: <Navigate to="/register-pet" replace /> }),
  withErrorBoundary({ path: "/register-pet/step2", Component: RegisterPetStep2 }),
  withErrorBoundary({ path: "/register-pet-step2", element: <Navigate to="/register-pet/step2" replace /> }),
  withErrorBoundary({ path: "/login", Component: LoginScreen }),
  withErrorBoundary({ path: "/app", element: <Navigate to="/login" replace /> }),
  withErrorBoundary({ path: "/inicio", Component: LandingPage }),
  withErrorBoundary({ path: "/empezar", Component: LandingUnite }),
  withErrorBoundary({ path: "/inicio/vacunas", element: <Navigate to="/" replace /> }),
  withErrorBoundary({ path: "/inicio/medicacion", element: <Navigate to="/" replace /> }),
  withErrorBoundary({ path: "/inicio/historial-medico", element: <Navigate to="/" replace /> }),
  withErrorBoundary({ path: "/privacidad", Component: LegalPage }),
  withErrorBoundary({ path: "/terminos", Component: LegalPage }),
  withErrorBoundary({ path: "/legal", Component: LegalPage }),
  withErrorBoundary({ path: "/soluciones/vacunas", element: <Navigate to="/" replace /> }),
  withErrorBoundary({ path: "/soluciones/medicacion", element: <Navigate to="/" replace /> }),
  withErrorBoundary({ path: "/soluciones/historial", element: <Navigate to="/" replace /> }),
  withErrorBoundary({ path: "/register-pet-old", element: <Navigate to="/register-pet" replace /> }),
  withErrorBoundary({ path: "/home", Component: HomeScreen }),
  withErrorBoundary({ path: "/review/:reviewId", Component: ClinicalReviewScreen }),
  withErrorBoundary({ path: "/email-link", Component: EmailLinkSignInScreen }),
  withErrorBoundary({ path: "/verify/:hash", Component: VerifyReportScreen }),
  withErrorBoundary({ path: "*", element: <Navigate to="/" replace /> }),
]);
