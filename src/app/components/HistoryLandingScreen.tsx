import { motion } from "motion/react";
import { Camera, FileText, ArrowRight, Sparkles, Smartphone, History, CheckCircle2 } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "./Logo";
import { SEO } from "./SEO";

export default function HistoryLanding() {
  return (
    <div className="min-h-screen bg-white font-['Manrope'] text-slate-900 overflow-x-hidden">
      <SEO 
        title="Historial Medico de tu Mascota - Pessy"
        description="Organiza el historial medico completo de tu mascota. Escanea documentos con IA y accede a toda la informacion desde tu celular. Sin papeles, sin vueltas."
        keywords="historial medico mascota, ia veterinaria, escaneo documentos mascota, salud animal digital"
        canonical="https://pessy.app/soluciones/historial"
      />
      
      {/* Skip to main content */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-6 focus:py-3 focus:bg-[#074738] focus:text-white focus:rounded-lg focus:font-bold"
      >
        Saltar al contenido principal
      </a>
      
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100" role="banner">
        <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between" aria-label="Navegacion principal">
          <Link 
            to="/" 
            className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-[#074738] focus:ring-offset-2 rounded-lg"
            aria-label="Pessy - Ir a inicio"
          >
            <Logo className="size-9" color="#074738" />
            <span className="text-xl font-black tracking-tight text-[#074738]">Pessy</span>
          </Link>
          <Link 
            to="/login" 
            className="px-6 py-2 text-sm font-bold text-[#074738] hover:bg-[#e0f2f1] rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#074738] focus:ring-offset-2 uppercase tracking-wide"
            aria-label="Entrar a la aplicacion"
          >
            ENTRAR
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main id="main-content" className="pt-24">
        <header className="py-16 md:py-20 px-6">
          <div className="max-w-5xl mx-auto text-center space-y-8">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#e0f2f1] text-[#074738] rounded-full border border-[#1a9b7d]/20"
            >
              <History size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Historial Medico Digital</span>
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.1]">
              Todo el historial de tu mascota <br /><span className="text-[#1a9b7d]">en un click.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-500 max-w-3xl mx-auto leading-relaxed">
              Se acabaron los cajones llenos de papeles. Pessy centraliza diagnosticos, estudios y recetas automaticamente.
            </p>
            <div className="pt-4">
              <a 
                href="https://pessy.app/login" 
                className="inline-flex items-center gap-3 px-10 py-5 bg-[#1a9b7d] text-white rounded-full font-black text-lg shadow-xl shadow-[#1a9b7d]/20 hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#1a9b7d] focus:ring-offset-2"
                aria-label="Digitalizar historial de mi mascota"
              >
                Digitalizar mi mascota
                <ArrowRight size={20} />
              </a>
            </div>
          </div>
        </header>

        {/* Features Grid */}
        <section className="py-20 px-6 bg-slate-50">
          <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Camera,
                title: "OCR con IA",
                desc: "Sacale una foto al informe. Pessy lee el texto y extrae los datos clave por vos."
              },
              {
                icon: FileText,
                title: "Documentos Organizados",
                desc: "Todos los documentos en un solo lugar. Accede a ellos desde cualquier dispositivo."
              },
              {
                icon: Sparkles,
                title: "Innovacion en Veterinaria",
                desc: "Utiliza la tecnologia para mejorar la salud de tu mascota. Pessy es la solucion."
              }
            ].map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm"
              >
                <div className="size-12 bg-[#e0f2f1] rounded-2xl flex items-center justify-center text-[#074738] mb-6">
                  <f.icon size={24} />
                </div>
                <h3 className="text-xl font-black mb-4 tracking-tight">{f.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Why Section */}
        <section className="py-32 px-6">
          <div className="max-w-4xl mx-auto space-y-16">
            <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-6xl font-black tracking-tight">El orden que salva vidas.</h2>
              <p className="text-lg text-slate-500 font-medium italic">"Tener el historial a mano puede marcar la diferencia en una emergencia."</p>
            </div>
            <div className="space-y-6">
              {[
                "Evolucion de peso automatica.",
                "Registro historico de sintomas y alergias.",
                "Acceso desde cualquier dispositivo, 24/7.",
                "Exportacion completa en formato estandar."
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <CheckCircle2 className="text-[#1a9b7d]" size={24} />
                  <span className="text-lg font-bold text-slate-700">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer simple */}
        <footer className="py-12 px-6 border-t border-slate-100 text-center">
          <div className="max-w-7xl mx-auto space-y-4">
            <Link to="/" className="inline-flex items-center gap-2">
              <Logo className="size-8" />
              <span className="text-xl font-black tracking-tighter text-[#074738]">Pessy</span>
            </Link>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-600">Tu mascota, sus cosas, todo en orden.</p>
            <div className="pt-4 flex justify-center gap-8">
              <Link to="/soluciones/historial" className="text-xs font-black text-slate-700 hover:text-[#1a9b7d] uppercase tracking-widest transition-colors">Historial</Link>
              <Link to="/soluciones/medicacion" className="text-xs font-black text-slate-700 hover:text-[#1a9b7d] uppercase tracking-widest transition-colors">Medicacion</Link>
              <Link to="/login" className="text-xs font-black text-slate-700 hover:text-[#1a9b7d] uppercase tracking-widest transition-colors">Entrar</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}