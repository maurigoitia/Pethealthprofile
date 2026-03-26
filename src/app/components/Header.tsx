import { MaterialIcon } from "./MaterialIcon";
import { useAuth } from "../contexts/AuthContext";
import { PetPhoto } from "./PetPhoto";

interface HeaderProps {
  onPetClick: () => void;
  activePet?: {
    name: string;
    photo: string;
    species: string;
  };
}

export function Header({ onPetClick, activePet }: HeaderProps) {
  const { userName } = useAuth();
  const safeUserName = (userName || "").trim() || "Tutor";

  return (
    <header className="px-4 pt-6 pb-4 bg-gradient-to-b from-[#074738]/5 to-transparent">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-slate-400 font-medium">Hola,</p>
          <p className="text-base font-black text-slate-900 dark:text-white">{safeUserName}</p>
        </div>
      </div>

      {/* Pet Profile Card */}
      {activePet && (
        <button
          onClick={onPetClick}
          className="w-full bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-lg shadow-slate-200/50 dark:shadow-slate-950/50 border border-slate-200 dark:border-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="size-20 rounded-2xl bg-gradient-to-br from-[#074738] to-emerald-500 p-0.5">
                <div className="size-full rounded-[15px] overflow-hidden">
                  <PetPhoto
                    src={activePet.photo}
                    alt={activePet.name}
                    className="size-full object-cover"
                    fallbackClassName="rounded-[15px]"
                  />
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                <MaterialIcon name="check" className="text-white text-sm" />
              </div>
            </div>

            <div className="flex-1 text-left">
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-0.5">
                {activePet.name}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                {activePet.species}
              </p>
            </div>

            <MaterialIcon name="chevron_right" className="text-slate-400 text-2xl" />
          </div>
        </button>
      )}
    </header>
  );
}
