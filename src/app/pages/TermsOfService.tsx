import { motion } from "motion/react";
import { Shield, ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "../components/Logo";
import { SEO } from "../components/SEO";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white font-['Manrope'] text-slate-900 overflow-x-hidden">
      <SEO 
        title="Terminos y Condiciones - Pessy"
        description="Consulta los terminos de uso del ecosistema de identidad digital Pessy."
        canonical="https://pessy.app/terminos"
      />
      
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="size-9" color="#074738" />
            <span className="text-xl font-black tracking-tight text-[#074738]">Pessy</span>
          </Link>
          <Link to="/login" className="px-6 py-2 text-sm font-bold text-[#074738] hover:bg-[#e0f2f1] rounded-full transition-all uppercase tracking-wide">
            ENTRAR
          </Link>
        </nav>
      </header>

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto space-y-12">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <Link to="/" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#1a9b7d] hover:opacity-70 transition-opacity">
              <ArrowLeft size={14} />
              Volver
            </Link>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">Terminos y Condiciones</h1>
            <p className="text-slate-500 font-medium uppercase tracking-[0.2em] text-xs">Ultima actualizacion: Marzo 2026</p>
          </motion.div>

          <div className="prose prose-slate max-w-none space-y-8 text-lg text-slate-600 leading-relaxed font-medium">
            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">1. Aceptacion de los terminos</h2>
              <p>Al acceder o utilizar Pessy, usted acepta cumplir con estos terminos y condiciones. Si no esta de acuerdo con alguna parte de los mismos, no podra utilizar el servicio.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">2. Descripcion del servicio</h2>
              <p>Pessy es un ecosistema de identidad digital para mascotas que utiliza inteligencia artificial para estructurar informacion medica y activar servicios on-demand dentro del sector pet care.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">3. Responsabilidad del usuario</h2>
              <p>El usuario es el unico responsable de la veracidad de la informacion cargada en la plataforma. Pessy no se hace responsable por errores en el historial clinico derivados de informacion incorrecta proporcionada por el tutor.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">4. Limitacion de responsabilidad medica</h2>
              <p>Pessy no es un servicio veterinario ni reemplaza la consulta profesional. El motor de IA es una herramienta de asistencia para organizar datos, pero cualquier decision medica debe ser validada por un profesional veterinario colegiado.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">5. Planes y suscripciones</h2>
              <p>Los precios y caracteristicas de los planes (Free, Premium Beta, Family Beta) estan sujetos a cambios con previo aviso. Los beneficios de "early adopter" estan garantizados para quienes se unan durante la fase de lanzamiento.</p>
            </section>
          </div>
        </div>
      </main>

      <footer className="py-12 px-6 border-t border-slate-100 text-center">
        <div className="max-w-7xl mx-auto space-y-4">
          <Link to="/" className="inline-flex items-center gap-2">
            <Logo className="size-8" />
            <span className="text-xl font-black tracking-tighter text-[#074738]">Pessy</span>
          </Link>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-300">© 2026 Pessy</p>
        </div>
      </footer>
    </div>
  );
}
