import { createBrowserRouter } from "react-router";
import { SplashScreen } from "./components/SplashScreen";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { OnboardingWelcomeScreen } from "./components/OnboardingWelcomeScreen";
import { RegisterUserScreen } from "./components/RegisterUserScreen";
import { RegisterPetStep1 } from "./components/RegisterPetStep1";
import { RegisterPetStep2 } from "./components/RegisterPetStep2";
import { LoginScreen } from "./components/LoginScreen";
import { RegisterPetScreen } from "./components/RegisterPetScreen";
import HomeScreen from "./components/HomeScreen";
import { VerifyReportScreen } from "./components/VerifyReportScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: SplashScreen,
  },
  {
    path: "/welcome",
    Component: WelcomeScreen,
  },
  {
    path: "/onboarding",
    Component: OnboardingWelcomeScreen,
  },
  {
    path: "/register-user",
    Component: RegisterUserScreen,
  },
  {
    path: "/register-pet",
    Component: RegisterPetStep1,
  },
  {
    path: "/register-pet/step2",
    Component: RegisterPetStep2,
  },
  {
    path: "/login",
    Component: LoginScreen,
  },
  {
    path: "/register-pet-old",
    Component: RegisterPetScreen,
  },
  {
    path: "/home",
    Component: HomeScreen,
  },
  {
    path: "/verify/:hash",
    Component: VerifyReportScreen,
  },
]);