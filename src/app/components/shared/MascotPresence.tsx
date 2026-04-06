import React from "react";
import { CorkMascot } from "./CorkMascot";
import { FizzMascot } from "./FizzMascot";

export type MascotMood = 'neutral' | 'happy' | 'alert' | 'worried' | 'celebratory' | 'sleepy' | 'curious' | 'proud';

interface MascotPresenceProps {
  species?: "dog" | "cat";
  size?: number;
  className?: string;
  mood?: MascotMood;
  /** Ambient mode — subtle breathing animation, no speech */
  ambient?: boolean;
  /** Optional message bubble */
  message?: string;
  /** Optional action button */
  action?: { label: string; onClick: () => void };
}

export function MascotPresence({
  species,
  size = 40,
  className,
  mood = "neutral",
  ambient = false,
  message,
  action,
}: MascotPresenceProps) {
  const Mascot = species === "cat" ? FizzMascot : CorkMascot;
  const mascotName = species === "cat" ? "Fizz" : "Cork";

  // Ambient mode: just the mascot, tiny, with subtle breathing
  if (ambient) {
    return (
      <div className={`inline-flex items-center ${className || ""}`} style={{ opacity: 0.85 }}>
        <div
          style={{
            animation: "mascotBreathe 4s ease-in-out infinite",
          }}
        >
          <Mascot size={size} />
        </div>
        <style>{`
          @keyframes mascotBreathe {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.03); }
          }
        `}</style>
      </div>
    );
  }

  // With message (whisper, nudge, etc.)
  if (message) {
    return (
      <div className={`flex items-start gap-3 ${className || ""}`}>
        <div className="flex-shrink-0">
          <Mascot size={size} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#074738]/80 leading-relaxed">
            <span className="font-medium text-[#074738]">{mascotName}</span>
            {" · "}
            {message}
          </p>
          {action && (
            <button
              onClick={action.onClick}
              className="mt-2 px-4 py-1.5 bg-[#1A9B7D] text-white text-sm font-medium rounded-full hover:bg-[#074738] transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Default: just the mascot
  return <Mascot size={size} className={className} />;
}

export default MascotPresence;