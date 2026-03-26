import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { StorageQuota, formatBytes, PLAN_LIMITS } from "../hooks/useStorageQuota";
import {
  getLocalizedPrice, detectUserCountry, PLANS, LocalizedPrice,
} from "../utils/pricing";

interface StorageLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  quota: StorageQuota | null;
  // Si triggerUpgrade es true, el modal se muestra en modo "upgrade directo" sin contexto de storage
  triggerUpgrade?: boolean;
}

const FEATURES = [
  { icon: "storage",         text: "10 GB de almacenamiento" },
  { icon: "auto_awesome",    text: "Análisis ilimitados con IA" },
  { icon: "picture_as_pdf",  text: "Exportes PDF ilimitados" },
  { icon: "group",           text: "Co-tutores ilimitados" },
  { icon: "notifications",   text: "Recordatorios prioritarios" },
  { icon: "verified",        text: "Soporte prioritario" },
];

export function StorageLimitModal({ isOpen, onClose, quota, triggerUpgrade }: StorageLimitModalProps) {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [prices, setPrices] = useState<{ monthly: LocalizedPrice | null; annual: LocalizedPrice | null }>({
    monthly: null, annual: null,
  });
  const [countryCode, setCountryCode] = useState("XX");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    detectUserCountry().then(async (code) => {
      setCountryCode(code);
      const [monthly, annual] = await Promise.all([
        getLocalizedPrice(PLANS.find(p => p.id === "premium_monthly")!, code),
        getLocalizedPrice(PLANS.find(p => p.id === "premium_annual")!, code),
      ]);
      setPrices({ monthly, annual });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPrice = billing === "annual" ? prices.annual : prices.monthly;
  const isOverLimit = quota?.isOverLimit ?? false;
  const showStorageContext = quota !== null && !triggerUpgrade;

  // Ahorro anual en %
  const savingsPct = prices.monthly && prices.annual
    ? Math.round(100 - (prices.annual.usdEquivalent / (prices.monthly.usdEquivalent * 12)) * 100)
    : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[61] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[93vh] flex flex-col max-w-md mx-auto overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>

            {/* Header gradiente */}
            <div className="mx-3 mt-1 mb-0 rounded-2xl bg-gradient-to-br from-[#074738] via-[#074738] to-[#1a9b7d] px-5 py-5 shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <MaterialIcon name="workspace_premium" className="text-amber-300 text-2xl" />
                  <span className="text-white font-black text-xl">PESSY Premium</span>
                </div>
                <button onClick={onClose}
                  className="size-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <MaterialIcon name="close" className="text-white text-lg" />
                </button>
              </div>

              {showStorageContext && (
                <div className="mt-2 mb-3">
                  <p className="text-white/90 text-sm leading-relaxed">
                    {isOverLimit
                      ? <>Alcanzaste el límite de <span className="font-black text-white">1 GB</span>. Upgrades a Premium para seguir subiendo documentos.</>
                      : <>Usaste <span className="font-black text-white">{quota!.percentUsed.toFixed(0)}%</span> de tu almacenamiento gratuito.</>
                    }
                  </p>
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-white/60 mb-1">
                      <span>{formatBytes(quota!.used)} usados</span>
                      <span>{formatBytes(PLAN_LIMITS.free)} Free</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${isOverLimit ? "bg-red-400" : quota!.isNearLimit ? "bg-amber-300" : "bg-emerald-400"}`}
                        style={{ width: `${Math.min(100, quota!.percentUsed)}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {!showStorageContext && (
                <p className="text-white/85 text-sm mt-1">
                  Desbloqueá todo el potencial de PESSY para tu mascota.
                </p>
              )}

              {/* Ubicación detectada */}
              {!loading && countryCode !== "XX" && (
                <div className="mt-3 flex items-center gap-1.5">
                  <MaterialIcon name="location_on" className="text-white/60 text-sm" />
                  <span className="text-white/60 text-xs">
                    Precios para {PLANS.find(() => true) && currentPrice?.country}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

              {/* Toggle mensual / anual */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button onClick={() => setBilling("monthly")}
                  className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
                    billing === "monthly" ? "bg-white dark:bg-slate-900 text-[#074738] shadow-sm" : "text-slate-600 dark:text-slate-400"
                  }`}>
                  Mensual
                </button>
                <button onClick={() => setBilling("annual")}
                  className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    billing === "annual" ? "bg-white dark:bg-slate-900 text-[#074738] shadow-sm" : "text-slate-600 dark:text-slate-400"
                  }`}>
                  Anual
                  {savingsPct > 0 && (
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                      -{savingsPct}%
                    </span>
                  )}
                </button>
              </div>

              {/* Precio principal */}
              <div className="text-center py-2">
                {loading ? (
                  <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse mx-8" />
                ) : currentPrice ? (
                  <>
                    <div className="flex items-end justify-center gap-1">
                      <span className="text-4xl font-black text-slate-900 dark:text-white">
                        {currentPrice.displayFull.split("/")[0]}
                      </span>
                      <span className="text-slate-500 text-base mb-1">
                        /{billing === "annual" ? "año" : "mes"}
                      </span>
                    </div>
                    {billing === "annual" && prices.monthly && (
                      <p className="text-sm text-slate-500 mt-1">
                        Equivale a <span className="font-bold text-[#074738]">
                          {(currentPrice.amount / 12).toLocaleString("es-AR", { maximumFractionDigits: 0 })} {currentPrice.currency}/mes
                        </span>
                      </p>
                    )}
                    {currentPrice.vatLabel && (
                      <p className="text-xs text-slate-400 mt-1">{currentPrice.vatLabel}</p>
                    )}
                    {!currentPrice.vatIncluded && currentPrice.vatRate > 0 && (
                      <p className="text-xs text-slate-400">
                        Total con impuestos: {currentPrice.currencySymbol}
                        {formatLocalWithVat(currentPrice)} /{billing === "annual" ? "año" : "mes"}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      ≈ USD {billing === "annual" ? "60" : "7"} · {currentPrice.paymentProvider === "mercadopago" ? "MercadoPago" : "Stripe"}
                    </p>
                  </>
                ) : null}
              </div>

              {/* Features */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Incluye</p>
                <div className="space-y-2.5">
                  {FEATURES.map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-[#074738]/10 flex items-center justify-center shrink-0">
                        <MaterialIcon name={f.icon} className="text-[#074738] text-base" />
                      </div>
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-medium flex-1">{f.text}</span>
                      <MaterialIcon name="check" className="text-emerald-500 text-lg shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Comparación Free vs Premium */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-sm">
                <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-800 text-xs font-black uppercase tracking-wider text-slate-400 px-4 py-2.5">
                  <span>Feature</span>
                  <span className="text-center">Free</span>
                  <span className="text-center text-[#074738]">Premium</span>
                </div>
                {[
                  ["Almacenamiento", "1 GB", "10 GB"],
                  ["Documentos / mes", "10", "Ilimitados"],
                  ["Análisis con IA", "✓", "✓"],
                  ["Co-tutores", "3", "Ilimitados"],
                  ["Exportes PDF", "✓", "✓"],
                  ["Soporte", "Básico", "Prioritario"],
                ].map(([feat, free, premium]) => (
                  <div key={feat} className="grid grid-cols-3 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{feat}</span>
                    <span className="text-center text-slate-500">{free}</span>
                    <span className="text-center font-bold text-[#074738]">{premium}</span>
                  </div>
                ))}
              </div>

            </div>

            {/* CTA bottom */}
            <div className="px-4 pb-8 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5 shrink-0 bg-white dark:bg-slate-900">
              {/* Pagos próximamente */}
              <div className="w-full h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2">
                <MaterialIcon name="workspace_premium" className="text-slate-400 text-xl" />
                <span className="text-slate-500 font-bold text-sm">Pagos disponibles próximamente</span>
              </div>
              <p className="text-center text-xs text-slate-400">
                Estamos integrando los medios de pago. Te avisamos cuando esté listo.
              </p>
              {!isOverLimit && (
                <button onClick={onClose} className="w-full py-3 text-slate-400 text-sm font-bold">
                  Continuar con plan Free
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function formatLocalWithVat(price: LocalizedPrice): string {
  const withVat = price.amount * (1 + price.vatRate);
  if (["ARS", "COP", "PYG", "CLP"].includes(price.currency)) {
    return Math.round(withVat / 10) * 10 + "";
  }
  return withVat.toFixed(2);
}
