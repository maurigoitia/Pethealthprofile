import { motion } from "motion/react";

interface LoadingStateProps {
  message?: string;
  type?: "spinner" | "dots" | "progress" | "analysis";
  progress?: number;
}

export function LoadingState({ 
  message = "Cargando...", 
  type = "spinner",
  progress 
}: LoadingStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6"
    >
      {/* Loading Animation */}
      <div className="mb-6">
        {type === "spinner" && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="size-16 rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-[#2b6fee] border-r-[#2b6fee]"
          />
        )}

        {type === "dots" && (
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [1, 0.5, 1],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
                className="size-4 rounded-full bg-[#2b6fee]"
              />
            ))}
          </div>
        )}

        {type === "analysis" && (
          <div className="size-16 rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-[#2b6fee] animate-spin" />
        )}

        {type === "progress" && progress !== undefined && (
          <div className="w-64">
            <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
              <motion.div
                className="h-full bg-gradient-to-r from-[#2b6fee] to-purple-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-center text-sm font-bold text-[#2b6fee]">
              {progress}%
            </p>
          </div>
        )}
      </div>

      {/* Message */}
      <motion.p
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-sm font-semibold text-slate-600 dark:text-slate-400 text-center"
      >
        {message}
      </motion.p>

      {/* Decorative Elements */}
      {type === "analysis" && (
        <div className="flex gap-2 mt-4">
          {["Lectura", "Extraccion", "Validacion"].map((step) => (
            <div
              key={step}
              className="px-3 py-1.5 rounded-full bg-[#2b6fee]/10 text-[#2b6fee] text-xs font-bold"
            >
              {step}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
