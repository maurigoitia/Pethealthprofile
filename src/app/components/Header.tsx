import { MaterialIcon } from "./MaterialIcon";

interface HeaderProps {
  onPetClick: () => void;
  activePet?: {
    name: string;
    photo: string;
    species: string;
  };
}

export function Header({ onPetClick, activePet }: HeaderProps) {
  // Fallback data if no activePet is provided
  const currentPet = activePet || {
    name: "Bruno",
    photo: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=400&fit=crop",
    species: "Golden Retriever",
  };

  return (
    <header className="px-4 pt-6 pb-4 bg-gradient-to-b from-[#2b6fee]/5 to-transparent">
      {/* Top bar with notifications only */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1" /> {/* Spacer */}
        
        {/* Notifications icon */}
        <button className="size-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
          <MaterialIcon name="notifications" className="text-slate-600 dark:text-slate-400 text-xl" />
        </button>
      </div>

      {/* Pet Profile Card - Main Focus */}
      <button
        onClick={onPetClick}
        className="w-full bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-lg shadow-slate-200/50 dark:shadow-slate-950/50 border border-slate-200 dark:border-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center gap-4">
          {/* Pet Photo - Large and prominent */}
          <div className="relative">
            <div className="size-20 rounded-2xl bg-gradient-to-br from-[#2b6fee] to-purple-500 p-0.5">
              <div className="size-full rounded-[15px] overflow-hidden">
                <img
                  src={currentPet.photo}
                  alt={currentPet.name}
                  className="size-full object-cover"
                />
              </div>
            </div>
            
            {/* Health status indicator */}
            <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center">
              <MaterialIcon name="check" className="text-white text-sm" />
            </div>
          </div>

          {/* Pet Info */}
          <div className="flex-1 text-left">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-0.5">
              {currentPet.name}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-2">
              {currentPet.species}
            </p>
            
            {/* Quick stats */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <MaterialIcon name="calendar_today" className="text-[#2b6fee] text-sm" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  2 citas
                </span>
              </div>
              <div className="flex items-center gap-1">
                <MaterialIcon name="vaccines" className="text-emerald-500 text-sm" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Al día
                </span>
              </div>
            </div>
          </div>

          {/* Arrow indicator */}
          <MaterialIcon name="chevron_right" className="text-slate-400 text-2xl" />
        </div>
      </button>

      {/* Quick action hint */}
      <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-3 font-medium">
        Toca para cambiar mascota o ver perfil completo
      </p>
    </header>
  );
}