
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
    <div



      className="flex flex-col items-center justify-center py-16 px-6"
    >
      {/* Illustration or Icon */}
      <div className="mb-6 relative">
        {illustration ? (
          <div className="size-48 rounded-3xl bg-gradient-to-br from-[#074738]/5 to-emerald-50 dark:from-[#074738]/10 dark:to-emerald-950/20 p-6 flex items-center justify-center border-2 border-dashed border-[#074738]/20">
            {/* Simple decorative markers */}
            <div className="absolute top-4 right-4 size-6 rounded-full bg-[#074738]/15" />
            <div className="absolute bottom-6 left-6 size-4 rounded-full bg-[#074738]/15" />
            
            {/* Main icon */}
            <div className="size-24 rounded-2xl bg-[#074738]/10 flex items-center justify-center">
              <MaterialIcon name={icon} className="text-[#074738] text-6xl" />
            </div>
          </div>
        ) : (
          <div className="size-24 rounded-full bg-gradient-to-br from-[#074738]/10 to-emerald-100/50 dark:from-[#074738]/20 dark:to-emerald-950/30 flex items-center justify-center">
            <MaterialIcon name={icon} className="text-[#074738] text-5xl" />
          </div>
        )}
      </div>

      {/* Text Content */}
      <h3 className="text-2xl font-bold text-[#074738] dark:text-[#E0F2F1] text-center mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {title}
      </h3>
      <p className="text-base text-[#6B7280] dark:text-[#9CA3AF] text-center max-w-xs mb-6 leading-relaxed" style={{ fontFamily: "'Manrope', sans-serif" }}>
        {description}
      </p>

      {/* Action Button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-2 px-6 py-3 bg-[#074738] text-white rounded-2xl font-bold hover:bg-[#1a9b7d] transition-all hover:scale-105 active:scale-95 shadow-md shadow-[#074738]/20"
        >
          <MaterialIcon name="add_circle" className="text-xl" />
          <span>{actionLabel}</span>
        </button>
      )}

      {/* Decorative gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-20 -right-20 size-40 bg-[#074738]/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 size-40 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
