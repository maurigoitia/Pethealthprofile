import { motion } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";

interface ErrorStateProps {
  title?: string;
  message: string;
  type?: "error" | "warning" | "offline" | "upload";
  onRetry?: () => void;
  onDismiss?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title,
  message,
  type = "error",
  onRetry,
  onDismiss,
  retryLabel = "Intentar de nuevo",
}: ErrorStateProps) {
  const getIconAndColor = () => {
    switch (type) {
      case "error":
        return {
          icon: "error",
          color: "text-red-500",
          bg: "bg-red-50 dark:bg-red-950/20",
          border: "border-red-200 dark:border-red-900/30",
        };
      case "warning":
        return {
          icon: "warning",
          color: "text-amber-500",
          bg: "bg-amber-50 dark:bg-amber-950/20",
          border: "border-amber-200 dark:border-amber-900/30",
        };
      case "offline":
        return {
          icon: "wifi_off",
          color: "text-slate-500",
          bg: "bg-slate-50 dark:bg-slate-900/50",
          border: "border-slate-200 dark:border-slate-800",
        };
      case "upload":
        return {
          icon: "cloud_off",
          color: "text-purple-500",
          bg: "bg-purple-50 dark:bg-purple-950/20",
          border: "border-purple-200 dark:border-purple-900/30",
        };
    }
  };

  const styling = getIconAndColor();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col items-center justify-center py-16 px-6"
    >
      {/* Icon with Animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
        className={`size-24 rounded-full ${styling.bg} ${styling.border} border-2 flex items-center justify-center mb-6 relative`}
      >
        <MaterialIcon name={styling.icon} className={`${styling.color} text-5xl`} />
        
        {/* Pulse effect for errors */}
        {type === "error" && (
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-red-500"
          />
        )}
      </motion.div>

      {/* Title */}
      {title && (
        <h3 className="text-xl font-black text-slate-900 dark:text-white text-center mb-2">
          {title}
        </h3>
      )}

      {/* Message */}
      <p className="text-sm text-slate-600 dark:text-slate-400 text-center max-w-xs mb-6 leading-relaxed">
        {message}
      </p>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap justify-center">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-6 py-3 bg-[#2b6fee] text-white rounded-xl font-bold hover:bg-[#5a8aff] transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#2b6fee]/30"
          >
            <MaterialIcon name="refresh" className="text-xl" />
            <span>{retryLabel}</span>
          </button>
        )}
        
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cerrar
          </button>
        )}
      </div>

      {/* Helpful Tips based on error type */}
      {type === "offline" && (
        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 max-w-xs">
          <div className="flex items-start gap-3">
            <MaterialIcon name="info" className="text-[#2b6fee] text-xl shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                Sin conexión a internet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Verifica tu conexión WiFi o datos móviles e intenta nuevamente.
              </p>
            </div>
          </div>
        </div>
      )}

      {type === "upload" && (
        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 max-w-xs">
          <div className="flex items-start gap-3">
            <MaterialIcon name="lightbulb" className="text-amber-500 text-xl shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                Consejos para subir archivos
              </p>
              <ul className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed space-y-1">
                <li>• Verifica que el archivo no sea muy grande</li>
                <li>• Asegúrate de tener buena conexión</li>
                <li>• Usa archivos en formato JPG, PNG o PDF</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
