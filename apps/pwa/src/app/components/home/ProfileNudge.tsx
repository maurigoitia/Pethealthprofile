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
      className="flex items-center gap-3 rounded-3xl border border-[#F59E0B]/30 bg-[#FEF3C7] p-4"
    >
      <span className="text-2xl leading-none shrink-0">{emoji}</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-[800] text-[#074738] leading-tight">
          {sound} Completá el perfil de {petName}
        </p>
        <p className="text-xs text-[#6B7280] leading-snug mt-0.5">
          Falta {missingText} para recomendaciones personalizadas.
        </p>
      </div>

      <button
        onClick={onComplete}
        className="shrink-0 rounded-full bg-[#074738] px-4 py-2 text-xs font-bold text-white hover:bg-[#1A9B7D] transition-colors"
      >
        Completar
      </button>
    </div>
  );
}
