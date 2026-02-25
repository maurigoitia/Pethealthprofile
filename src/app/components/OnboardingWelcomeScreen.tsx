import { useNavigate } from "react-router";
import { motion } from "motion/react";

export function OnboardingWelcomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 shadow-2xl rounded-xl overflow-hidden flex flex-col min-h-[700px] border border-[#2b7cee]/10">
        {/* Top Branding Section */}
        <div className="pt-8 px-8 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2b7cee] rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">pets</span>
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">PESSY</span>
          </div>
          <div className="text-sm font-medium text-[#2b7cee] bg-[#2b7cee]/10 px-3 py-1 rounded-full">
            Beta
          </div>
        </div>

        {/* Illustration Section */}
        <div className="flex-grow flex items-center justify-center p-8">
          <div className="relative w-full aspect-square max-w-[300px]">
            {/* Decorative Circles */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="absolute -top-4 -right-4 w-24 h-24 bg-[#2b7cee]/5 rounded-full"
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="absolute -bottom-6 -left-6 w-32 h-32 bg-[#2b7cee]/10 rounded-full"
            />
            
            {/* Main Illustration - Pet Healthcare Concept */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="w-full h-full relative z-10 flex items-center justify-center"
            >
              <div className="text-center">
                <div className="size-48 mx-auto mb-6 bg-gradient-to-br from-[#2b7cee] to-[#5d9fff] rounded-full flex items-center justify-center shadow-2xl shadow-[#2b7cee]/30">
                  <span className="material-symbols-outlined text-white" style={{ fontSize: "120px" }}>
                    pets
                  </span>
                </div>
                <div className="flex justify-center gap-3">
                  <div className="size-12 bg-[#2b7cee]/10 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#2b7cee]">medical_services</span>
                  </div>
                  <div className="size-12 bg-[#2b7cee]/10 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#2b7cee]">calendar_month</span>
                  </div>
                  <div className="size-12 bg-[#2b7cee]/10 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#2b7cee]">auto_graph</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Content Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="px-8 pb-12 text-center"
        >
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-4 leading-tight">
            Bienvenido a <span className="text-[#2b7cee]">PESSY</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg mb-10 leading-relaxed">
            La salud de tu mejor amigo, <br />
            <span className="font-semibold text-slate-800 dark:text-slate-200">simplificada para vos</span>
          </p>

          {/* Action Area */}
          <div className="space-y-4">
            <button
              onClick={() => navigate("/register-user")}
              className="w-full py-4 px-6 bg-[#2b7cee] hover:bg-[#2563d4] text-white font-bold rounded-xl shadow-lg shadow-[#2b7cee]/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              Comenzar
              <span className="material-symbols-outlined text-xl">arrow_forward</span>
            </button>

            <div className="flex justify-center gap-2 pt-4">
              <div className="h-1.5 w-8 bg-[#2b7cee] rounded-full"></div>
              <div className="h-1.5 w-2 bg-[#2b7cee]/20 rounded-full"></div>
              <div className="h-1.5 w-2 bg-[#2b7cee]/20 rounded-full"></div>
            </div>
          </div>
        </motion.div>

        {/* Professional Clinical Footer Style */}
        <div className="py-4 border-t border-[#2b7cee]/5 bg-slate-50 dark:bg-slate-800/50 px-8 flex justify-center items-center gap-4">
          <div className="flex items-center gap-1.5 opacity-60">
            <span className="material-symbols-outlined text-xs text-slate-900 dark:text-slate-100">verified_user</span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-900 dark:text-slate-100">
              Grado Veterinario
            </span>
          </div>
          <div className="w-1 h-1 bg-[#2b7cee]/40 rounded-full"></div>
          <div className="flex items-center gap-1.5 opacity-60">
            <span className="material-symbols-outlined text-xs text-slate-900 dark:text-slate-100">monitoring</span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-900 dark:text-slate-100">
              Historial Digital
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
