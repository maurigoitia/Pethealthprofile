import React, { useEffect } from "react";
import { motion } from "motion/react";
import { 
  Shield, 
  FileText, 
  Database, 
  Check, 
  ChevronUp,
  ChevronRight,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { Logo } from "../components/Logo";
import { SEO } from "../components/SEO";

const sections = [
  { id: 'privacidad', label: 'PRIVACIDAD' },
  { id: 'terminos', label: 'TERMINOS' },
  { id: 'dpa', label: 'DPA' },
  { id: 'subencargados', label: 'SUBENCARGADOS' }
];

const jurisdictions = [
  { country: 'Argentina', flag: '🇦🇷', regulation: 'Ley 25.326 (PDPA)', authority: 'AAIP' },
  { country: 'Union Europea', flag: '🇪🇺', regulation: 'GDPR — Reg. 2016/679', authority: 'Autoridad del Estado miembro' },
  { country: 'Mexico', flag: '🇲🇽', regulation: 'LFPDPPP', authority: 'INAI' },
  { country: 'Estados Unidos', flag: '🇺🇸', regulation: 'CCPA / CPRA (California)', authority: 'CPPA' },
  { country: 'Canada', flag: '🇨🇦', regulation: 'PIPEDA / Ley 25 (Quebec)', authority: 'OPC' }
];

const subProcessors = [
  { provider: 'Google Firebase', service: 'Base de datos, autenticacion, hosting', region: 'EE.UU. (Google Cloud)', data: 'Todos los datos de usuario y mascota' },
  { provider: 'Google Gemini AI', service: 'Procesamiento de IA transversal', region: 'EE.UU. (Google Cloud)', data: 'Documentos y datos estructurados de la mascota' },
  { provider: 'Google Cloud Platform', service: 'Infraestructura cloud, almacenamiento', region: 'EE.UU.', data: 'Datos de la plataforma' },
  { provider: 'Google Analytics', service: 'Analitica de uso (anonimizada)', region: 'EE.UU.', data: 'Datos tecnicos anonimizados' }
];

export default function LegalPage() {
  const { hash } = useLocation();

  useEffect(() => {
    const targetId = hash.replace('#', '');
    if (targetId) {
      const element = document.getElementById(targetId);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [hash]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#faf9ff] text-[#1a1b20] selection:bg-emerald-100 selection:text-[#074738]">
      <SEO 
        title="Legal - Pessy"
        description="Documentos legales de Pessy: Politica de Privacidad, Terminos y Condiciones y Acuerdo de Procesamiento de Datos."
        canonical="https://pessy.app/legal"
      />

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#b5efd9]/35 blur-[120px]" />
        <div className="absolute -right-24 top-0 h-80 w-80 rounded-full bg-[#e3dfff]/40 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#ffdad3]/25 blur-[120px]" />
      </div>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#d8e4de] bg-white/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <Logo className="size-10 transition-transform group-hover:scale-105" color="#074738" />
            <span
              className="text-2xl font-extrabold tracking-tight text-[#074738]"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
            >
              Pessy
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-10">
            {sections.map((section, i) => (
              <a 
                key={i} 
                href={`#${section.id}`} 
                className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#5e716b] transition-colors hover:text-[#074738]"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
              >
                {section.label}
              </a>
            ))}
          </div>

          <Link
            to="/inicio"
            className="rounded-full bg-[#074738] px-8 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white transition-all hover:scale-[1.02]"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
          >
            Entrar
          </Link>
        </nav>
      </header>

      <main className="relative z-10 pt-20">
        <section className="relative pt-24 pb-20 px-6">
          <div className="max-w-7xl mx-auto text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-[#dfe6e2] bg-white px-4 py-1.5 text-[#074738]"
            >
              <div className="size-1.5 rounded-full bg-[#074738]" />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.22em]"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
              >
                Legal y privacidad
              </span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight text-[#002f24]"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
            >
              Privacidad,
              <br />
              <span className="text-[#5048ca]">
                terminos y datos.
              </span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mx-auto max-w-2xl text-xl font-medium leading-relaxed text-[#404945]"
            >
              Toda la informacion legal de Pessy, en un solo lugar.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="inline-block rounded-full border border-[#dfe6e2] bg-white px-4 py-1.5"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#707975]">Ultima actualizacion: Marzo 2026</span>
            </motion.div>
          </div>
        </section>

        {/* CARDS INDEX */}
        <section className="pb-32 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card 
              href="#privacidad"
              icon={<Shield className="size-6" />}
              title="Politica de Privacidad"
              desc="Como recolectamos, usamos y protegemos tus datos y los de tu mascota."
            />
            <Card 
              href="#terminos"
              icon={<FileText className="size-6" />}
              title="Terminos y Condiciones"
              desc="Condiciones de uso del ecosistema Pessy, planes y responsabilidades."
            />
            <Card 
              href="#dpa"
              icon={<Database className="size-6" />}
              title="Acuerdo de Procesamiento"
              desc="Como tratamos datos bajo GDPR, Ley 25.326 y otras normativas internacionales."
            />
          </div>
        </section>

        {/* JURISDICTION SECTION */}
        <section className="py-32 px-6 bg-slate-50/50 border-y border-slate-100">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <p className="text-[10px] font-black tracking-[0.4em] text-[#54BD95] uppercase">ESTANDARES GLOBALES</p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-[#191A15] uppercase">Jurisdicciones aplicables</h2>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/50">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#191A15] text-white">
                      <th className="px-8 py-6 font-black tracking-widest uppercase text-[10px]">Pais / Region</th>
                      <th className="px-8 py-6 font-black tracking-widest uppercase text-[10px]">Normativa</th>
                      <th className="px-8 py-6 font-black tracking-widest uppercase text-[10px]">Autoridad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {jurisdictions.map((j, i) => (
                      <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="px-8 py-6 font-bold text-slate-900">
                          <span className="mr-3 text-lg">{j.flag}</span>
                          {j.country}
                        </td>
                        <td className="px-8 py-6 text-slate-500 font-medium">{j.regulation}</td>
                        <td className="px-8 py-6 text-slate-500 font-medium">{j.authority}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* PRIVACIDAD */}
        <DocSection 
          id="privacidad" 
          title="Politica de Privacidad" 
          meta="Ultima actualizacion: Marzo 2026 · Vigente en AR, MX, UE, USA, CA"
          onBackTop={scrollToTop}
        >
          <SectionTitle>1. Responsable del Tratamiento</SectionTitle>
          <p>Pessy es un ecosistema digital para mascotas. El tratamiento de datos personales se realiza con el fin de proveer una plataforma centralizada para tutores, co-tutores y actores del sector pet care.</p>
          <HighlightBox>
            <strong className="text-[#074738] uppercase tracking-[0.2em] text-[10px] block mb-2">Responsable</strong>
            Pessy — Ecosistema Digital para Mascotas<br />
            <strong className="text-[#074738] uppercase tracking-[0.2em] text-[10px] block mt-4 mb-2">Contacto</strong>
            <span className="underline underline-offset-8 decoration-2 decoration-emerald-200 font-black text-[#074738]">privacidad@pessy.app</span>
          </HighlightBox>

          <SectionTitle>2. Datos que Recolectamos</SectionTitle>
          <div className="space-y-6 mt-8">
            <div>
              <p className="font-black text-slate-900 uppercase text-[11px] tracking-widest mb-4">De la mascota:</p>
              <ul className="space-y-3">
                {['Nombre, especie, raza, edad, peso y fotografias.', 'Historia de cuidado, registros de vacunacion, tratamientos y rutinas.', 'Documentos procesados por inteligencia artificial.'].map((item, i) => (
                  <li key={i} className="flex gap-3 text-slate-600 font-medium">
                    <Check className="size-5 text-[#54BD95] flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-black text-slate-900 uppercase text-[11px] tracking-widest mb-4">Del tutor:</p>
              <ul className="space-y-3">
                {['Nombre y apellido.', 'Direccion de correo electronico.', 'Datos de contacto basicos.'].map((item, i) => (
                  <li key={i} className="flex gap-3 text-slate-600 font-medium">
                    <Check className="size-5 text-[#54BD95] flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <SectionTitle>3. Uso de la Informacion</SectionTitle>
          <p>Los datos se utilizan exclusivamente para:</p>
          <ul className="space-y-4 mt-6">
            {[
              'Generar y mantener el perfil de identidad digital de la mascota.',
              'Estructurar informacion y documentos mediante inteligencia artificial.',
              'Enviar recordatorios de vacunas y tratamientos.',
              'Facilitar la coordinacion entre quienes cuidan a la mascota.',
              'Mejorar la experiencia de usuario de forma agregada.'
            ].map((item, i) => (
              <li key={i} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 font-medium text-slate-600">
                <span className="flex-shrink-0 size-6 rounded-full bg-[#54BD95] text-white flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                {item}
              </li>
            ))}
          </ul>

          <SectionTitle>4. Seguridad</SectionTitle>
          <p>Pessy implementa medidas tecnicas y organizativas para proteger la integridad y confidencialidad de los datos personales, incluyendo cifrado en transito y en reposo, control de acceso basado en roles y monitoreo continuo de incidentes.</p>
          <p className="mt-4">Pessy no esta diseñado para almacenar datos que requieran niveles de seguridad bancaria o gubernamental. En caso de brecha de seguridad, los titulares afectados seran notificados dentro de los plazos establecidos.</p>

          <SectionTitle>5. Tus Derechos</SectionTitle>
          <p>Segun tu jurisdiccion, tenes derecho a acceder, rectificar o suprimir tus datos (derechos ARCO / ARSOP), oponerte al tratamiento, solicitar portabilidad y retirar el consentimiento en cualquier momento.</p>
          <HighlightBox>
            <span className="font-medium text-slate-700">Para ejercer tus derechos escribi a <strong className="text-[#074738]">privacidad@pessy.app</strong> con el asunto <strong className="text-[#074738] font-black uppercase tracking-widest">"Derechos ARCO"</strong>.</span>
          </HighlightBox>
        </DocSection>

        <hr className="max-w-3xl mx-auto border-slate-100 my-20" />

        {/* TERMINOS */}
        <DocSection 
          id="terminos" 
          title="Terminos y Condiciones de Uso" 
          meta="Ultima actualizacion: Marzo 2026"
          onBackTop={scrollToTop}
        >
          <SectionTitle>1. Aceptacion</SectionTitle>
          <p>Al acceder o utilizar Pessy, aceptas cumplir con estos Terminos y Condiciones. Si no estas de acuerdo con alguna parte de los mismos, no podras utilizar el servicio.</p>

          <SectionTitle>2. Descripcion del Servicio</SectionTitle>
          <p>Pessy es un ecosistema digital para mascotas que organiza informacion, documentos, turnos, rutinas y recordatorios. Algunas funciones pueden estructurar informacion proveniente de documentos o correos, pero Pessy no constituye un diagnostico medico ni reemplaza la consulta veterinaria profesional.</p>

          <SectionTitle>3. Responsabilidad del Usuario</SectionTitle>
          <p>El usuario es el unico responsable de la veracidad de la informacion cargada en la plataforma. Pessy no se hace responsable por errores en la informacion organizada derivados de datos incorrectos proporcionados por el tutor.</p>

          <SectionTitle>4. Limitacion Medica</SectionTitle>
          <HighlightBox>
            <strong className="text-[#074738] block mb-2 uppercase tracking-[0.2em] text-[10px]">Aviso Importante</strong>
            Pessy no es un servicio veterinario ni una herramienta de diagnostico. No sustituye la consulta con un profesional habilitado. Toda decision medica debe ser validada por un veterinario colegiado.
          </HighlightBox>
        </DocSection>

        <hr className="max-w-3xl mx-auto border-slate-100 my-20" />

        {/* DPA */}
        <DocSection 
          id="dpa" 
          title="Acuerdo de Procesamiento (DPA)" 
          meta="Version 1.0 · Marzo 2026"
          onBackTop={scrollToTop}
        >
          <p className="mb-8 font-medium">Este Acuerdo de Procesamiento de Datos (<strong className="text-[#074738]">"DPA"</strong>) rige el tratamiento de Datos Personales en el marco de la provision del ecosistema Pessy.</p>

          <SectionTitle>1. Roles</SectionTitle>
          <p>Pessy actua como <strong className="font-black text-slate-900">Encargado/Procesador</strong>. El Cliente/usuario actua como <strong className="font-black text-slate-900">Responsable/Controlador</strong>. Pessy tratara los datos unicamente segun las instrucciones del Cliente y la legislacion aplicable.</p>

          <SectionTitle>2. Obligaciones de Pessy</SectionTitle>
          <ul className="space-y-4 mt-6">
            {[
              'Tratar datos unicamente segun instrucciones documentadas.',
              'Garantizar confidencialidad del personal con acceso a datos.',
              'Implementar medidas tecnicas adecuadas al riesgo.',
              'Notificar brechas de seguridad dentro de las 72 horas.',
              'Eliminar o devolver datos al finalizar la relacion contractual.'
            ].map((item, i) => (
              <li key={i} className="flex gap-4 text-slate-600 font-medium">
                <Check className="size-5 text-[#54BD95] flex-shrink-0" /> {item}
              </li>
            ))}
          </ul>
        </DocSection>

        <hr className="max-w-3xl mx-auto border-slate-100 my-20" />

        {/* SUB-ENCARGADOS */}
        <section className="pb-32 px-6" id="subencargados">
          <div className="max-w-3xl mx-auto">
            <button onClick={scrollToTop} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#074738] mb-8 hover:opacity-70 transition-all">
              <ChevronUp size={14} /> VOLVER ARRIBA
            </button>
            <div className="space-y-4 mb-12">
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-[#191A15] uppercase">Sub-encargados Autorizados</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ultima actualizacion: Marzo 2026</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-2xl shadow-slate-200/50 mb-12">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#191A15] text-white">
                      <th className="px-6 py-4 font-black tracking-widest uppercase text-[10px]">Proveedor</th>
                      <th className="px-6 py-4 font-black tracking-widest uppercase text-[10px]">Servicio</th>
                      <th className="px-6 py-4 font-black tracking-widest uppercase text-[10px]">Region</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subProcessors.map((s, i) => (
                      <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900">{s.provider}</td>
                        <td className="px-6 py-4 text-slate-500 font-medium text-xs">{s.service}</td>
                        <td className="px-6 py-4 text-slate-500 font-medium text-xs">{s.region}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <HighlightBox>
              <span className="font-medium text-slate-600">Todos los sub-encargados de Google LLC estan cubiertos por las <strong className="text-[#074738]">Clausulas Contractuales Tipo (SCCs)</strong> aprobadas por la Comision Europea.</span>
            </HighlightBox>
          </div>
        </section>
      </main>

      <footer className="mt-16 rounded-t-[2rem] bg-[#052f27]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div
              className="text-lg font-bold text-[#f1f7f4]"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
            >
              Pessy
            </div>
            <p className="mt-1 text-xs text-[#cfe0da]">
              Tu mascota, sus cosas, todo en orden.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-3 text-xs text-[#cfe0da]">
            <Link to="/">Inicio</Link>
            <a href="#privacidad">Privacidad</a>
            <a href="#terminos">Terminos</a>
            <a href="#dpa">DPA</a>
            <a href="mailto:privacidad@pessy.app">privacidad@pessy.app</a>
          </div>
        </div>

        <div className="mx-auto max-w-7xl border-t border-[#1f4d43] px-6 pb-6 pt-4">
          <p className="text-center text-[10px] uppercase tracking-[0.16em] text-[#9ab5ad]">
            Pessy organiza informacion y acompana el cuidado diario.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Card({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <a 
      href={href}
      className="group bg-white p-10 rounded-[3rem] border border-slate-100 hover:border-[#54BD95] transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10 flex flex-col gap-8"
    >
      <div className="size-14 rounded-2xl bg-emerald-50 text-[#54BD95] flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
        {icon}
      </div>
      <div className="space-y-3">
        <h3 className="text-xl font-black tracking-tight text-[#191A15] uppercase">{title}</h3>
        <p className="text-slate-500 leading-relaxed font-medium">{desc}</p>
      </div>
      <div className="mt-auto flex items-center gap-2 text-[10px] font-black text-[#54BD95] uppercase tracking-[0.2em]">
        Leer documento <ChevronRight className="size-4" />
      </div>
    </a>
  );
}

function DocSection({ id, title, meta, onBackTop, children }: { id: string; title: string; meta: string; onBackTop: () => void; children: React.ReactNode }) {
  return (
    <section className="py-24 px-6" id={id}>
      <div className="max-w-3xl mx-auto">
        <button onClick={onBackTop} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#074738] mb-8 hover:opacity-70 transition-all">
          <ChevronUp size={14} /> VOLVER ARRIBA
        </button>
        <div className="space-y-4 mb-16 border-b-4 border-slate-50 pb-12">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-[#191A15] uppercase leading-none">{title}</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#54BD95]">{meta}</p>
        </div>
        <div className="text-slate-600 leading-relaxed text-lg space-y-6 font-medium">
          {children}
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-4 text-[#191A15] font-black tracking-tighter text-2xl mt-16 mb-6 uppercase">
      <div className="w-2 h-8 bg-[#54BD95] rounded-full" />
      {children}
    </h3>
  );
}

function HighlightBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-emerald-50/50 border-l-8 border-[#54BD95] rounded-r-[2rem] p-10 my-12 text-slate-800 text-lg leading-relaxed shadow-sm">
      {children}
    </div>
  );
}
