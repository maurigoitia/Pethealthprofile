import { useNavigate } from "react-router";
import { useEffect } from "react";
import { motion } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";
import { useAuth } from "../contexts/AuthContext";

// PESSY logo inline - replaces broken figma:asset
const PessyLogoBG = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full opacity-20">
    <rect width="80" height="80" rx="18" fill="white" />
    <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fontSize="36" fontWeight="900" fill="#2b6fee" fontFamily="system-ui, -apple-system, sans-serif">P</text>
  </svg>
);

export function WelcomeScreen() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      navigate("/home");
    }
  }, [user, loading, navigate]);

  return (
    <div className="relative min-h-screen w-full bg-[#2b6fee] overflow-hidden flex flex-col font-['Manrope']">
      {/* Background Decoration */}
      <div className="absolute left-0 top-0 h-[853px] w-full flex items-center justify-center overflow-hidden pointer-events-none">
        <div
          className="relative rotate-6"
          style={{ width: '670px', height: '1228px' }}
        >
          <PessyLogoBG />
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col px-8 pt-20 pb-12 items-center text-center">
        {/* Top Logo Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="size-20 bg-white rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-900/40 mx-auto mb-6">
            <span className="text-[#2b6fee] text-4xl font-extrabold tracking-tight">P</span>
          </div>
          <h1 className="text-white text-5xl font-black tracking-tight mb-3">PESSY</h1>
          <p className="text-white/80 text-lg font-medium">Software Veterinario</p>
        </motion.div>

        {/* Hero Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-auto max-w-xs"
        >
          <h2 className="text-white text-3xl font-black leading-tight mb-4">
            Cuidamos lo que <br /> más querés
          </h2>
          <p className="text-white/70 font-medium mb-10 leading-relaxed">
            La historia clínica de tu mascota, <br /> siempre con vos.
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full space-y-4"
        >
          <button
            onClick={() => navigate("/login")}
            className="w-full h-16 bg-white rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl shadow-blue-900/30"
          >
            <span className="text-[#2b6fee] text-lg font-bold">Ingresar</span>
            <MaterialIcon name="login" className="text-[#2b6fee] text-xl" />
          </button>

          <button
            onClick={() => navigate("/register")}
            className="w-full h-16 bg-white/10 border-2 border-white/20 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all hover:bg-white/20"
          >
            <span className="text-white text-lg font-bold">Comenzar</span>
            <MaterialIcon name="arrow_forward" className="text-white text-xl" />
          </button>
        </motion.div>

        {/* Footer */}
        <div className="mt-12">
          <p className="text-white/40 text-xs font-semibold tracking-widest uppercase">
            Designed for Pet Parents
          </p>
        </div>
      </div>
    </div>
  );
}