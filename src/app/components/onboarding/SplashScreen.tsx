import { useEffect, useState } from "react";

interface SplashScreenProps {
  onFinish: () => void;
  duration?: number;
}

export function SplashScreen({ onFinish, duration = 2200 }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), duration - 400);
    const endTimer = setTimeout(onFinish, duration);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [duration, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-400 ${fadeOut ? "opacity-0" : "opacity-100"}`}
      style={{
        background: "linear-gradient(160deg, #074738 0%, #0a6b54 50%, #1A9B7D 100%)",
        fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif",
      }}
    >
      {/* Ambient shapes */}
      <div className="absolute -right-20 -top-20 w-[280px] h-[280px] rounded-[42%_58%_65%_35%/52%_45%_55%_48%] bg-white/5 blur-2xl pointer-events-none" />
      <div className="absolute -left-16 bottom-20 w-[200px] h-[200px] rounded-[58%_42%_35%_65%/45%_52%_48%_55%] bg-white/5 blur-2xl pointer-events-none" />

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className="size-24 rounded-[28px] bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <img src="/pessy-logo.svg" alt="Pessy" className="size-16 object-contain" />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">Pessy</h1>
        <p className="text-white/60 text-sm font-medium">
          Porque quererlo ya es suficiente trabajo.
        </p>
      </div>

      {/* Loading indicator */}
      <div className="absolute bottom-16 z-10">
        <div className="size-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    </div>
  );
}
