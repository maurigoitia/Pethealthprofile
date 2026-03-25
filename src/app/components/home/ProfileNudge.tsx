'use client';

interface ProfileNudgeProps {
  petName: string;
  species: 'dog' | 'cat';
  missingItems: string[]; // e.g., ["peso", "foto"]
  onComplete: () => void;
}

export default function ProfileNudge({
  petName,
  species,
  missingItems,
  onComplete,
}: ProfileNudgeProps) {
  const emoji = species === 'dog' ? '🐶' : '🐱';
  const sound = species === 'dog' ? '¡Woof!' : '¡Miau!';
  const missingText = missingItems.join(' y ');

  return (
    <div
      className="flex items-center gap-3 rounded-[14px] border border-[#FFE082] bg-[#FFF8E1] px-[14px] py-3"
    >
      {/* Emoji */}
      <span className="text-[28px] leading-none shrink-0">{emoji}</span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-[800] text-gray-900 leading-tight">
          {sound} Completá el perfil de {petName}
        </p>
        <p className="text-[11px] text-[#5e716b] leading-tight mt-0.5">
          Falta {missingText} para recomendaciones personalizadas.
        </p>
      </div>

      {/* Button */}
      <button
        onClick={onComplete}
        className="shrink-0 rounded-full bg-[#074738] px-4 py-1.5 text-[12px] font-semibold text-white"
      >
        Completar
      </button>
    </div>
  );
}
