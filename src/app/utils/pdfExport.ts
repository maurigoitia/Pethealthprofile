import type jsPDF from "jspdf";

export async function loadJsPdf() {
  const module = await import("jspdf");
  return module.default;
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSByUa = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSByUa || iPadOs;
}

function createPdfBlob(pdf: jsPDF): Blob {
  return pdf.output("blob");
}

async function tryNativeShare(blob: Blob, fileName: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };
  if (!nav.share || !nav.canShare) return false;

  try {
    const file = new File([blob], fileName, { type: "application/pdf" });
    if (!nav.canShare({ files: [file] })) return false;
    await nav.share({ files: [file], title: fileName });
    return true;
  } catch {
    return false;
  }
}

function triggerDownload(blob: Blob, fileName: string): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}

function openPdfInNewTab(blob: Blob): boolean {
  if (typeof window === "undefined") return false;
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return Boolean(popup);
}

export async function savePdfWithFallback(pdf: jsPDF, fileName: string): Promise<void> {
  const blob = createPdfBlob(pdf);

  const shared = await tryNativeShare(blob, fileName);
  if (shared) return;

  const downloaded = triggerDownload(blob, fileName);
  if (downloaded) return;

  if (isIosDevice()) {
    const opened = openPdfInNewTab(blob);
    if (opened) return;
  }

  // Último recurso: método nativo de jsPDF
  pdf.save(fileName);
}
