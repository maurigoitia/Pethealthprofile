import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";

export function RegisterUserScreen() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({
    email: "",
    confirmPassword: "",
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailBlur = () => {
    if (formData.email && validateEmail(formData.email)) {
      setErrors({ ...errors, email: "" });
    } else if (formData.email) {
      setErrors({ ...errors, email: "Correo electrónico inválido" });
    }
  };

  const handleConfirmPasswordBlur = () => {
    if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
      setErrors({ ...errors, confirmPassword: "Las contraseñas no coinciden." });
    } else {
      setErrors({ ...errors, confirmPassword: "" });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement user registration logic
    // For now, navigate to pet registration
    navigate("/register-pet");
  };

  const isEmailValid = formData.email && validateEmail(formData.email);

  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen flex items-center justify-center p-4 relative">
      {/* Background Decoration */}
      <div className="fixed top-0 left-0 -z-10 w-full h-full overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#2b7cee] rounded-full blur-[100px]"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#2b7cee]/40 rounded-full blur-[100px]"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        {/* Header / Branding */}
        <div className="pt-10 pb-6 px-8 text-center bg-gradient-to-b from-[#2b7cee]/10 to-transparent">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-[#2b7cee] rounded-full mb-4 shadow-lg shadow-[#2b7cee]/30"
          >
            <span className="material-symbols-outlined text-white text-3xl">person_add</span>
          </motion.div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            PESSY
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Crea tu cuenta y comienza hoy. <b>¡Es gratis!</b></p>
        </div>

        {/* Benefits Section */}
        <div className="px-8 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="material-symbols-outlined text-[#2b7cee] text-sm">history</span>
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">Historial completo</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="material-symbols-outlined text-[#2b7cee] text-sm">notifications</span>
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">Recordatorios IA</span>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
          {/* Full Name Field */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="full-name">
              Nombre Completo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-slate-400 text-sm">person</span>
              </div>
              <input
                className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#2b7cee] focus:border-[#2b7cee] transition-all text-sm"
                id="full-name"
                name="full-name"
                placeholder="Juan Pérez"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>
          </div>

          {/* Email Field */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="email">
              Correo Electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-slate-400 text-sm">email</span>
              </div>
              <input
                className={`block w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border ${
                  isEmailValid
                    ? "border-[#2b7cee]/50 dark:border-[#2b7cee]/50"
                    : "border-slate-300 dark:border-slate-700"
                } rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#2b7cee] focus:border-[#2b7cee] transition-all text-sm`}
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                onBlur={handleEmailBlur}
              />
              {isEmailValid && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>
                </div>
              )}
            </div>
            {isEmailValid && (
              <p className="text-[11px] text-green-600 dark:text-green-400">Correo electrónico válido.</p>
            )}
            {errors.email && <p className="text-[11px] text-red-600 dark:text-red-400">{errors.email}</p>}
          </div>

          {/* Password Field */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-slate-400 text-sm">lock</span>
              </div>
              <input
                className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#2b7cee] focus:border-[#2b7cee] transition-all text-sm"
                id="password"
                name="password"
                placeholder="••••••••"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="confirm-password">
              Confirmar Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-slate-400 text-sm">verified_user</span>
              </div>
              <input
                className={`block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border ${
                  errors.confirmPassword
                    ? "border-red-300 dark:border-red-900/50"
                    : "border-slate-300 dark:border-slate-700"
                } rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#2b7cee] focus:border-[#2b7cee] transition-all text-sm`}
                id="confirm-password"
                name="confirm-password"
                placeholder="••••••••"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                onBlur={handleConfirmPasswordBlur}
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-[11px] text-red-600 dark:text-red-400">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            className="w-full bg-[#2b7cee] hover:bg-[#2563d4] text-white font-semibold py-3 px-4 rounded-lg transition-colors shadow-lg shadow-[#2b7cee]/20 active:scale-[0.98] transform mt-4"
            type="submit"
          >
            Crear Cuenta
          </button>

          {/* Navigation Link */}
          <div className="text-center pt-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ¿Ya tienes una cuenta?
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-[#2b7cee] hover:underline font-semibold ml-1"
              >
                Ya tengo cuenta
              </button>
            </p>
          </div>
        </form>

        {/* Footer / Security Badge */}
        <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 py-4 px-8 flex justify-center items-center">
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
            <span className="material-symbols-outlined text-[#2b7cee] text-base">verified</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Acceso Encriptado
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
