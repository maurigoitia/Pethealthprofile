interface MaterialIconProps {
  name: string;
  className?: string;
  filled?: boolean;
  /** BUG-14 fix: decorative icons should set aria-hidden to hide from screen readers */ "aria-hidden"?: boolean;
}

export function MaterialIcon({ name, className = "", filled = false, "aria-hidden": ariaHidden = true }: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      aria-hidden={ariaHidden}
      style={{
        fontVariationSettings: filled
          ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
          : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
      }}
    >
      {name}
    </span>
  );
}
