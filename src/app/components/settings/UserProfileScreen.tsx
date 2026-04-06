import { useState } from "react";
import { useNavigate } from "react-router";
import { MaterialIcon } from "../shared/MaterialIcon";
import { PersonalInfoScreen } from "./PersonalInfoScreen";
import { NotificationsScreen } from "./NotificationsScreen";
import { PrivacySecurityScreen } from "./PrivacySecurityScreen";
import { AppearanceScreen } from "./AppearanceScreen";
import { HelpSupportScreen } from "./HelpSupportScreen";
import { AboutScreen } from "./AboutScreen";
import { LogrosScreen } from "./LogrosScreen";
import { BrainDevTools } from "../admin/BrainDevTools";
import { CoTutorModal } from "../pet/CoTutorModal";
import { useAuth } from "../../contexts/AuthContext";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";
import { StorageUsageWidget } from "./StorageUsageWidget";
import { useGamification } from "../../contexts/GamificationContext";
import { PetPhoto } from "../pet/PetPhoto";
import { MascotPresence } from "../shared/MascotPresence";
import { LEVEL_THRESHOLDS } from "../../../domain/gamification/gamification.contract";

// Version injected at build time via Vite define
const APP_VERSION = (typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.0.0") as string;

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
  | "about"
  | "logros"
  | "gmail-sync";

export function UserProfileScreen({ onBack }: UserProfileScreenProps) {
  const [currentScreen, setCurrentScreen] = useState<SubScreen>("main");
  const [showCoTutorModal, setShowCoTutorModal] = useState(false);
  const { user, logout, userFullName, userName, userPhoto } = useAuth();
  const { pets, setActivePetId, activePet } = usePet();
  const { events } = useMedical();
  const { totalPoints, level } = useGamification();
  const navigate = useNavigate();

  const currentLevelFloor = LEVEL_THRESHOLDS[level] ?? 0;
  const nextLevelTarget = LEVEL_THRESHOLDS[level + 1] ?? currentLevelFloor;
  const pointsIntoLevel = Math.max(totalPoints - currentLevelFloor, 0);
  const pointsNeededForLevel = Math.max(nextLevelTarget - currentLevelFloor, 1);
  const progressPct =
    level >= LEVEL_THRESHOLDS.length - 1
      ? 100
      : Math.min(100, Math.round((pointsIntoLevel / pointsNeededForLevel) * 100));
  const pointsToNextLevel = Math.max(nextLevelTarget - totalPoints, 0);
  const safeGreetingName = userName || userFullName || user?.email?.split("@")[0] || "Tutor";

  // Datos del usuario desde AuthContext — una sola fuente de verdad
  const userData = {
    name: userFullName || user?.email?.split("@")[0] || "Usuario",
    email: user?.email || "",
    phone: user?.phoneNumber || "",
    photo: userPhoto || user?.photoURL || "",
    verified: user?.emailVerified || false,
    petsCount: pets.length,
    recordsCount: events.filter((e) => !e.deletedAt).length,
    daysActive: user?.metadata.creationTime
      ? Math.floor((Date.now() - new Date(user.metadata.creationTime).getTime()) / 86400000)
      : 0,
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Scale logut error:", error);
    }
  };

  const menuItems = [
    {
      icon: "group",
      title: "Co-tutores",
      subtitle: "Invitar o unirte a mascotas compartidas",
      onClick: () => setShowCoTutorModal(true),
    },
    {
      icon: "emoji_events",
      title: "Logros y puntos",
      subtitle: totalPoints > 0 ? `${totalPoints} pts · Nivel ${level}` : "Completá rutinas para ganar puntos",
      onClick: () => setCurrentScreen("logros"),
    },
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
      icon: "mail",
      title: "Conectar Gmail",
      subtitle: "Sincronizar emails veterinarios automáticamente",
      onClick: () => setCurrentScreen("gmail-sync"),
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
      title: "Acerca de Pessy",
      subtitle: `Versión ${APP_VERSION}`,
      onClick: () => setCurrentScreen("about"),
    },
  ];

  // Render sub-screens
  if (currentScreen === "logros") {
    return <LogrosScreen onBack={() => setCurrentScreen("main")} />;
  }
  if (currentScreen === "personal-info") {
    return <PersonalInfoScreen onBack={() => setCurrentScreen("main")} />;
  }
  if (currentScreen === "notifications") {
    return <NotificationsScreen onBack={() => setCurrentScreen("main")} />;
  }
  if (currentScreen === "gmail-sync") {
    return <PrivacySecurityScreen onBack={() => setCurrentScreen("main")} onLogout={handleLogout} autoOpenGmail />;
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
    <div className="bg-[#F0FAF9] dark:bg-[#101622] min-h-screen pb-24">
      <div className="max-w-md mx-auto">
        {/* Header with Back Button */}
        <div className="sticky top-0 z-50 bg-[#F0FAF9]/80 dark:bg-[#101622]/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={onBack}
            aria-label="Volver"
            className="size-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-[#074738] focus-visible:ring-offset-2"
          >
            <MaterialIcon name="arrow_back" className="text-xl" />
          </button>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            Mi Perfil
          </h1>
          <div className="size-10" /> {/* Spacer */}
        </div>

        {/* Profile Header */}
        <div
          className="px-6 pt-8 pb-6"
        >
          <div className="flex flex-col items-center">
            <div className="w-full bg-white/80 dark:bg-slate-900/80 rounded-[20px] border border-[#E5E7EB] dark:border-slate-800 px-4 py-3 mb-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-3">
                <MascotPresence species={activePet?.species as "dog" | "cat" | undefined} size={32} ambient />
                <div className="min-w-0">
                  <p className="text-base font-black text-slate-900 dark:text-white">
                    Hola, {safeGreetingName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tu mascota está en buenas manos
                  </p>
                </div>
              </div>
            </div>

            {/* Avatar */}
            {userData.photo ? (
              <div className="relative">
                <img
                  src={userData.photo}
                  alt={userData.name}
                  className="size-24 rounded-full object-cover border-4 border-white dark:border-slate-900 shadow-xl shadow-[#074738]/30 mb-4"
                />
                <button
                  onClick={() => setCurrentScreen("personal-info")}
                  className="absolute bottom-4 right-0 size-8 rounded-full bg-[#1A9B7D] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(26,155,125,0.3)] hover:bg-[#158a6e] transition-colors"
                >
                  <MaterialIcon name="edit" className="text-sm" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="size-24 rounded-full bg-gradient-to-br from-[#074738] to-[#1a9b7d] flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-[#074738]/30 mb-4">
                  <MaterialIcon name="person" className="text-5xl" />
                </div>
                <button
                  onClick={() => setCurrentScreen("personal-info")}
                  className="absolute bottom-4 right-0 size-8 rounded-full bg-[#1A9B7D] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(26,155,125,0.3)] hover:bg-[#158a6e] transition-colors"
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
            <div className="flex items-center gap-2 bg-[#074738]/10 text-[#074738] px-3 py-1.5 rounded-full mt-2">
              <MaterialIcon name={userData.verified ? "verified" : "warning"} className="text-base" />
              <span className="text-xs font-bold">
                {userData.verified ? "Cuenta verificada" : "Email no verificado"}
              </span>
            </div>
          </div>

          {/* Prominent level card */}
          {totalPoints > 0 && (
            <div className="mt-5 rounded-[20px] border border-amber-200/80 dark:border-amber-800/40 bg-[linear-gradient(135deg,#fff7db_0%,#fff0b8_100%)] dark:bg-amber-950/20 p-4 shadow-[0_4px_18px_rgba(180,132,0,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700/80 dark:text-amber-300">
                    Logro destacado
                  </p>
                  <h3 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                    Nivel {level}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {totalPoints} pts totales
                  </p>
                </div>
                <div className="size-12 rounded-2xl bg-white/80 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center shadow-sm">
                  <MaterialIcon name="military_tech" className="text-[24px] text-amber-500" />
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
                  <span>Progreso al próximo nivel</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-3 rounded-full bg-white/70 dark:bg-slate-800/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b_0%,#f97316_100%)] transition-[width] duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{currentLevelFloor} pts</span>
                  <span>
                    {level >= LEVEL_THRESHOLDS.length - 1
                      ? "Nivel máximo alcanzado"
                      : `Faltan ${pointsToNextLevel} pts para nivel ${level + 1}`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-white dark:bg-slate-900 rounded-[16px] p-3 text-center border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-slate-800">
              <p className="text-2xl font-black text-[#074738]">{userData.petsCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Mascotas</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-[16px] p-3 text-center border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-slate-800">
              <p className="text-2xl font-black text-[#074738]">{userData.recordsCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Registros</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-[16px] p-3 text-center border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-slate-800">
              <p className="text-2xl font-black text-[#074738]">{userData.daysActive}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Días</p>
            </div>
          </div>
        </div>

        {/* ── Mis Mascotas ─────────────────────────────────────────────── */}
        <div className="px-6 mb-4">
          <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-[#E5E7EB] dark:border-slate-800 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="h-1 bg-[#1A9B7D]" />
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="pets" className="text-[#1A9B7D] !text-lg" />
                  <p className="text-sm font-black text-slate-900 dark:text-white">Mis mascotas</p>
                </div>
                <button
                  onClick={() => navigate("/register-pet")}
                  className="flex items-center gap-1 text-xs font-bold text-[#1A9B7D] px-3 py-1.5 rounded-full bg-[#E0F2F1] hover:bg-[#c8ebe7] transition-colors"
                >
                  <MaterialIcon name="add" className="!text-sm" />
                  Agregar
                </button>
              </div>
              {pets.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No tenés mascotas registradas aún.</p>
              ) : (
                <div className="space-y-2">
                  {pets.map((pet) => (
                    <div key={pet.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <PetPhoto
                        src={pet.photo}
                        alt={pet.name}
                        className="size-10 rounded-full object-cover"
                        fallbackClassName="size-10"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{pet.name}</p>
                        <p className="text-xs text-slate-400 truncate">{pet.breed || pet.species || "Mascota"}</p>
                      </div>
                      <button
                        onClick={() => { setActivePetId(pet.id); onBack(); }}
                        className="text-xs font-bold text-[#1A9B7D] px-2 py-1 rounded-lg bg-[#E0F2F1] hover:bg-[#c8ebe7] transition-colors shrink-0"
                      >
                        Ver
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Storage Widget */}
        <div
          className="px-6 mb-1"
        >
          <StorageUsageWidget />
        </div>

        {/* Menu Items */}
        <div
          className="px-6 space-y-3"
        >
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full bg-white dark:bg-slate-900 rounded-[16px] p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-slate-800"
            >
              <div className="size-10 rounded-lg bg-[#074738]/10 text-[#074738] flex items-center justify-center shrink-0">
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
        </div>

        {/* Logout Button */}
        <div
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
        </div>

        {/* Brain Dev Tools — admin only */}
        <BrainDevTools />

        {/* Footer */}
        <div className="text-center px-6 mt-8 pb-8">
          <p className="text-xs text-slate-400">
            Pessy v{APP_VERSION} · © 2026 Todos los derechos reservados
          </p>
        </div>
      </div>

      <CoTutorModal
        isOpen={showCoTutorModal}
        onClose={() => setShowCoTutorModal(false)}
      />
    </div>
  );
}
