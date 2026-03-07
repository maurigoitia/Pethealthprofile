const MAX_PET_PHOTO_BYTES = 30 * 1024 * 1024;
// Mantener margen para el límite de payload en callable (base64 aumenta ~33%).
const TARGET_PET_PHOTO_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2400;

const ACCEPTED_PHOTO_ATTR =
  "image/jpeg,image/png,image/webp,.heic,.heif,image/heic,image/heif";

const EXTENSION_REGEX = /\.([a-z0-9]+)$/i;

const HEIC_EXTENSIONS = new Set(["heic", "heif"]);
const STANDARD_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const HEIC_MIME_MARKERS = ["image/heic", "image/heif", "heic", "heif"];
const STANDARD_MIME_MARKERS = ["image/jpeg", "image/png", "image/webp"];

export function getPetPhotoAcceptValue(): string {
  return ACCEPTED_PHOTO_ATTR;
}

function getExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(EXTENSION_REGEX);
  return match?.[1] || "";
}

function isHeicLike(file: File): boolean {
  const ext = getExtension(file.name || "");
  const mime = (file.type || "").toLowerCase();
  return HEIC_EXTENSIONS.has(ext) || HEIC_MIME_MARKERS.some((marker) => mime.includes(marker));
}

function isAcceptedImage(file: File): boolean {
  const ext = getExtension(file.name || "");
  const mime = (file.type || "").toLowerCase();
  const acceptedByMime = STANDARD_MIME_MARKERS.some((marker) => mime.includes(marker));
  const acceptedByExt = STANDARD_EXTENSIONS.has(ext) || HEIC_EXTENSIONS.has(ext);
  return acceptedByMime || acceptedByExt || isHeicLike(file);
}

function buildConvertedName(originalName: string): string {
  const base = originalName.replace(EXTENSION_REGEX, "");
  return `${base || "pet-photo"}.jpg`;
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen."));
    };
    img.src = objectUrl;
  });
}

async function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo convertir la imagen."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.size <= TARGET_PET_PHOTO_BYTES) return file;

  const image = await loadImageElement(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width || 1, image.height || 1));
  const width = Math.max(1, Math.round((image.width || 1) * scale));
  const height = Math.max(1, Math.round((image.height || 1) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(image, 0, 0, width, height);

  const qualities = [0.9, 0.82, 0.75, 0.68, 0.6, 0.55];
  let bestBlob: Blob | null = null;

  for (const quality of qualities) {
    const blob = await canvasToJpegBlob(canvas, quality);
    bestBlob = blob;
    if (blob.size <= TARGET_PET_PHOTO_BYTES) break;
  }

  if (!bestBlob) return file;

  return new File([bestBlob], buildConvertedName(file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });
  const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
  if (!(convertedBlob instanceof Blob)) {
    throw new Error("No se pudo convertir HEIC/HEIF.");
  }
  return new File([convertedBlob], buildConvertedName(file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export async function preparePetPhotoForUpload(file: File): Promise<File> {
  if (file.size > MAX_PET_PHOTO_BYTES) {
    throw new Error("La imagen supera el límite de 30 MB.");
  }
  if (!isAcceptedImage(file)) {
    throw new Error("Formato no compatible. Usá JPG, PNG, WEBP o HEIC.");
  }
  const normalized = isHeicLike(file) ? await convertHeicToJpeg(file) : file;
  return compressImageIfNeeded(normalized);
}
