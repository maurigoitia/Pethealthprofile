import { motion } from "motion/react";
import { Shield, ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "../components/Logo";
import { SEO } from "../components/SEO";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white font-['Manrope'] text-slate-900 overflow-x-hidden">
      <SEO 
        title="Politica de Privacidad - Pessy"
        description="Conoce como protegemos los datos de tu mascota en Pessy."
        canonical="https://pessy.app/privacidad"
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
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">Politica de Privacidad</h1>
            <p className="text-slate-500 font-medium uppercase tracking-[0.2em] text-xs">Ultima actualizacion: Marzo 2026</p>
          </motion.div>

          <div className="prose prose-slate max-w-none space-y-8 text-lg text-slate-600 leading-relaxed font-medium">
            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">1. Responsable del tratamiento</h2>
              <p>Pessy es una plataforma dedicada a la gestion de la identidad digital de las mascotas. El tratamiento de los datos se realiza con el fin de proporcionar un ecosistema de informacion centralizado para tutores y profesionales del sector pet care.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">2. Datos recolectados</h2>
              <p>Para el funcionamiento del ecosistema, recolectamos:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Informacion de la mascota: Nombre, especie, raza, edad, peso, fotos e historial clinico.</li>
                <li>Informacion del tutor: Nombre, direccion de correo electronico y datos de contacto basicos.</li>
                <li>Documentos: Certificados de vacunacion, recetas medicas y reportes de diagnostico procesados por nuestra IA.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">3. Uso de la informacion</h2>
              <p>Los datos se utilizan exclusivamente para:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Generar el perfil de identidad digital de la mascota.</li>
                <li>Estructurar informacion medica mediante inteligencia artificial.</li>
                <li>Enviar recordatorios de vacunas y tratamientos.</li>
                <li>Facilitar la comunicacion con profesionales veterinarios.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">4. Seguridad</h2>
              <p>Implementamos medidas de seguridad para proteger la integridad de la informacion. Sin embargo, es importante notar que Figma Make no esta diseñado para recolectar informacion de identificacion personal sensible o datos que requieran niveles extremos de seguridad bancaria o gubernamental.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">5. Contacto</h2>
              <p>Para consultas sobre privacidad o ejercicio de derechos de acceso, rectificacion o supresion, puede contactarnos en: <span className="text-[#074738] font-black underline">privacidad@pessy.app</span></p>
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
