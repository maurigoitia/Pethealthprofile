import { useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import pessyLogo from "figma:asset/e4b9cb13fdb59713820f2da9cb50d2aa5431cc45.png";

export function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/welcome");
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#2b6fee] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Subtle pattern background */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Main Content */}
      <div className="flex flex-col items-center relative z-10">
        {/* Logo Circle with Official Logo */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            duration: 0.8,
            ease: [0.34, 1.56, 0.64, 1],
            type: "spring",
          }}
          className="mb-12"
        >
          <div className="size-28 bg-white rounded-full flex items-center justify-center shadow-2xl p-6">
            <img
              src={pessyLogo}
              alt="PESSY Logo"
              className="w-full h-full object-contain"
            />
          </div>
        </motion.div>

        {/* Brand Name */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center"
        >
          <h1 className="text-7xl font-black text-white mb-4 tracking-tight">
            PESSY
          </h1>
          <p className="text-white/90 text-lg font-semibold">
            Cuidado de mascotas
          </p>
        </motion.div>
      </div>

      {/* Loading Dots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-20"
      >
        <div className="flex gap-2.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="size-2.5 bg-white rounded-full"
              animate={{
                y: [0, -8, 0],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* Bottom gradient decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/10 to-transparent" />
    </div>
  );
}