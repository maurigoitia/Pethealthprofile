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
      className="flex items-center gap-4 rounded-[16px] border border-[#F59E0B]/30 bg-[#FEF3C7] px-4 py-3"
    >
      {/* Emoji */}
      <span className="text-[32px] leading-none shrink-0">{emoji}</span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-[#1A1A1A] leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {sound} Completá el perfil de {petName}
        </p>
        <p className="text-[12px] text-[#6B7280] leading-snug mt-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
          Falta {missingText} para recomendaciones personalizadas.
        </p>
      </div>

      {/* Button */}
      <button
        onClick={onComplete}
        className="shrink-0 rounded-full bg-[#074738] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#1A9B7D] transition-colors"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        Completar
      </button>
    </div>
  );
}
