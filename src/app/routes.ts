import { createBrowserRouter } from "react-router";
import { SplashScreen } from "./components/SplashScreen";
import { WelcomeScreen } from "./components/WelcomeScreen";
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
    path: "/login",
    Component: LoginScreen,
  },
  {
    path: "/register-pet",
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