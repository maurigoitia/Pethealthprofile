import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";
import { PersonalInfoScreen } from "./PersonalInfoScreen";
import { NotificationsScreen } from "./NotificationsScreen";
import { PrivacySecurityScreen } from "./PrivacySecurityScreen";
import { AppearanceScreen } from "./AppearanceScreen";
import { HelpSupportScreen } from "./HelpSupportScreen";
import { AboutScreen } from "./AboutScreen";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../contexts/PetContext";
import { useMedical } from "../contexts/MedicalContext";

interface UserProfileScreenProps {
  onBack: () => void;
}

type SubScreen =
  | "main"
  | "personal-info"
  | "notifications"
  | "privacy"
  | "appearance"
  | "help"
  | "about";

export function UserProfileScreen({ onBack }: UserProfileScreenProps) {
  const [currentScreen, setCurrentScreen] = useState<SubScreen>("main");
  const { user, logout } = useAuth();
  const { pets } = usePet();
  const { events } = useMedical();
  const navigate = useNavigate();

  // Real user data from context
  const userData = {
    name: user?.displayName || user?.email?.split('@')[0] || "Usuario",
    email: user?.email || "",
    phone: user?.phoneNumber || "",
    photo: user?.photoURL || "",
    verified: user?.emailVerified || false,
    petsCount: pets.length,
    recordsCount: events.length,
    daysActive: user?.metadata.creationTime ?
      Math.floor((new Date().getTime() - new Date(user.metadata.creationTime).getTime()) / (1000 * 60 * 60 * 24)) : 0,
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/welcome");
    } catch (error) {
      console.error("Scale logut error:", error);
    }
  };

  const menuItems = [
    {
      icon: "person",
      title: "Información personal",
      subtitle: "Editar nombre, email y teléfono",
      onClick: () => setCurrentScreen("personal-info"),
    },
    {
      icon: "notifications",
      title: "Notificaciones",
      subtitle: "Gestionar alertas y recordatorios",
      onClick: () => setCurrentScreen("notifications"),
    },
    {
      icon: "lock",
      title: "Privacidad y seguridad",
      subtitle: "Contraseña y configuración de datos",
      onClick: () => setCurrentScreen("privacy"),
    },
    {
      icon: "dark_mode",
      title: "Apariencia",
      subtitle: "Tema claro/oscuro",
      onClick: () => setCurrentScreen("appearance"),
    },
    {
      icon: "help",
      title: "Ayuda y soporte",
      subtitle: "Preguntas frecuentes y contacto",
      onClick: () => setCurrentScreen("help"),
    },
    {
      icon: "info",
      title: "Acerca de PESSY",
      subtitle: "Versión 1.0.0",
      onClick: () => setCurrentScreen("about"),
    },
  ];

  // Render sub-screens
  if (currentScreen === "personal-info") {
    return <PersonalInfoScreen onBack={() => setCurrentScreen("main")} />;
  }
  if (currentScreen === "notifications") {
    return <NotificationsScreen onBack={() => setCurrentScreen("main")} />;
  }
  if (currentScreen === "privacy") {
    return <PrivacySecurityScreen onBack={() => setCurrentScreen("main")} onLogout={handleLogout} />;
  }
  if (currentScreen === "appearance") {
    return <AppearanceScreen onBack={() => setCurrentScreen("main")} />;
  }
  if (currentScreen === "help") {
    return <HelpSupportScreen onBack={() => setCurrentScreen("main")} />;
  }
  if (currentScreen === "about") {
    return <AboutScreen onBack={() => setCurrentScreen("main")} />;
  }

  // Main profile screen
  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen pb-24">
      <div className="max-w-md mx-auto">
        {/* Header with Back Button */}
        <div className="sticky top-0 z-50 bg-[#f6f6f8]/80 dark:bg-[#101622]/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={onBack}
            className="size-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <MaterialIcon name="arrow_back" className="text-xl" />
          </button>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            Mi Perfil
          </h1>
          <div className="size-10" /> {/* Spacer */}
        </div>

        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="px-6 pt-8 pb-6"
        >
          <div className="flex flex-col items-center">
            {/* Avatar */}
            {userData.photo ? (
              <div className="relative">
                <img
                  src={userData.photo}
                  alt={userData.name}
                  className="size-24 rounded-full object-cover border-4 border-white dark:border-slate-900 shadow-xl shadow-[#2b7cee]/30 mb-4"
                />
                <button
                  onClick={() => setCurrentScreen("personal-info")}
                  className="absolute bottom-4 right-0 size-8 rounded-full bg-[#2b7cee] text-white flex items-center justify-center shadow-lg hover:bg-[#5a8aff] transition-colors"
                >
                  <MaterialIcon name="edit" className="text-sm" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="size-24 rounded-full bg-gradient-to-br from-[#2b7cee] to-[#5a8aff] flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-[#2b7cee]/30 mb-4">
                  <MaterialIcon name="person" className="text-5xl" />
                </div>
                <button
                  onClick={() => setCurrentScreen("personal-info")}
                  className="absolute bottom-4 right-0 size-8 rounded-full bg-[#2b7cee] text-white flex items-center justify-center shadow-lg hover:bg-[#5a8aff] transition-colors"
                >
                  <MaterialIcon name="add_a_photo" className="text-sm" />
                </button>
              </div>
            )}

            {/* User Info */}
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
              {userData.name}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              {userData.email}
            </p>
            <div className="flex items-center gap-2 bg-[#2b7cee]/10 text-[#2b7cee] px-3 py-1.5 rounded-full mt-2">
              <MaterialIcon name="verified" className="text-base" />
              <span className="text-xs font-bold">Cuenta Verificada</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-3 text-center border border-slate-200 dark:border-slate-800">
              <p className="text-2xl font-black text-[#2b7cee]">{userData.petsCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                Mascotas
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-3 text-center border border-slate-200 dark:border-slate-800">
              <p className="text-2xl font-black text-[#2b7cee]">{userData.recordsCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                Registros
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-3 text-center border border-slate-200 dark:border-slate-800">
              <p className="text-2xl font-black text-[#2b7cee]">{userData.daysActive}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                Días
              </p>
            </div>
          </div>
        </motion.div>

        {/* Menu Items */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="px-6 space-y-3"
        >
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full bg-white dark:bg-slate-900 rounded-xl p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800"
            >
              <div className="size-10 rounded-lg bg-[#2b7cee]/10 text-[#2b7cee] flex items-center justify-center shrink-0">
                <MaterialIcon name={item.icon} className="text-xl" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-sm text-slate-900 dark:text-white">
                  {item.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {item.subtitle}
                </p>
              </div>
              <MaterialIcon
                name="chevron_right"
                className="text-slate-400 text-xl"
              />
            </button>
          ))}
        </motion.div>

        {/* Logout Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="px-6 mt-6"
        >
          <button
            onClick={handleLogout}
            className="w-full bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl p-4 flex items-center justify-center gap-3 hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
          >
            <MaterialIcon name="logout" className="text-red-600 dark:text-red-400 text-xl" />
            <span className="font-bold text-red-600 dark:text-red-400">
              Cerrar sesión
            </span>
          </button>
        </motion.div>

        {/* Footer */}
        <div className="text-center px-6 mt-8 pb-8">
          <p className="text-xs text-slate-400">
            PESSY v1.0.0 • © 2026 Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  );
}