// ============================================================================
// PESSY Pricing Engine
// Precios base USD + conversión por país + IVA local
// ============================================================================

export interface PricingPlan {
  id: "free" | "premium_monthly" | "premium_annual";
  name: string;
  baseUSD: number;          // Precio base en USD
  billingPeriod: "month" | "year" | null;
}

export interface LocalizedPrice {
  amount: number;           // Monto en moneda local
  currency: string;         // ISO 4217 (ARS, BRL, CLP, MXN, USD...)
  currencySymbol: string;
  displayAmount: string;    // "7.490" formateado
  displayFull: string;      // "ARS 7.490/mes"
  vatRate: number;          // 0.21 para Argentina (21%)
  vatLabel: string;         // "IVA incluido" / "+ IVA 21%"
  vatIncluded: boolean;     // Si el precio mostrado ya incluye IVA
  amountBeforeVat: number;
  usdEquivalent: number;
  country: string;
  countryCode: string;
  paymentProvider: "mercadopago" | "stripe";
}

// ── Configuración por país ────────────────────────────────────────────────────
// vatIncluded: true = mostramos precio final con IVA adentro
// vatIncluded: false = mostramos precio + nota "más IVA X%"
export const COUNTRY_CONFIG: Record<string, {
  currency: string;
  symbol: string;
  vatRate: number;
  vatIncluded: boolean;
  vatLabel: string;
  paymentProvider: "mercadopago" | "stripe";
  name: string;
}> = {
  AR: { currency: "ARS", symbol: "$",   vatRate: 0.21, vatIncluded: true,  vatLabel: "IVA 21% incluido",  paymentProvider: "mercadopago", name: "Argentina"  },
  BR: { currency: "BRL", symbol: "R$",  vatRate: 0.12, vatIncluded: true,  vatLabel: "impostos inclusos",  paymentProvider: "mercadopago", name: "Brasil"     },
  CL: { currency: "CLP", symbol: "$",   vatRate: 0.19, vatIncluded: true,  vatLabel: "IVA 19% incluido",  paymentProvider: "mercadopago", name: "Chile"      },
  MX: { currency: "MXN", symbol: "$",   vatRate: 0.16, vatIncluded: true,  vatLabel: "IVA 16% incluido",  paymentProvider: "mercadopago", name: "México"     },
  CO: { currency: "COP", symbol: "$",   vatRate: 0.19, vatIncluded: true,  vatLabel: "IVA 19% incluido",  paymentProvider: "mercadopago", name: "Colombia"   },
  UY: { currency: "UYU", symbol: "$",   vatRate: 0.22, vatIncluded: true,  vatLabel: "IVA 22% incluido",  paymentProvider: "mercadopago", name: "Uruguay"    },
  PE: { currency: "PEN", symbol: "S/",  vatRate: 0.18, vatIncluded: true,  vatLabel: "IGV 18% incluido",  paymentProvider: "mercadopago", name: "Perú"       },
  EC: { currency: "USD", symbol: "USD", vatRate: 0.12, vatIncluded: false, vatLabel: "+ IVA 12%",         paymentProvider: "stripe",      name: "Ecuador"    },
  BO: { currency: "BOB", symbol: "Bs.", vatRate: 0.13, vatIncluded: true,  vatLabel: "IVA 13% incluido",  paymentProvider: "stripe",      name: "Bolivia"    },
  PY: { currency: "PYG", symbol: "₲",   vatRate: 0.10, vatIncluded: true,  vatLabel: "IVA 10% incluido",  paymentProvider: "mercadopago", name: "Paraguay"   },
  US: { currency: "USD", symbol: "USD", vatRate: 0,    vatIncluded: false, vatLabel: "excl. tax",         paymentProvider: "stripe",      name: "Estados Unidos" },
  ES: { currency: "EUR", symbol: "€",   vatRate: 0.21, vatIncluded: true,  vatLabel: "IVA 21% incluido",  paymentProvider: "stripe",      name: "España"     },
  // Fallback global
  XX: { currency: "USD", symbol: "USD", vatRate: 0,    vatIncluded: false, vatLabel: "",                  paymentProvider: "stripe",      name: "Internacional" },
};

// ── Planes base ───────────────────────────────────────────────────────────────
export const PLANS: PricingPlan[] = [
  { id: "free",             name: "Free",    baseUSD: 0,  billingPeriod: null    },
  { id: "premium_monthly",  name: "Premium", baseUSD: 7,  billingPeriod: "month" },
  { id: "premium_annual",   name: "Premium", baseUSD: 60, billingPeriod: "year"  },
];

