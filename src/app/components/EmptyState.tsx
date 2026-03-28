import { motion } from "motion/react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: "pet" | "document" | "calendar" | "report" | "medical";
}

// SVG illustration mapping for Cork/Fizz mascots
const svgMap: Record<string, { src: string; alt: string }> = {
  pet: { src: "/blog/svg/cork_fizz_card.svg", alt: "Cork and Fizz mascots" },
  document: { src: "/blog/svg/cork_paw_card.svg", alt: "Cork mascot with paw" },
  calendar: { src: "/blog/svg/cork_treats_bubble_full.svg", alt: "Cork with treats" },
  report: { src: "/blog/svg/dark_top_surprised_cork_head.svg", alt: "Surprised Cork" },
  medical: { src: "/blog/svg/oval_cork_vet_vaccinations.svg", alt: "Cork veterinary" },
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  illustration,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-16 px-6 relative"
    >
      {/* Illustration or Icon */}
      <div className="mb-6 relative">
        {illustration && svgMap[illustration] ? (
          <div className="size-48 rounded-3xl bg-gradient-to-br from-[#074738]/5 to-emerald-50 dark:from-[#074738]/10 dark:to-emerald-950/20 p-6 flex items-center justify-center border-2 border-dashed border-[#074738]/20">
            {/* Simple decorative markers */}
            <div className="absolute top-4 right-4 size-6 rounded-full bg-[#074738]/15" />
            <div className="absolute bottom-6 left-6 size-4 rounded-full bg-[#074738]/15" />

            {/* SVG Illustration with fade-up animation */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="size-32 flex items-center justify-center"
            >
              <img
                src={svgMap[illustration].src}
                alt={svgMap[illustration].alt}
                className="w-full h-full object-contain"
              />
            </motion.div>
          </div>
        ) : null}
      </div>

      {/* Text Content */}
      <h3
        className="text-2xl font-bold text-[#074738] dark:text-[#E0F2F1] text-center mb-3"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {title}
      </h3>
      <p
        className="text-base text-[#6B7280] dark:text-[#9CA3AF] text-center max-w-xs mb-6 leading-relaxed"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        {description}
      </p>

      {/* Action Button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-2 px-6 py-3 min-h-[44px] bg-[#074738] text-white rounded-2xl font-bold hover:bg-[#1a9b7d] transition-all hover:scale-105 active:scale-95 shadow-md shadow-[#074738]/20"
        >
          <span>{actionLabel}</span>
        </button>
      )}

      {/* Decorative gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-20 -right-20 size-40 bg-[#074738]/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 size-40 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>
    </motion.div>
  );
}

export default EmptyState;
