import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "motion/react";
import {
  Camera,
  ArrowRight,
  Smartphone,
  Shield,
  History,
  Heart,
  Settings,
  Bell,
  ChevronRight,
  Zap,
  Bell as BellIcon,
  Check,
  Linkedin,
  Mail,
  ExternalLink,
  Cpu,
  Users,
  LayoutGrid
} from "lucide-react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { ImageWithFallback } from "../components/ImageWithFallback";
import { Logo } from "../components/Logo";
import { SEO } from "../components/SEO";
import { HistoryMockup, MedicationMockup, VaccinesMockup } from "../components/AppMockups";

// Traducciones para la Landing Page
const traducciones = {
  es: {
    hero: {
      title: "Porque quererlo ya es suficiente trabajo.",
      subtitle: "Pessy lo maneja. Vos lo disfrutás. Porque quererlo ya es suficiente trabajo.",
      tagline: "SU HISTORIA COMIENZA AQUI.",
      cta: "Probar ahora"
    },
    section2: {
      title: "Identidad digital",
      subtitle: "Su historia comienza aqui.",
      body: "Un solo lugar para sus documentos, sus momentos importantes y todo lo que queres tener a mano.",
      features: [
        { title: "Todo en orden", desc: "Su perfil, sus papeles y sus recuerdos, siempre disponibles." },
        { title: "Listo para compartir", desc: "Su informacion a mano para familia, guarderia, viajes o quien la acompane." }
      ]
    },
    section3: {
      title: "Rutinas, compras y recordatorios",
      subtitle: "Un lugar para sus rutinas, sus compras y lo que viene.",
      features: [
        { title: "Pessy te cuida y acompana", desc: "Te recuerda lo importante y te ayuda a seguirle el ritmo." },
        { title: "Compras a tiempo", desc: "Tenes presente cuando toca reponer lo que usa todos los dias." },
        { title: "Todo visible", desc: "Cada pendiente en un mismo lugar, sin vueltas." }
      ]
    },
    section4: {
      title: "Cuidados y carnet digital",
      subtitle: "Sus vacunas, sus cuidados y su dia a dia, siempre a mano.",
      body: "Pessy reune sus vacunas y sus cuidados recurrentes en una identidad digital simple de consultar, compartir y seguir.",
      features: [
        { title: "Cronograma visual", desc: "Todas las dosis aplicadas y las que vienen, en un solo lugar." },
        { title: "Alertas anticipadas", desc: "Te avisamos una semana antes de cada refuerzo." },
        { title: "Carnet digital", desc: "En tu celular, listo para viajes, guarderia o cualquier tramite." }
      ]
    },
    vision: {
      eyebrow: "ECOSISTEMA DIGITAL",
      title: "Su identidad digital vive en Pessy.",
      body1: "Pessy conecta su perfil, sus rutinas, sus compras, sus vacunas, sus turnos, sus documentos y sus recordatorios.",
      body2: "Un ecosistema digital para acompanar su dia a dia con todo en orden.",
      body3: "",
      body4: "",
      highlight: "Porque quererlo ya es suficiente trabajo.",
      chips: ["Identidad digital", "Ecosistema digital", "Perfil vivo", "Siempre disponible"]
    },
    pricing: {
      eyebrow: "Beta · Acceso exclusivo",
      title: "Planes de acceso",
      subtitle: "Los que entran en beta se quedan con el precio de por vida.",
      plans: [
        {
          name: "GRATIS",
          price: "$0",
          period: "para siempre",
          features: ["1 mascota", "carnet digital", "perfil de identidad", "documentos ilimitados"],
          cta: "Empezar gratis",
          popular: false
        },
        {
          name: "PREMIUM BETA",
          price: "Consultar",
          period: "mensual",
          badge: "MAS POPULAR",
          badge2: "Precio congelado al lanzamiento",
          features: ["1 mascota", "Reconocimiento ilimitado", "alertas instantaneas", "perfil completo", "co-tutores"],
          cta: "Consultar",
          popular: true
        },
        {
          name: "FAMILIAR BETA",
          price: "Consultar",
          period: "mensual",
          badge2: "Precio congelado al lanzamiento",
          features: ["hasta 4 mascotas", "todo de Premium", "perfil familiar"],
          cta: "Consultar",
          popular: false
        }
      ]
    },
    team: {
      eyebrow: "EL EQUIPO",
      title: "Las personas detras de Pessy.",
      subtitle: "Construyendo un ecosistema digital para mascotas.",
      members: [
        {
          name: "Mauri",
          role: "COFUNDADOR",
          image: "/team/mauri-real.jpeg",
          linkedin: "https://www.linkedin.com/in/mauriciogoitia/"
        },
        {
          name: "Ronald",
          role: "COFUNDADOR",
          image: "https://media.licdn.com/dms/image/v2/D4D03AQGEb7DhO681gw/profile-displayphoto-crop_800_800/B4DZwPn2W8GUAI-/0/1769788632610?e=1774483200&v=beta&t=vBPHfR92eEAl8Rww4-eGayc61kCqdt8Cn-4C_zYvF7Q",
          linkedin: "https://www.linkedin.com/in/ronaldacarvajal/"
        },
        {
          name: "Ary",
          role: "MARKETING",
          image: "https://media.licdn.com/dms/image/v2/D4D03AQFpZ54-bZ_rkg/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1722288671526?e=1774483200&v=beta&t=tvpQdEQxjWcWlY_BsPPnq9wpNyhMuusLy0hNVSD53oE",
          linkedin: "https://www.linkedin.com/in/ariannysbermudez/"
        },
        {
          name: "Thor",
          role: "CEO",
          image: "/team/founder-3.jpg",
          linkedin: "https://www.linkedin.com/company/pessy-app"
        }
      ]
    },
    notifs: [
      { title: "Rutina de hoy", body: "Thor ya tiene en orden su paseo, su recordatorio y su proxima compra.", time: "AHORA" },
      { title: "Recordatorio", body: "Manana 10:30hs tenes un turno agendado para Thor.", time: "AHORA" },
      { title: "Identidad actualizada", body: "Se ordeno el ultimo documento de Thor en su perfil.", time: "AHORA" }
    ],
    footer: {
      slogan: "Pessy lo maneja. Vos lo disfrutás.",
      nav: ["Identidad", "Cuidados", "Rutinas", "Entrar"],
      legal: ["Politica de Privacidad", "Terminos y Condiciones"]
    }
  },
  pt: {
    hero: {
      title: "Seu pet, as coisas dele, tudo em ordem.",
      subtitle: "A historia dele comeca aqui. Pessy e sua identidade digital em um ecossistema digital com rotinas, compras, vacinas, compromissos, documentos e lembretes.",
      tagline: "A HISTORIA DELE COMECA AQUI.",
      cta: "Testar agora"
    },
    section2: {
      title: "Identidade digital",
      subtitle: "A historia dele comeca aqui.",
      body: "Um so lugar para os documentos, momentos importantes e tudo o que voce quer ter a mao.",
      features: [
        { title: "Tudo em ordem", desc: "O perfil, os papeis e as lembrancas dele, sempre disponiveis." },
        { title: "Pronto para compartilhar", desc: "Com familia, creche, viagens ou quem cuida dele." }
      ]
    },
    section3: {
      title: "Rotinas, compras e lembretes",
      subtitle: "Um lugar para as rotinas, as compras e o que vem depois.",
      features: [
        { title: "Pessy cuida e acompanha", desc: "Te lembra do importante e ajuda a manter o ritmo." },
        { title: "Compras na hora certa", desc: "Voce sabe quando repor o que ele usa todos os dias." },
        { title: "Tudo visivel", desc: "Cada pendencia em um so lugar, sem confusao." }
      ]
    },
    section4: {
      title: "Cuidados e cartao digital",
      subtitle: "As vacinas, os cuidados e o dia a dia dele, sempre a mao.",
      body: "Pessy reune as vacinas e os cuidados recorrentes do seu pet em uma identidade digital simples de consultar, compartilhar e acompanhar.",
      features: [
        { title: "Cronograma visual", desc: "Todas as doses aplicadas e as proximas, em um so lugar." },
        { title: "Alertas antecipados", desc: "Te avisamos uma semana antes de cada reforco." },
        { title: "Cartao digital", desc: "No seu celular, pronto para viagens, creche ou qualquer tramite." }
      ]
    },
    vision: {
      eyebrow: "ECOSSISTEMA DIGITAL",
      title: "A identidade digital dele vive na Pessy.",
      body1: "Pessy conecta o perfil, as rotinas, as compras, as vacinas, os compromissos, os documentos e os lembretes do seu pet.",
      body2: "Um ecossistema digital para acompanhar o dia a dia dele com tudo em ordem.",
      body3: "",
      body4: "",
      highlight: "Pessy cuida e acompanha, com tudo em ordem.",
      chips: ["Identidade digital", "Ecossistema digital", "Perfil vivo", "Sempre disponivel"]
    },
    pricing: {
      eyebrow: "Beta · Preco de pioneiro",
      title: "Planos de acesso",
      subtitle: "Os que entram no beta ficam com o preco para sempre.",
      plans: [
        {
          name: "GRATIS",
          price: "$0",
          period: "para sempre",
          features: ["1 pet", "cartao digital", "perfil de identidade", "documentos ilimitados"],
          cta: "Comecar gratis",
          popular: false
        },
        {
          name: "PREMIUM BETA",
          price: "Consultar",
          period: "mensal",
          badge: "MAIS POPULAR",
          badge2: "Preco congelado no lancamento",
          features: ["1 pet", "Reconhecimento ilimitado", "alertas instantaneas", "perfil completo", "co-tutores"],
          cta: "Consultar",
          popular: true
        },
        {
          name: "FAMILIAR BETA",
          price: "Consultar",
          period: "mensal",
          badge2: "Preco congelado no lancamento",
          features: ["ate 4 pets", "tudo do Premium", "perfil familiar"],
          cta: "Consultar",
          popular: false
        }
      ]
    },
    team: {
      eyebrow: "A EQUIPE",
      title: "As personas detras de Pessy.",
      subtitle: "Construindo um ecossistema digital para pets.",
      members: [
        {
          name: "Mauri",
          role: "COFUNDADOR",
          image: "/team/mauri-real.jpeg",
          linkedin: "https://www.linkedin.com/in/mauriciogoitia/"
        },
        {
          name: "Ronald",
          role: "COFUNDADOR",
          image: "https://media.licdn.com/dms/image/v2/D4D03AQGEb7DhO681gw/profile-displayphoto-crop_800_800/B4DZwPn2W8GUAI-/0/1769788632610?e=1774483200&v=beta&t=vBPHfR92eEAl8Rww4-eGayc61kCqdt8Cn-4C_zYvF7Q",
          linkedin: "https://www.linkedin.com/in/ronaldacarvajal/"
        },
        {
          name: "Ary",
          role: "MARKETING",
          image: "https://media.licdn.com/dms/image/v2/D4D03AQFpZ54-bZ_rkg/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1722288671526?e=1774483200&v=beta&t=tvpQdEQxjWcWlY_BsPPnq9wpNyhMuusLy0hNVSD53oE",
          linkedin: "https://www.linkedin.com/in/ariannysbermudez/"
        },
        {
          name: "Thor",
          role: "CEO",
          image: "/team/founder-3.jpg",
          linkedin: "https://www.linkedin.com/company/pessy-app"
        }
      ]
    },
    notifs: [
      { title: "Vacina vencendo", body: "A quintupla de Thor vence em 3 dias.", time: "AGORA" },
      { title: "Lembrete", body: "Amanha 10:30hs Consulta com Dr Garcia.", time: "AGORA" },
      { title: "Perfil atualizado", body: "O ultimo documento de Thor foi organizado.", time: "AGORA" }
    ],
    footer: {
      slogan: "Seu pet, as coisas dele, tudo em ordem",
      nav: ["Identidade", "Cuidados", "Rotinas", "Entrar"],
      legal: ["Politica de Privacidade", "Terminos e Condicoes"]
    }
  },
  en: {
    hero: {
      title: "Your pet, their things, all in order.",
      subtitle: "Their story starts here. Pessy is a digital ecosystem for pets that organizes their identity, routines, purchases, vaccinations, records, and caregivers.",
      tagline: "THEIR STORY STARTS HERE.",
      cta: "Try now"
    },
    section2: {
      title: "Digital identity",
      subtitle: "Their story starts here.",
      body: "One place for their documents, their key moments and everything you want to keep close.",
      features: [
        { title: "Everything in order", desc: "Their profile, papers and memories, always available." },
        { title: "Ready to share", desc: "With family, daycare, travel or anyone who helps care for them." }
      ]
    },
    section3: {
      title: "Routines, shopping and reminders",
      subtitle: "One place for their routines, their shopping and what comes next.",
      features: [
        { title: "Pessy cares and supports", desc: "It reminds you about what matters and helps you keep pace." },
        { title: "Shopping on time", desc: "Know when it is time to restock what they use every day." },
        { title: "Everything visible", desc: "Every pending item in one place, without friction." }
      ]
    },
    section4: {
      title: "Care and digital card",
      subtitle: "Their vaccines, care and daily life, always within reach.",
      body: "Pessy brings together vaccines and recurring care in a digital identity that is simple to check, share and follow.",
      features: [
        { title: "Visual schedule", desc: "All doses applied and upcoming ones, in one place." },
        { title: "Early alerts", desc: "We notify you one week before each booster." },
        { title: "Digital card", desc: "On your phone, ready for travel, daycare or any paperwork." }
      ]
    },
    vision: {
      eyebrow: "DIGITAL ECOSYSTEM",
      title: "Their digital identity lives in Pessy.",
      body1: "Pessy connects your pet's profile, routines, shopping, vaccines, appointments, documents and reminders.",
      body2: "A digital ecosystem to support their day to day with everything in order.",
      body3: "",
      body4: "",
      highlight: "Pessy cares and supports, with everything in order.",
      chips: ["Digital identity", "Digital ecosystem", "Living profile", "Always available"]
    },
    pricing: {
      eyebrow: "Beta · Exclusive access",
      title: "Access Plans",
      subtitle: "Beta users keep their price for life.",
      plans: [
        {
          name: "FREE",
          price: "$0",
          period: "forever",
          features: ["1 pet", "digital card", "identity profile", "unlimited documents"],
          cta: "Start free",
          popular: false
        },
        {
          name: "PREMIUM BETA",
          price: "Inquire",
          period: "monthly",
          badge: "MOST POPULAR",
          badge2: "Price frozen at launch",
          features: ["1 pet", "Unlimited recognition", "instant alerts", "full profile", "co-owners"],
          cta: "Inquire",
          popular: true
        },
        {
          name: "FAMILY BETA",
          price: "Inquire",
          period: "monthly",
          badge2: "Price frozen at launch",
          features: ["up to 4 pets", "everything in Premium", "family profile"],
          cta: "Inquire",
          popular: false
        }
      ]
    },
    team: {
      eyebrow: "THE TEAM",
      title: "The people behind Pessy.",
      subtitle: "Building a digital ecosystem for pets.",
      members: [
        {
          name: "Mauri",
          role: "COFOUNDER",
          image: "/team/mauri-real.jpeg",
          linkedin: "https://www.linkedin.com/in/mauriciogoitia/"
        },
        {
          name: "Ronald",
          role: "COFOUNDER",
          image: "https://media.licdn.com/dms/image/v2/D4D03AQGEb7DhO681gw/profile-displayphoto-crop_800_800/B4DZwPn2W8GUAI-/0/1769788632610?e=1774483200&v=beta&t=vBPHfR92eEAl8Rww4-eGayc61kCqdt8Cn-4C_zYvF7Q",
          linkedin: "https://www.linkedin.com/in/ronaldacarvajal/"
        },
        {
          name: "Ary",
          role: "MARKETING",
          image: "https://media.licdn.com/dms/image/v2/D4D03AQFpZ54-bZ_rkg/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1722288671526?e=1774483200&v=beta&t=tvpQdEQxjWcWlY_BsPPnq9wpNyhMuusLy0hNVSD53oE",
          linkedin: "https://www.linkedin.com/in/ariannysbermudez/"
        },
        {
          name: "Thor",
          role: "CEO",
          image: "/team/founder-3.jpg",
          linkedin: "https://www.linkedin.com/company/pessy-app"
        }
      ]
    },
    notifs: [
      { title: "Vaccine expiring", body: "Thor's quintuple expires in 3 days.", time: "NOW" },
      { title: "Reminder", body: "Tomorrow 10:30am Appointment with Dr Garcia.", time: "NOW" },
      { title: "History Updated", body: "The latest blood test was processed.", time: "NOW" }
    ],
    footer: {
      slogan: "Your pet, their things, all in order",
      nav: ["Identity", "Care", "Routines", "Sign in"],
      legal: ["Privacy Policy", "Terms and Conditions"]
    }
  }
};

