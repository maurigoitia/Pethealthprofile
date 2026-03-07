interface LogoProps {
  className?: string;
  color?: string;
}

export function Logo({ className = "size-8", color = "#074738" }: LogoProps) {
  return (
    <span
      className={`inline-block ${className}`}
      style={{
        backgroundColor: color,
        WebkitMaskImage: "url('/pessy-logo.svg')",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
        maskImage: "url('/pessy-logo.svg')",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
      }}
      aria-hidden="true"
    />
  );
}
