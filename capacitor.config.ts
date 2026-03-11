import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.pessy.mobile",
  appName: "Pessy",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
  plugins: {
    App: {
      launchUrl: "https://pessy.app/login",
    },
    SplashScreen: {
      launchAutoHide: true,
    },
  },
};

export default config;
