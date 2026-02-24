import { useNavigate } from "react-router";
import { motion } from "motion/react";
import imgPessyLogo from "figma:asset/e4b9cb13fdb59713820f2da9cb50d2aa5431cc45.png";

export function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-between px-8 py-12 relative overflow-hidden"
      style={{ 
        backgroundImage: "linear-gradient(rgb(43, 124, 238) 0%, rgb(61, 139, 255) 50%, rgb(93, 163, 255) 100%)" 
      }}
    >
      {/* Logo de fondo con opacidad */}
      <div className="absolute left-0 top-0 h-[853px] w-full flex items-center justify-center overflow-hidden">
        <div 
          className="relative rotate-6 opacity-25"
          style={{ 
            width: '670px', 
            height: '1228px',
            filter: 'brightness(0) invert(1)'
          }}
        >
          <img 
            src={imgPessyLogo} 
            alt="" 
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* Decorative blurred elements */}
      <div className="absolute left-[120px] top-[-128px] size-[400px] bg-white/10 rounded-full blur-[64px]" />
      <div className="absolute left-[-80px] top-[473px] size-[300px] bg-white/5 rounded-full blur-[64px]" />

      <div className="flex flex-col items-center relative z-10 w-full max-w-md flex-1 justify-center">
        {/* Título y subtítulo */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center mb-12"
        >
          {/* Título PESSY con DM Sans */}
          <h1 
            className="text-[72px] font-black text-white tracking-[-3.6px] leading-[72px] mb-6"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Pessy
          </h1>

          {/* Subtítulo */}
          <p 
            className="text-white/80 text-[16px] font-medium text-center tracking-[0.4px] leading-[24px]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            tu mascota sus cosas todo en orden
          </p>
        </motion.div>

        {/* Botones */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full space-y-5 mt-[224px]"
        >
          {/* Botón INGRESAR */}
          <button
            onClick={() => navigate("/login")}
            className="w-full py-6 rounded-[40px] bg-white text-[#2b7cee] font-bold text-[16px] shadow-[0px_25px_50px_0px_rgba(0,0,0,0.25)] hover:bg-white/95 active:scale-[0.98] transition-all tracking-[1.6px] uppercase"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Ingresar
          </button>

          {/* Botón CREAR CUENTA */}
          <button
            onClick={() => navigate("/register-user")}
            className="w-full py-6 rounded-[40px] bg-white/20 backdrop-blur-sm text-white font-bold text-[16px] border-[1.5px] border-white/30 hover:bg-white/30 active:scale-[0.98] transition-all tracking-[1.6px] uppercase"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Registrarse gratis
          </button>
        </motion.div>
      </div>
    </div>
  );
}