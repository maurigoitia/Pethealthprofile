import { motion } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: "pet" | "document" | "calendar" | "report" | "medical";
}

export function EmptyState({
  icon = "inbox",
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
      className="flex flex-col items-center justify-center py-16 px-6"
    >
      {/* Illustration or Icon */}
      <div className="mb-6 relative">
        {illustration ? (
          <div className="size-48 rounded-3xl bg-gradient-to-br from-[#2b6fee]/5 to-purple-50 dark:from-[#2b6fee]/10 dark:to-purple-950/20 p-6 flex items-center justify-center border-2 border-dashed border-[#2b6fee]/20">
            {/* Simple decorative markers */}
            <div className="absolute top-4 right-4 size-6 rounded-full bg-[#2b6fee]/15" />
            <div className="absolute bottom-6 left-6 size-4 rounded-full bg-[#2b6fee]/15" />
            
            {/* Main icon */}
            <div className="size-24 rounded-2xl bg-[#2b6fee]/10 flex items-center justify-center">
              <MaterialIcon name={icon} className="text-[#2b6fee] text-6xl" />
            </div>
          </div>
        ) : (
          <div className="size-24 rounded-full bg-gradient-to-br from-[#2b6fee]/10 to-purple-100/50 dark:from-[#2b6fee]/20 dark:to-purple-950/30 flex items-center justify-center">
            <MaterialIcon name={icon} className="text-[#2b6fee] text-5xl" />
          </div>
        )}
      </div>

      {/* Text Content */}
      <h3 className="text-xl font-black text-slate-900 dark:text-white text-center mb-3">
        {title}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs mb-6 leading-relaxed">
        {description}
      </p>

      {/* Action Button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-2 px-6 py-3 bg-[#2b6fee] text-white rounded-xl font-bold hover:bg-[#5a8aff] transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#2b6fee]/30"
        >
          <MaterialIcon name="add_circle" className="text-xl" />
          <span>{actionLabel}</span>
        </button>
      )}

      {/* Decorative gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-20 -right-20 size-40 bg-[#2b6fee]/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 size-40 bg-purple-500/5 rounded-full blur-3xl" />
      </div>
    </motion.div>
  );
}
