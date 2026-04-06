import React from "react";

interface FizzMascotProps {
  size?: number;
  className?: string;
}

export function FizzMascot({ size = 40, className }: FizzMascotProps) {
  return (
    <svg
      viewBox="0 0 60 72"
      width={size}
      height={size * 1.2}
      className={className}
      style={{ display: "block", overflow: "visible", flexShrink: 0 }}
      fill="none"
      aria-hidden="true"
    >
      <style>{`
        @keyframes fizzTailCurl {
          0%, 100% { transform: rotate(0deg); }
          40% { transform: rotate(18deg); }
          70% { transform: rotate(-8deg); }
        }
        .fizz-tail {
          transform-box: fill-box;
          transform-origin: 0% 100%;
          animation: fizzTailCurl 2s ease-in-out infinite;
        }
      `}</style>
      {/* Body */}
      <ellipse cx="30" cy="57" rx="13" ry="10" fill="#FDDCB5" stroke="#C67B3A" strokeWidth="1.5" />
      {/* Tail */}
      <path className="fizz-tail" d="M43 54 Q54 46 50 38" stroke="#F4A261" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {/* Head */}
      <circle cx="30" cy="30" r="14" fill="#FDDCB5" stroke="#C67B3A" strokeWidth="1.5" />
      {/* Pointed cat ears */}
      <polygon points="16,20 11,6 23,14" fill="#F4A261" stroke="#C67B3A" strokeWidth="1.5" strokeLinejoin="round" />
      <polygon points="44,20 49,6 37,14" fill="#F4A261" stroke="#C67B3A" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Eyes */}
      <ellipse cx="25" cy="28" rx="2.5" ry="3" fill="#5C3A1E" />
      <ellipse cx="35" cy="28" rx="2.5" ry="3" fill="#5C3A1E" />
      <circle cx="25.8" cy="27" r="1" fill="white" />
      <circle cx="35.8" cy="27" r="1" fill="white" />
      {/* Nose */}
      <ellipse cx="30" cy="34" rx="2.5" ry="1.8" fill="#E8856A" />
      {/* Whiskers */}
      <line x1="14" y1="33" x2="25" y2="34" stroke="#C67B3A" strokeWidth="0.8" />
      <line x1="14" y1="36" x2="25" y2="35" stroke="#C67B3A" strokeWidth="0.8" />
      <line x1="46" y1="33" x2="35" y2="34" stroke="#C67B3A" strokeWidth="0.8" />
      <line x1="46" y1="36" x2="35" y2="35" stroke="#C67B3A" strokeWidth="0.8" />
      {/* Smile */}
      <path d="M26 37 Q30 41 34 37" stroke="#C67B3A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Paws */}
      <ellipse cx="24" cy="64" rx="5" ry="4" fill="#FDDCB5" stroke="#C67B3A" strokeWidth="1.5" />
      <ellipse cx="36" cy="64" rx="5" ry="4" fill="#FDDCB5" stroke="#C67B3A" strokeWidth="1.5" />
    </svg>
  );
}

export default FizzMascot;