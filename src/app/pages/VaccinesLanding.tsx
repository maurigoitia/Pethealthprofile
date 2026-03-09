import { motion } from "motion/react";
import { Shield, Calendar, ArrowRight, CheckCircle2, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "../components/Logo";
import { SEO } from "../components/SEO";

export default function VaccinesLanding() {
  return (
    <div className="min-h-screen bg-white font-['Manrope'] text-slate-900 overflow-x-hidden">
      <SEO 
        title="Control de Vacunas para Mascotas - Pessy"
        description="Manten el calendario de vacunacion de tu mascota siempre al dia. Alertas automaticas antes de cada vencimiento. Nunca mas pierdas una libreta."
        keywords="vacunas mascota, calendario vacunacion, recordatorios vacunas, libreta sanitaria digital"
        canonical="https://pessy.app/inicio/vacunas"
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
            to="/inicio" 
            className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-[#074738] focus:ring-offset-2 rounded-lg"
            aria-label="Pessy - Ir a inicio"
          >
            <Logo className="size-9" color="#074738" />
            <span className="text-xl font-black tracking-tight text-[#074738]">Pessy</span>
          </Link>
          <Link 
            to="/app" 
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
              <Shield size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Calendario de Vacunacion</span>
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.1]">
              Nunca mas pierdas <br /><span className="text-[#1a9b7d]">la libreta sanitaria.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-500 max-w-3xl mx-auto leading-relaxed">
              Manten el calendario de vacunacion de tu mascota siempre al dia. Alertas automaticas antes de cada vencimiento.
            </p>
            <div className="pt-4">
              <a 
                href="https://pessy.app" 
                className="inline-flex items-center gap-3 px-10 py-5 bg-[#1a9b7d] text-white rounded-full font-black text-lg shadow-xl shadow-[#1a9b7d]/20 hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#1a9b7d] focus:ring-offset-2"
                aria-label="Configurar vacunas de mi mascota"
              >
                Digitalizar vacunas
                <ArrowRight size={20} />
              </a>
            </div>
          </div>
        </header>

        {/* Interactive Feature List */}
        <section className="py-20 px-6 bg-slate-50 overflow-hidden relative">
          <div className="max-w-7xl mx-auto space-y-24">
            <div className="grid md:grid-cols-2 gap-24 items-center">
              <div className="space-y-12">
                <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
                  El control de salud <br />mas inteligente.
                </h2>
                <div className="space-y-8">
                  {[
                    { 
                      icon: Calendar, 
                      title: "Cronograma de Vacunacion", 
                      desc: "Calendario visual interactivo con todas las dosis aplicadas y por aplicar."
                    },
                    { 
                      icon: CheckCircle2, 
                      title: "Alertas de Vencimiento", 
                      desc: "Te avisamos 1 semana antes de cada refuerzo. Olvidar una vacuna es cosa del pasado."
                    },
                    { 
                      icon: Zap, 
                      title: "Certificados Digitales", 
                      desc: "Lleva el carnet completo en tu celular. Ideal para viajar, guarderias o tramites."
                    }
                  ].map((item, i) => (
                    <div key={i} className="flex gap-6 items-start">
                      <div className="size-12 bg-white rounded-2xl flex items-center justify-center text-[#074738] shadow-sm border border-slate-100 flex-shrink-0">
                        <item.icon size={22} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black mb-1 tracking-tight">{item.title}</h3>
                        <p className="text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 bg-[#1a9b7d]/5 rounded-full blur-[100px] scale-150" />
                <div className="relative p-10 bg-white rounded-[4rem] border border-slate-100 shadow-2xl space-y-10">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-8">
                    <div className="flex items-center gap-5">
                      <div className="size-14 bg-[#e0f2f1] rounded-full flex items-center justify-center text-[#074738]">
                        <Shield size={28} />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Proteccion Completa</p>
                        <h4 className="text-xl font-black tracking-tight">Antirrabica</h4>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-[#4caf50]">Dosis Aplicada</p>
                      <p className="text-xs font-bold text-slate-300 tracking-widest">MARZO 2026</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="size-14 bg-red-100 rounded-full flex items-center justify-center text-red-500">
                        <CheckCircle2 size={28} />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Proximo Refuerzo</p>
                        <h4 className="text-xl font-black tracking-tight">Sextuple</h4>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-[#f44336]">Vence pronto</p>
                      <p className="text-xs font-bold text-slate-300 tracking-widest">15 MAYO</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer simple */}
        <footer className="py-12 px-6 border-t border-slate-100 text-center">
          <div className="max-w-7xl mx-auto space-y-4">
            <Link to="/inicio" className="inline-flex items-center gap-2">
              <Logo className="size-8" />
              <span className="text-xl font-black tracking-tighter text-[#074738]">Pessy</span>
            </Link>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-600">Tu mascota, sus cosas, todo en orden.</p>
            <div className="pt-4 flex justify-center gap-8">
              <Link to="/inicio/historial-medico" className="text-xs font-black text-slate-700 hover:text-[#1a9b7d] uppercase tracking-widest transition-colors">Historial</Link>
              <Link to="/inicio/medicacion" className="text-xs font-black text-slate-700 hover:text-[#1a9b7d] uppercase tracking-widest transition-colors">Medicacion</Link>
              <Link to="/app" className="text-xs font-black text-slate-700 hover:text-[#1a9b7d] uppercase tracking-widest transition-colors">Entrar</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}