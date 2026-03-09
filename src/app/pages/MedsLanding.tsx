import { motion } from "motion/react";
import { 
  Bell, 
  Clock, 
  Pill, 
  ArrowRight,
  Sparkles,
  Smartphone,
  CalendarCheck2
} from "lucide-react";
import { Link } from "react-router";
import { Logo } from "../components/Logo";
import { SEO } from "../components/SEO";

export default function MedsLanding() {
  return (
    <div className="min-h-screen bg-white font-['Manrope'] text-slate-900 overflow-x-hidden">
      <SEO 
        title="Control de Medicacion para Mascotas - Pessy"
        description="Nunca mas olvides una dosis. Pessy gestiona el tratamiento de tu mascota con recordatorios inteligentes y seguimiento de stock automatico."
        keywords="medicacion mascota, recordatorios veterinarios, control dosis mascotas, tratamiento animal"
        canonical="https://pessy.app/inicio/medicacion"
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
              <Clock size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Recordatorios de Medicacion</span>
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.1]">
              Nunca mas olvides <br /><span className="text-[#1a9b7d]">una dosis.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-500 max-w-3xl mx-auto leading-relaxed">
              Pessy gestiona el tratamiento de tu mascota por vos. Notificaciones inteligentes, seguimiento de stock y dosis completadas.
            </p>
            <div className="pt-4">
              <a 
                href="https://pessy.app" 
                className="inline-flex items-center gap-3 px-10 py-5 bg-[#1a9b7d] text-white rounded-full font-black text-lg shadow-xl shadow-[#1a9b7d]/20 hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#1a9b7d] focus:ring-offset-2"
                aria-label="Configurar medicacion de mi mascota"
              >
                Configurar medicacion
                <ArrowRight size={20} />
              </a>
            </div>
          </div>
        </header>

        {/* Interactive Feature List */}
        <section className="py-20 px-6 bg-slate-50 overflow-hidden relative">
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-24 items-center">
            <div className="space-y-12">
              <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
                Control total en la palma de tu mano.
              </h2>
              <div className="space-y-8">
                {[
                  { 
                    icon: Bell, 
                    title: "Alertas via WhatsApp & App", 
                    desc: "Recibi el recordatorio donde mas lo usas. Confirma la dosis con un simple click."
                  },
                  { 
                    icon: Pill, 
                    title: "Seguimiento de Stock", 
                    desc: "Pessy sabe cuantas pastillas quedan y te avisa cuando es momento de comprar mas."
                  },
                  { 
                    icon: CalendarCheck2, 
                    title: "Cronograma Completo", 
                    desc: "Visualiza el tratamiento completo en un calendario limpio y organizado."
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
              <div className="relative p-8 bg-white rounded-[3rem] border border-slate-100 shadow-2xl space-y-8">
                <div className="flex items-center justify-between border-b border-slate-50 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="size-12 bg-[#e0f2f1] rounded-full flex items-center justify-center text-[#074738]">
                      <Pill size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Proxima Dosis</p>
                      <h4 className="text-lg font-black tracking-tight">Antibiotico 200mg</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-[#1a9b7d]">A las 20:00 hs</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <button className="w-full py-4 bg-[#1a9b7d] text-white rounded-2xl font-black shadow-lg shadow-[#1a9b7d]/20 active:scale-95 transition-all">Confirmar Dosis</button>
                  <button className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-black active:scale-95 transition-all">Posponer 15m</button>
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
              <Link to="/inicio/vacunas" className="text-xs font-black text-slate-700 hover:text-[#1a9b7d] uppercase tracking-widest transition-colors">Vacunas</Link>
              <Link to="/app" className="text-xs font-black text-slate-700 hover:text-[#1a9b7d] uppercase tracking-widest transition-colors">Entrar</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}