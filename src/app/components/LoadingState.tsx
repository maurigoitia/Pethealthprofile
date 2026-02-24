import { motion } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";

interface LoadingStateProps {
  message?: string;
  type?: "spinner" | "dots" | "progress" | "ai";
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

        {type === "ai" && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="relative size-20"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#2b6fee] to-purple-500" />
            <div className="absolute inset-2 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
              <MaterialIcon name="psychology" className="text-[#2b6fee] text-4xl" />
            </div>
          </motion.div>
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
      {type === "ai" && (
        <div className="flex gap-2 mt-4">
          {["Analizando", "OCR", "Validando"].map((step, idx) => (
            <motion.div
              key={step}
              initial={{ opacity: 0.3 }}
              animate={{ opacity: 1 }}
              transition={{
                delay: idx * 0.3,
                duration: 0.5,
                repeat: Infinity,
                repeatType: "reverse",
              }}
              className="px-3 py-1.5 rounded-full bg-[#2b6fee]/10 text-[#2b6fee] text-xs font-bold"
            >
              {step}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
