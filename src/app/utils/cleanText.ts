/**
 * Limpia el markdown que devuelve Gemini para mostrar texto plano.
 * Elimina: **bold**, *italic*, # headers, `code`, listas con -, bullets, etc.
 */
export function cleanText(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")       // **bold**
    .replace(/\*(.*?)\*/g, "$1")            // *italic*
    .replace(/#{1,6}\s+/g, "")             // ## headers
    .replace(/`{1,3}[^`]*`{1,3}/g, "")    // `code` o ```block```
    .replace(/^[-*+]\s+/gm, "")            // listas - item
    .replace(/^\d+\.\s+/gm, "")            // listas 1. item
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [link](url)
    .replace(/\n{3,}/g, "\n\n")            // múltiples saltos
    .replace(/\n/g, " ")                   // saltos → espacio
    .replace(/\s{2,}/g, " ")              // espacios dobles
    .trim();
}

/**
 * Capitaliza la primera letra.
 */
export function capitalize(text: string): string {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
