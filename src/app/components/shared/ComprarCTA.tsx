import { MaterialIcon } from "./MaterialIcon";

export type ComprarCategory = "alimento" | "medicamento" | "accesorio";

interface ComprarCTAProps {
  productName: string;
  category: ComprarCategory;
  petSpecies?: "dog" | "cat";
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "card" | "button" | "inline";
  onClicked?: (product: string, category: string) => void;
}

/**
 * Contextual "Comprar" CTA component that generates MercadoLibre search URLs.
 * 
 * Pillar 3 of Pessy Ecosystem: "Comprar"
 * When Pessy knows what the pet needs, it shows a contextual [Comprar] button
 * that connects directly to MercadoLibre search results.
 */
export function ComprarCTA({
  productName,
  category,
  petSpecies = "dog",
  className = "",
  size = "md",
  variant = "card",
  onClicked,
}: ComprarCTAProps) {
  if (!productName || !productName.trim()) {
    return null;
  }

  const trackComprarClick = (product: string, cat: string) => {
    console.log("[Pessy:Comprar]", {
      product,
      category: cat,
      timestamp: new Date().toISOString(),
    });
    onClicked?.(product, cat);
  };

  // Build MercadoLibre search query based on category
  const buildSearchQuery = (): string => {
    const petLabel = petSpecies === "cat" ? "gato" : "perro";
    
    switch (category) {
      case "alimento":
        return `${productName} ${petLabel}`;
      case "medicamento":
        return `${productName} mascota`;
      case "accesorio":
        return `${productName} ${petLabel}`;
      default:
        return productName;
    }
  };

  const searchQuery = buildSearchQuery();
  const mercadoLibreUrl = `https://listado.mercadolibre.com.ar/${encodeURIComponent(
    searchQuery
  )}`;

  const handleClick = () => {
    trackComprarClick(productName, category);
    window.open(mercadoLibreUrl, "_blank", "noopener,noreferrer");
  };

  if (variant === "card") {
    return (
      <div
        className={`bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 flex flex-col gap-2 ${className}`}
      >
        <div className="flex items-center gap-2">
          <MaterialIcon name="shopping_bag" className="text-amber-600 text-lg" />
          <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            Comprar
          </span>
        </div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {productName}
        </p>
        <button
          onClick={handleClick}
          className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 mt-1"
        >
          Ver en MercadoLibre
          <MaterialIcon name="arrow_outward" className="text-xs" />
        </button>
      </div>
    );
  }

  if (variant === "button") {
    const sizeClasses = {
      sm: "py-2 px-3 text-xs",
      md: "py-2.5 px-4 text-sm",
      lg: "py-3 px-5 text-base",
    };

    return (
      <button
        onClick={handleClick}
        className={`inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors ${
          sizeClasses[size]
        } ${className}`}
      >
        <MaterialIcon name="shopping_bag" className="text-base" />
        <span>Comprar</span>
        <MaterialIcon name="arrow_outward" className="text-xs" />
      </button>
    );
  }

  // inline variant
  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors ${className}`}
    >
      <MaterialIcon name="shopping_bag" className="text-base" />
      <span>Comprar {productName}</span>
      <MaterialIcon name="arrow_outward" className="text-xs" />
    </button>
  );
}
