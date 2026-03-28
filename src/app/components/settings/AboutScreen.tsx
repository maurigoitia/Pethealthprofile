import { MaterialIcon } from "../shared/MaterialIcon";
const pessyLogo = ""; // Placeholder for missing figma asset

interface AboutScreenProps {
  onBack: () => void;
}

export function AboutScreen({ onBack }: AboutScreenProps) {
  return (
    <div className="bg-[#F0FAF9] dark:bg-[#101622] min-h-screen relative overflow-hidden">
      {/* Logo de fondo como watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] dark:opacity-[0.02]">
        <div className="w-[400px] h-[400px] flex items-center justify-center text-[200px] font-black">P</div>
      </div>

      <div className="max-w-md mx-auto pb-8 relative z-10">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 py-4 flex items-center gap-3">
            <button
              onClick={onBack}
              className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <MaterialIcon name="arrow_back" className="text-xl" />
            </button>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Acerca de PESSY
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* About */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-12 rounded-xl overflow-hidden bg-white flex items-center justify-center shadow-lg text-[#074738] font-black text-2xl">
                P
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  PESSY
                </h2>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Versión 1.0.0
                  </p>
                  <div className="flex items-center gap-1 bg-[#074738]/10 text-[#074738] px-2 py-0.5 rounded-full">
                    <MaterialIcon name="verified" className="text-xs" />
                    <span className="text-[10px] font-bold">Verificada</span>
                  </div>
                </div>
              </div>
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-3">
              ¿Qué es PESSY?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              PESSY es un ecosistema de cuidado y organizacion para mascotas que te ayuda a
              mantener en orden su perfil, sus documentos, sus rutinas y sus recordatorios.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Procesamos documentos y correos relacionados con tu mascota para ordenar
              informacion, generar recordatorios y facilitar que quienes la cuidan compartan
              el contexto correcto.
            </p>
          </div>

          {/* Legal Links */}
          <div className="space-y-2">
            <a
              href="https://pessy.app/terminos"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <MaterialIcon name="gavel" className="text-slate-600 dark:text-slate-400 text-xl" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Aviso legal
                </h3>
              </div>
              <MaterialIcon name="open_in_new" className="text-slate-400" />
            </a>

            <a
              href="https://pessy.app/terminos"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <MaterialIcon name="description" className="text-slate-600 dark:text-slate-400 text-xl" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Términos y condiciones
                </h3>
              </div>
              <MaterialIcon name="open_in_new" className="text-slate-400" />
            </a>

            <a
              href="https://pessy.app/privacidad"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <MaterialIcon name="privacy_tip" className="text-slate-600 dark:text-slate-400 text-xl" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Política de privacidad
                </h3>
              </div>
              <MaterialIcon name="open_in_new" className="text-slate-400" />
            </a>
          </div>

          {/* Copyright */}
          <div className="text-center pt-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              © 2026 PESSY. Todos los derechos reservados.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Hecho con ❤️ para las mascotas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