export default function LandingPage() {
  const { user, loading: authLoading } = useAuth();

  // Si el usuario ya está logueado, redirigir directo a la app
  if (!authLoading && user) {
    return <Navigate to="/home" replace />;
  }

  const [time, setTime] = useState(new Date());
  const [deviceType, setDeviceType] = useState<'ios' | 'android'>('ios');
  const [activeNotification, setActiveNotification] = useState(0);
  const [lang, setLang] = useState<'es' | 'pt' | 'en'>('es');

  useEffect(() => {
    // Deteccion automatica de idioma
    const browserLang = navigator.language.split('-')[0];
    const savedLang = localStorage.getItem('pessy-lang') as any;

    if (savedLang && traducciones[savedLang as keyof typeof traducciones]) {
      setLang(savedLang);
    } else if (traducciones[browserLang as keyof typeof traducciones]) {
      setLang(browserLang as any);
      localStorage.setItem('pessy-lang', browserLang);
    } else {
      setLang('en');
      localStorage.setItem('pessy-lang', 'en');
    }

    const timer = setInterval(() => setTime(new Date()), 1000);
    const notifTimer = setInterval(() => {
      setActiveNotification(prev => (prev + 1) % 3);
    }, 4000);

    // Deteccion de sistema operativo
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    if (/android/i.test(userAgent)) {
      setDeviceType('android');
    }

    return () => {
      clearInterval(timer);
      clearInterval(notifTimer);
    };
  }, []);

  const t = traducciones[lang];

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    };
    const formatted = date.toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-BR' : 'es-AR', options);
    return (formatted.charAt(0).toUpperCase() + formatted.slice(1)).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['Manrope'] selection:bg-emerald-100 selection:text-[#074738] overflow-x-hidden text-slate-900">
      <SEO
        title="Pessy - Tu mascota, sus cosas, todo en orden"
        description="Su historia comienza aqui. Pessy organiza su identidad digital, sus rutinas, sus compras, sus vacunas, sus turnos y sus documentos en un ecosistema digital para mascotas."
        keywords="mascota, identidad digital, ecosistema digital para mascotas, rutinas, compras, vacunas, turnos, tecnologia, pet care"
        canonical="https://pessy.app/"
      />

      <header
        className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100"
        role="banner"
      >
        <nav className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between" aria-label="Navegacion principal">
          <Link
            to="/"
            className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#074738] focus:ring-offset-2 rounded-lg"
          >
            <Logo className="size-8" color="#074738" />
            <span className="text-lg font-black tracking-tight text-[#074738]">Pessy</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <a href="#historial" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#074738] transition-colors">{t.footer.nav[0]}</a>
            <a href="#vacunas" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#074738] transition-colors">{t.footer.nav[1]}</a>
            <a href="#medicacion" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#074738] transition-colors">{t.footer.nav[2]}</a>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const langs: Array<'es' | 'pt' | 'en'> = ['es', 'pt', 'en'];
                const currentIndex = langs.indexOf(lang);
                setLang(langs[(currentIndex + 1) % langs.length]);
              }}
              className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-[#074738] transition-colors uppercase"
            >
              {lang.toUpperCase()}
            </button>

            <Link
              to="/inicio"
              className="px-5 py-1.5 text-[10px] font-black text-[#074738] bg-[#e0f2f1] rounded-full hover:bg-emerald-100 transition-all uppercase tracking-widest"
            >
              ENTRAR
            </Link>
          </div>
        </nav>
      </header>

      <main id="main-content" className="pt-14">
        {/* Hero Section */}
        <section className="relative py-10 md:py-16 px-6 overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div className="space-y-6 text-center lg:text-left">
                <div className="space-y-3">
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1a9b7d]"
                  >
                    {t.hero.tagline}
                  </motion.p>
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05] text-slate-900"
                  >
                    {t.hero.title}
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-lg md:text-xl text-slate-400 font-medium leading-relaxed max-w-lg mx-auto lg:mx-0"
                  >
                    {t.hero.subtitle}
                  </motion.p>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
                >
                  <Link
                    to="/inicio"
                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#1a9b7d] text-white rounded-full font-black text-base shadow-lg shadow-[#1a9b7d]/10 hover:scale-105 active:scale-95 transition-all"
                  >
                    {t.hero.cta}
                    <ArrowRight size={18} />
                  </Link>
                </motion.div>
              </div>

              <div className="relative order-first lg:order-last">
                <div className="absolute inset-0 bg-[#074738]/5 rounded-full blur-[100px] scale-150" />

                {/* iPhone Mockup */}
                <div className="relative mx-auto w-full max-w-[260px] md:max-w-[300px] aspect-[9/19.5] bg-[#0c0c0c] rounded-[3.5rem] p-1 shadow-2xl ring-1 ring-white/10">
                  <div className="w-full h-full rounded-[3.3rem] bg-black p-1.5 overflow-hidden">
                    <div className="w-full h-full rounded-[3rem] overflow-hidden bg-black relative">
                      <ImageWithFallback
                        src="https://images.unsplash.com/photo-1686419682443-5050ca21098d?auto=format&fit=crop&q=80&w=800"
                        alt="Vista previa de Pessy"
                        className="absolute inset-0 w-full h-full object-cover brightness-[0.85]"
                      />

                      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-[100]" />

                      <div className="absolute inset-0 flex flex-col items-center pt-16 px-6 z-30 font-sans">
                        <div className="text-white text-center space-y-0.5">
                          <p className="text-[10px] font-bold opacity-80">{formatDate(time)}</p>
                          <h3 className="text-5xl md:text-6xl font-black tracking-tighter leading-none">{formatTime(time)}</h3>
                        </div>

                        <div className="mt-auto w-full h-20 mb-10 relative">
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={activeNotification}
                              initial={{ y: 30, opacity: 0, scale: 0.95 }}
                              animate={{ y: 0, opacity: 1, scale: 1 }}
                              exit={{ y: -5, opacity: 0 }}
                              className="absolute inset-0 bg-white/[0.12] backdrop-blur-xl p-3 rounded-[1.8rem] border border-white/15"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  <div className="size-4 bg-white rounded flex items-center justify-center p-0.5">
                                    <Logo className="size-full" color="#074738" />
                                  </div>
                                  <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">PESSY</span>
                                </div>
                                <span className="text-[8px] font-bold text-white/40">{t.notifs[activeNotification].time}</span>
                              </div>
                              <div className="space-y-0.5">
                                <div className="text-[10px] font-bold text-white leading-tight">
                                  {t.notifs[activeNotification].title}
                                </div>
                                <div className="text-[9px] text-white/80 leading-tight line-clamp-2">
                                  {t.notifs[activeNotification].body}
                                </div>
                              </div>
                            </motion.div>
                          </AnimatePresence>
                        </div>

                        <div className="flex justify-between w-full opacity-60 mb-6 px-2">
                          <Camera size={16} className="text-white" />
                          <Shield size={16} className="text-white" />
                        </div>
                      </div>
                      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-white/20 rounded-full z-[100]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Medical History Section */}
        <section id="historial" className="py-10 md:py-16 px-6 bg-[#F8FAFC]">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 items-center mb-10">
              <div className="space-y-5">
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="space-y-3"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1a9b7d]">
                    {t.section2.title}
                  </p>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-slate-900">
                    {t.section2.subtitle}
                  </h2>
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="text-lg text-slate-500 font-medium leading-relaxed max-w-xl"
                >
                  {t.section2.body}
                </motion.p>
              </div>

              <div className="relative group">
                <div className="absolute inset-0 bg-emerald-100/50 rounded-[2rem] blur-2xl group-hover:blur-3xl transition-all duration-500" />
                <div className="relative aspect-[4/3] max-w-[400px] mx-auto rounded-[2rem] overflow-hidden border border-slate-100 shadow-xl bg-white">
                  <HistoryMockup />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {t.section2.features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-6 bg-white border border-slate-100 rounded-3xl space-y-4 hover:shadow-lg hover:border-emerald-100 transition-all group"
                >
                  <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#1a9b7d] group-hover:bg-[#1a9b7d] group-hover:text-white transition-colors">
                    {i === 0 ? <LayoutGrid size={20} /> : <Shield size={20} />}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-black tracking-tight text-slate-900">{feature.title}</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Medication Control Section */}
        <section id="medicacion" className="py-10 md:py-16 px-6 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 items-center mb-10">
              <div className="relative order-last lg:order-first group">
                <div className="absolute inset-0 bg-emerald-100/30 rounded-[2rem] blur-2xl group-hover:blur-3xl transition-all duration-500" />
                <div className="relative aspect-[4/3] max-w-[400px] mx-auto rounded-[2rem] overflow-hidden border border-slate-100 shadow-xl bg-slate-50">
                  <MedicationMockup />
                </div>
              </div>

              <div className="space-y-5">
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="space-y-3"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1a9b7d]">
                    {t.section3.title}
                  </p>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-slate-900">
                    {t.section3.subtitle}
                  </h2>
                </motion.div>

                <div className="space-y-3 pt-2">
                  {t.section3.features.map((feature, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors group"
                    >
                      <div className="size-8 mt-1 rounded-lg bg-emerald-50 text-[#1a9b7d] flex items-center justify-center group-hover:bg-[#1a9b7d] group-hover:text-white transition-colors flex-shrink-0">
                        {i === 0 ? <Bell size={16} /> : i === 1 ? <Zap size={16} /> : <LayoutGrid size={16} />}
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-slate-900">{feature.title}</h4>
                        <p className="text-xs text-slate-500 font-medium">{feature.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Vaccination Calendar Section */}
        <section id="vacunas" className="py-10 md:py-16 px-6 bg-[#F8FAFC] border-t border-slate-50">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 items-center mb-10">
              <div className="space-y-5">
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="space-y-3"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1a9b7d]">
                    {t.section4.title}
                  </p>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-slate-900">
                    {t.section4.subtitle}
                  </h2>
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="text-lg text-slate-500 font-medium leading-relaxed max-w-xl"
                >
                  {t.section4.body}
                </motion.p>
              </div>

              <div className="relative group">
                <div className="absolute inset-0 bg-emerald-100/50 rounded-[2rem] blur-2xl group-hover:blur-3xl transition-all duration-500" />
                <div className="relative aspect-[4/3] max-w-[400px] mx-auto rounded-[2rem] overflow-hidden border border-slate-100 shadow-xl bg-white">
                  <VaccinesMockup />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {t.section4.features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-6 bg-white border border-slate-100 rounded-3xl space-y-4 hover:shadow-lg hover:border-emerald-100 transition-all group"
                >
                  <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#1a9b7d] group-hover:bg-[#1a9b7d] group-hover:text-white transition-colors">
                    {i === 0 ? <LayoutGrid size={20} /> : i === 1 ? <Bell size={20} /> : <Smartphone size={20} />}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-black tracking-tight text-slate-900">{feature.title}</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Vision Section */}
        <section className="py-10 md:py-16 px-6 bg-white overflow-hidden relative border-t border-slate-50">
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="space-y-3"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1a9b7d]">
                    {t.vision.eyebrow}
                  </p>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-slate-900">
                    {t.vision.title}
                  </h2>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="space-y-4 text-base md:text-lg text-slate-500 leading-relaxed font-medium"
                >
                  <p>{t.vision.body1} {t.vision.body2}</p>
                  {t.vision.body3 && <p>{t.vision.body3}</p>}
                  {t.vision.body4 && <p>{t.vision.body4}</p>}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-wrap gap-2 pt-1"
                >
                  {t.vision.chips.map((chip, i) => (
                    <span key={i} className="px-4 py-2 bg-slate-50 border border-slate-100 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {chip}
                    </span>
                  ))}
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="p-8 md:p-10 bg-emerald-50 border border-emerald-100 rounded-[2.5rem] space-y-5 relative"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-[#074738] rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-200">
                  <Zap size={10} />
                  TECNOLOGIA PROPIA
                </div>
                <p className="text-xl md:text-2xl font-black tracking-tight text-[#074738] leading-[1.3]">
                  "{t.vision.highlight}"
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-10 md:py-16 px-6 bg-[#F8FAFC] border-y border-slate-100">
          <div className="max-w-7xl mx-auto space-y-10">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1a9b7d]"
              >
                {t.pricing.eyebrow}
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl md:text-4xl font-black tracking-tight text-slate-900"
              >
                {t.pricing.title}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-base text-slate-400 font-medium"
              >
                {t.pricing.subtitle}
              </motion.p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 items-stretch pt-2">
              {t.pricing.plans.map((plan, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`relative p-6 rounded-[2rem] border flex flex-col transition-all hover:translate-y-[-4px] ${plan.popular
                      ? 'bg-white text-slate-900 border-[#074738] shadow-xl z-10 border-2'
                      : 'bg-white text-slate-900 border-slate-100'
                    }`}
                >
                  {plan.badge && (
                    <div className="absolute top-[-12px] left-1/2 -translate-x-1/2 bg-[#074738] text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest whitespace-nowrap shadow-md">
                      ⭐ {plan.badge}
                    </div>
                  )}

                  <div className="space-y-4 flex-1">
                    <div className="space-y-1">
                      <p className={`text-[9px] font-black uppercase tracking-widest ${plan.popular ? 'text-[#074738]' : 'text-slate-300'}`}>
                        {plan.name}
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black tracking-tight">{plan.price}</span>
                        <span className={`text-[10px] font-bold text-slate-300`}>/ {plan.period}</span>
                      </div>
                      {plan.badge2 && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full text-[8px] font-black">
                          🔒 {plan.badge2}
                        </div>
                      )}
                    </div>

                    <ul className="space-y-2 pt-2">
                      {plan.features.map((feature, j) => (
                        <li key={j} className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          <Check size={14} className="text-emerald-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6">
                    <Link
                      to={plan.price === "$0" ? "/app" : "mailto:it@pessy.app"}
                      className={`w-full py-2.5 rounded-full font-black text-center text-[10px] uppercase tracking-widest transition-all block ${plan.popular
                          ? 'bg-[#074738] text-white hover:bg-slate-800'
                          : 'bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100'
                        }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Team Section */}
        {/* Team Section - Refined & Coherent with Pessy Identity */}
        <section className="py-24 md:py-32 px-6 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-4 mb-20 text-center lg:text-left">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1a9b7d]"
              >
                {t.team.eyebrow}
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 leading-none"
              >
                {t.team.title}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-lg text-slate-400 font-medium max-w-xl mx-auto lg:mx-0"
              >
                {t.team.subtitle}
              </motion.p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {t.team.members.map((member, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group relative"
                >
                  <div className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden bg-slate-100 border border-slate-100 group-hover:border-[#1a9b7d]/20 transition-all duration-700">
                    <ImageWithFallback
                      src={member.image}
                      alt={member.name}
                      className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-[1.05] group-hover:scale-100"
                    />

                    {/* Overlay Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                    {/* Social/Role Overlay */}
                    <div className="absolute inset-0 p-6 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
                      <div className="flex justify-between items-start">
                        <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                          <span className="text-[8px] font-black uppercase tracking-widest text-white">
                            {member.role}
                          </span>
                        </div>
                        {(member as any).linkedin && (
                          <a
                            href={(member as any).linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="size-8 bg-white text-[#074738] rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                          >
                            <Linkedin size={14} />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Default Role Label - Top Left (Visible when not hovered) */}
                    <div className="absolute top-6 left-6 group-hover:opacity-0 transition-opacity duration-300">
                      <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white">
                          {member.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-1">
                    <h4 className="text-xl font-black tracking-tight text-slate-900 leading-none">{member.name}</h4>
                    <div className="flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-[#1a9b7d]"></div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#1a9b7d]">Active Team</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 bg-white border-t border-slate-100">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
              <div className="space-y-5 lg:col-span-2">
                <Link to="/" className="flex items-center gap-2">
                  <Logo className="size-8" color="#074738" />
                  <span className="text-xl font-black tracking-tight text-[#074738]">Pessy</span>
                </Link>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 max-w-xs">
                  {t.footer.slogan}
                </p>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">Contacto</p>
                  <a href="mailto:it@pessy.app" className="text-xs font-bold text-[#1a9b7d] flex items-center gap-1.5 hover:opacity-70 transition-opacity">
                    <Mail size={14} />
                    it@pessy.app
                  </a>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">Explorar</p>
                <div className="flex flex-col gap-2.5">
                  <a href="#historial" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#074738] transition-colors">{t.footer.nav[0]}</a>
                  <a href="#vacunas" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#074738] transition-colors">{t.footer.nav[1]}</a>
                  <a href="#medicacion" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#074738] transition-colors">{t.footer.nav[2]}</a>
                  <Link to="/inicio" className="text-[10px] font-black uppercase tracking-widest text-[#1a9b7d] hover:opacity-70 transition-opacity">{t.footer.nav[3]}</Link>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">Legal</p>
                <div className="flex flex-col gap-2.5">
                  <Link to="/privacidad" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#074738] transition-colors">{t.footer.legal[0]}</Link>
                  <Link to="/terminos" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#074738] transition-colors">{t.footer.legal[1]}</Link>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-200">
                © 2026 ECOSISTEMA PESSY
              </p>
              <div className="flex items-center gap-4">
                <span className="size-1.5 bg-[#1a9b7d] rounded-full animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Identidad: activa</span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
