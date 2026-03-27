import { motion, AnimatePresence } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";

interface SidebarPet {
  id: string;
  name: string;
  photo?: string;
  breed?: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail?: string;
  pets: SidebarPet[];
  activePetId: string;
  onPetChange: (petId: string) => void;
  onAddPet: () => void;
  onNavigate: (screen: "home" | "appointments" | "medications" | "feed" | "settings" | "nearby-vets") => void;
  onInviteFriends: () => void;
  onLogout: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  userName,
  userEmail,
  pets,
  activePetId,
  onPetChange,
  onAddPet,
  onInviteFriends,
  onNavigate,
  onLogout,
}: SidebarProps) {
  const navItems = [
    { icon: "dashboard", label: "Inicio", screen: "home" as const },
    { icon: "calendar_month", label: "Turnos", screen: "appointments" as const },
    { icon: "medication", label: "Seguimientos", screen: "medications" as const },
    { icon: "history", label: "Actividad", screen: "feed" as const },
    { icon: "location_on", label: "Veterinarias", screen: "nearby-vets" as const },
  ];

  const bottomItems = [
    { icon: "person", label: "Cuenta", screen: "settings" as const },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onClose}
          />

          {/* Sidebar Panel */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 z-50 flex w-72 flex-col bg-[#0f1923] text-white"
          >
            {/* Logo */}
            <div className="px-5 pt-6 pb-4">
              <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <span className="text-[#1A9B7D]">P</span>ESSY
              </h1>
            </div>

            {/* Your Pets */}
            <div className="px-5 pb-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#6B7280]" style={{ fontFamily: "'Manrope', sans-serif" }}>Tus mascotas</p>
              <div className="flex items-center gap-3">
                {pets.map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => {
                      onPetChange(pet.id);
                      onClose();
                    }}
                    className="group flex flex-col items-center gap-1"
                  >
                    <div
                      className={`size-12 overflow-hidden rounded-full border-2 transition-all ${
                        pet.id === activePetId
                          ? "border-[#1A9B7D] shadow-lg shadow-[#1A9B7D]/30"
                          : "border-slate-600 opacity-60 hover:opacity-100"
                      }`}
                    >
                      {pet.photo ? (
                        <img src={pet.photo} alt={pet.name} className="size-full object-cover" />
                      ) : (
                        <div className="size-full flex items-center justify-center bg-slate-700">
                          <MaterialIcon name="pets" className="text-xl text-slate-400" />
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold ${pet.id === activePetId ? "text-emerald-400" : "text-slate-400"}`}>
                      {pet.name}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    onAddPet();
                    onClose();
                  }}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="flex size-12 items-center justify-center rounded-full border-2 border-dashed border-slate-600 hover:border-emerald-400 transition-colors">
                    <MaterialIcon name="add" className="text-xl text-slate-400" />
                  </div>
                  <span className="text-[10px] text-slate-500">nueva</span>
                </button>
              </div>
            </div>

            <div className="mx-5 border-t border-slate-700/50" />

            {/* Main Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.screen}
                  onClick={() => {
                    onNavigate(item.screen);
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  <MaterialIcon name={item.icon} className="text-xl" />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="mx-5 border-t border-slate-700/50" />

            {/* Invite Friends */}
            <div className="px-3 py-1">
              <button
                onClick={() => {
                  onInviteFriends();
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-semibold text-[#1A9B7D] transition-colors hover:bg-white/10"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                <MaterialIcon name="person_add" className="text-xl" />
                Invitar amigos
              </button>
            </div>

            {/* Bottom Nav */}
            <div className="px-3 py-3 space-y-1">
              {bottomItems.map((item) => (
                <button
                  key={item.screen}
                  onClick={() => {
                    onNavigate(item.screen);
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  <MaterialIcon name={item.icon} className="text-xl" />
                  {item.label}
                </button>
              ))}
            </div>

            {/* User Profile Footer */}
            <div className="border-t border-slate-700/50 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-[#1A9B7D]/20">
                  <MaterialIcon name="person" className="text-lg text-[#1A9B7D]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{userName}</p>
                  {userEmail && <p className="truncate text-[11px] text-slate-400" style={{ fontFamily: "'Manrope', sans-serif" }}>{userEmail}</p>}
                </div>
                <button
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                  title="Cerrar sesión"
                >
                  <MaterialIcon name="logout" className="text-lg" />
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
