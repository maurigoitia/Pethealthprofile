// Variantes oficiales del manual de marca Pessy (Plano Branding):
//   primary  → verde #074738 (uso sobre fondo claro)
//   white    → blanco #FFFFFF (uso sobre fondo verde oscuro)
//   surface  → verde claro #E0F2F1 (uso secundario sobre fondo verde oscuro)
//   black    → negro #000000 (uso impresión 1 tinta)
const cache: Record<string, string> = {};

const FILL_TARGETS: Record<string, string> = {
  primary: "#074738",
  white: "#FFFFFF",
  surface: "#E0F2F1",
  black: "#000000",
};

/**
 * Carga el logo de Pessy en una variante de color del manual de marca.
 * Convierte el SVG a PNG dataURL via canvas — alta resolución (4x densidad).
 */
export async function loadPessyLogo(
  variant: keyof typeof FILL_TARGETS = "primary",
  pixelSize = 1024
): Promise<string> {
  const cacheKey = `${variant}_${pixelSize}`;
  if (cache[cacheKey]) return cache[cacheKey];

  const fill = FILL_TARGETS[variant] || FILL_TARGETS.primary;

  const res = await fetch("/pessy-logo.svg");
  if (!res.ok) throw new Error(`Failed to load Pessy logo (${res.status})`);
  let svgText = await res.text();
  // Reemplaza el fill primario del logo por la variante deseada
  svgText = svgText.replace(/fill="#074738"/gi, `fill="${fill}"`);

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = pixelSize;
        canvas.height = pixelSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        ctx.drawImage(img, 0, 0, pixelSize, pixelSize);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed rasterizing Pessy logo SVG"));
    };
    img.src = url;
  });

  cache[cacheKey] = dataUrl;
  return dataUrl;
}

export function __resetLogoCacheForTests() {
  for (const k of Object.keys(cache)) delete cache[k];
}
