import { createBrowserRouter, Navigate } from "react-router";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { RegisterUserScreen } from "./components/RegisterUserScreen";
import { RegisterPetStep1 } from "./components/RegisterPetStep1";
import { RegisterPetStep2 } from "./components/RegisterPetStep2";
import { LoginScreen } from "./components/LoginScreen";
import { RegisterPetScreen } from "./components/RegisterPetScreen";
import HomeScreen from "./components/HomeScreen";
import { VerifyReportScreen } from "./components/VerifyReportScreen";

export const router = createBrowserRouter([
  { path: "/", Component: WelcomeScreen },
  { path: "/welcome", Component: WelcomeScreen },
  { path: "/onboarding", element: <Navigate to="/welcome" replace /> },
  { path: "/register", element: <Navigate to="/register-user" replace /> },
  { path: "/register-user", Component: RegisterUserScreen },
  { path: "/register-pet", Component: RegisterPetStep1 },
  { path: "/register-pet/step2", Component: RegisterPetStep2 },
  { path: "/login", Component: LoginScreen },
  { path: "/register-pet-old", Component: RegisterPetScreen },
  { path: "/home", Component: HomeScreen },
  { path: "/verify/:hash", Component: VerifyReportScreen },
  { path: "*", element: <Navigate to="/" replace /> },
]);
