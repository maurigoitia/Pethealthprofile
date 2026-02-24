import { useState } from "react";
import { MaterialIcon } from "./MaterialIcon";

interface HelpSupportScreenProps {
  onBack: () => void;
}

interface FAQItem {
  question: string;
  answer: string;
}

export function HelpSupportScreen({ onBack }: HelpSupportScreenProps) {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    {
      question: "¿Cómo agrego un documento médico?",
      answer:
        'Toca el botón "+" en la parte inferior central de la pantalla, luego selecciona "Escanear con Cámara" o "Seleccionar Archivo". PESSY procesará automáticamente el documento y lo agregará al historial.',
    },
    {
      question: "¿Qué tipos de documentos puedo subir?",
      answer:
        "Puedes subir comprobantes de vacunación, análisis de laboratorio, radiografías, recetas médicas, estudios cardíacos y cualquier otro documento veterinario en formato imagen (JPG, PNG) o PDF.",
    },
    {
      question: "¿Cómo cambio de mascota activa?",
      answer:
        'En la pantalla principal, toca la foto de tu mascota o el nombre en la parte superior. Se abrirá el selector de mascotas donde podrás elegir a cuál quieres ver.',
    },
    {
      question: "¿Los documentos están seguros?",
      answer:
        "Sí. Todos los documentos se almacenan de forma segura y solo tú tienes acceso a ellos. Puedes verificar la integridad de los reportes médicos exportados mediante códigos QR y hash de verificación.",
    },
    {
      question: "¿Cómo exporto un reporte médico?",
      answer:
        'En la sección "Historial", toca el ícono de documento en la esquina superior derecha. Selecciona el tipo de reporte que deseas generar y compártelo vía email, WhatsApp u otras apps.',
    },
  ];

  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen">
      <div className="max-w-md mx-auto pb-8">
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
              Ayuda y Soporte
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* FAQ Section */}
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">
              Preguntas frecuentes
            </h2>
            <div className="space-y-2">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white text-left">
                      {faq.question}
                    </h3>
                    <MaterialIcon
                      name={expandedFAQ === index ? "expand_less" : "expand_more"}
                      className="text-slate-400 shrink-0"
                    />
                  </button>
                  {expandedFAQ === index && (
                    <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Contact Section */}
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">
              Contacto
            </h2>
            <div className="space-y-3">
              {/* Email */}
              <a
                href="mailto:soporte@pessy.app"
                className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="size-10 rounded-lg bg-[#2b7cee]/10 flex items-center justify-center">
                  <MaterialIcon name="email" className="text-[#2b7cee] text-xl" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Email de soporte
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    soporte@pessy.app
                  </p>
                </div>
                <MaterialIcon name="chevron_right" className="text-slate-400" />
              </a>

              {/* WhatsApp */}
              <a
                href="https://wa.me/5491112345678"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <MaterialIcon name="chat" className="text-emerald-500 text-xl" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    WhatsApp
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Chatea con nosotros
                  </p>
                </div>
                <MaterialIcon name="open_in_new" className="text-slate-400" />
              </a>
            </div>
          </div>

          {/* App Version */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-1">
                  Versión de la app
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  PESSY para Web
                </p>
              </div>
              <span className="text-sm font-bold text-[#2b7cee]">1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}