// ── Caché de tasas de cambio (1 hora TTL) ─────────────────────────────────────
const rateCache: { rates: Record<string, number>; fetchedAt: number } | null = {
  rates: {}, fetchedAt: 0,
};

/** true si la última resolución de tasas usó el fallback hardcodeado */
export let usingFallbackRates = false;

async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  if (rateCache && rateCache.fetchedAt > 0 && now - rateCache.fetchedAt < ONE_HOUR) {
    return rateCache.rates;
  }

  try {
    // API pública sin auth key — suficiente para uso en cliente
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.rates) {
      rateCache!.rates = data.rates;
      rateCache!.fetchedAt = now;
      usingFallbackRates = false;
      return data.rates;
    }
  } catch (err) {
    // Fallback: tasas aproximadas hardcodeadas (actualizadas Feb 2026)
    console.warn("[PRICING] No se pudieron obtener tasas de cambio, usando fallback hardcodeado:", (err as Error)?.message || err);
  }

  usingFallbackRates = true;
  return FALLBACK_RATES;
}

// Tasas de emergencia (USD base)
const FALLBACK_RATES: Record<string, number> = {
  ARS: 1050, BRL: 5.8, CLP: 990, MXN: 17.5, COP: 4100,
  UYU: 42,   PEN: 3.8, BOB: 6.9, PYG: 7800,  EUR: 0.93,
  USD: 1,
};

// ── Función principal: calcula precio localizado ──────────────────────────────
export async function getLocalizedPrice(
  plan: PricingPlan,
  countryCode: string,
): Promise<LocalizedPrice> {
  const code = countryCode.toUpperCase();
  const cfg = COUNTRY_CONFIG[code] || COUNTRY_CONFIG["XX"];
  const rates = await getExchangeRates();

  const rate = rates[cfg.currency] || 1;
  const baseLocal = plan.baseUSD * rate;

  // Precio con IVA incluido o sin
  const amountWithVat = cfg.vatIncluded
    ? baseLocal * (1 + cfg.vatRate)
    : baseLocal;

  const rounded = roundPrice(amountWithVat, cfg.currency);

  return {
    amount: rounded,
    currency: cfg.currency,
    currencySymbol: cfg.symbol,
    displayAmount: formatLocalAmount(rounded, cfg.currency),
    displayFull: buildDisplayFull(rounded, cfg, plan),
    vatRate: cfg.vatRate,
    vatLabel: cfg.vatLabel,
    vatIncluded: cfg.vatIncluded,
    amountBeforeVat: Math.round(baseLocal * 100) / 100,
    usdEquivalent: plan.baseUSD,
    country: cfg.name,
    countryCode: code,
    paymentProvider: cfg.paymentProvider,
  };
}

// ── Detectar país del usuario ─────────────────────────────────────────────────
export async function detectUserCountry(): Promise<string> {
  try {
    const res = await fetch("https://ipapi.co/country/", { signal: AbortSignal.timeout(3000) });
    const code = (await res.text()).trim().toUpperCase();
    if (code.length === 2) return code;
  } catch (err) {
    console.warn("[PRICING] No se pudo detectar país por IP, usando timezone como fallback:", (err as Error)?.message || err);
  }
  // Fallback por timezone del browser
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes("Buenos_Aires") || tz.includes("Argentina")) return "AR";
    if (tz.includes("Sao_Paulo") || tz.includes("Brazil"))        return "BR";
    if (tz.includes("Santiago"))                                   return "CL";
    if (tz.includes("Mexico"))                                     return "MX";
    if (tz.includes("Bogota"))                                     return "CO";
    if (tz.includes("Montevideo"))                                 return "UY";
    if (tz.includes("Lima"))                                       return "PE";
  } catch (err) {
    console.warn("[PRICING] Error leyendo timezone del browser:", (err as Error)?.message || err);
  }
  return "XX";
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function roundPrice(amount: number, currency: string): number {
  // Monedas de alta denominación → redondear a 10 o 100
  if (["ARS", "COP", "PYG", "CLP"].includes(currency)) {
    return Math.round(amount / 10) * 10;
  }
  return Math.round(amount * 100) / 100;
}

function formatLocalAmount(amount: number, currency: string): string {
  if (["ARS", "COP", "PYG"].includes(currency)) {
    return amount.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  if (["CLP"].includes(currency)) {
    return amount.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildDisplayFull(amount: number, cfg: typeof COUNTRY_CONFIG["AR"], plan: PricingPlan): string {
  const sym = cfg.currency === "USD" ? "USD " : cfg.symbol;
  const formatted = formatLocalAmount(amount, cfg.currency);
  const period = plan.billingPeriod === "month" ? "/mes" : plan.billingPeriod === "year" ? "/año" : "";
  return `${sym}${formatted}${period}`;
}
