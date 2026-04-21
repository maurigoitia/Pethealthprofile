import { useEffect, useMemo, useState } from "react";

interface PetPhotoProps {
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
}

export function PetPhoto({
  src,
  alt,
  className = "",
  imageClassName = "",
  fallbackClassName = "",
}: PetPhotoProps) {
  const [imageError, setImageError] = useState(false);

  const normalizedSrc = useMemo(() => {
    if (typeof src !== "string") return "";
    return src.trim();
  }, [src]);

  useEffect(() => {
    setImageError(false);
  }, [normalizedSrc]);

  // Treat SVG base64 placeholders and empty strings the same as a missing photo
  const isPlaceholder =
    normalizedSrc.startsWith("data:image/svg+xml") || normalizedSrc === "";

  const shouldShowFallback = !normalizedSrc || isPlaceholder || imageError;

  if (shouldShowFallback) {
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-[#074738] to-[#1a9b7d] ${className} ${fallbackClassName}`}
        aria-label={alt}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.28),transparent_45%),radial-gradient(circle_at_85%_85%,rgba(255,255,255,0.16),transparent_40%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-[62%] rounded-[22%] bg-white/18 border border-white/30 backdrop-blur-[2px] flex items-center justify-center">
            <span className="text-white font-black tracking-tight leading-none text-[clamp(18px,5vw,56px)]">
              P
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={normalizedSrc}
      alt={alt}
      className={`${className} ${imageClassName}`}
      onError={() => setImageError(true)}
    />
  );
}
