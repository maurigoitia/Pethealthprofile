import React from "react";

interface CorkMascotProps {
  size?: number;
  className?: string;
}

const CORK_ASPECT_RATIO = 170 / 140;

export function CorkMascot({ size = 40, className }: CorkMascotProps) {
  return (
    <svg
      viewBox="0 0 140 170"
      width={size}
      height={size * CORK_ASPECT_RATIO}
      className={className}
      style={{ display: "block", overflow: "visible", flexShrink: 0 }}
      fill="none"
      aria-hidden="true"
    >
      <style>{`
        @keyframes pessyCorkTailWag {
          0%, 100% { transform: rotate(-8deg); }
          50% { transform: rotate(12deg); }
        }

        @keyframes pessyCorkEarWiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-4deg); }
          75% { transform: rotate(4deg); }
        }

        .pessy-cork-wag {
          animation: pessyCorkTailWag 1.2s ease-in-out infinite;
          transform-origin: bottom left;
        }

        .pessy-cork-ear-wiggle {
          animation: pessyCorkEarWiggle 3s ease-in-out infinite;
        }
      `}</style>
      <ellipse cx="70" cy="128" rx="36" ry="30" fill="#d4ede8" stroke="#074738" strokeWidth="2.5" />
      <circle cx="70" cy="70" r="30" fill="#d4ede8" stroke="#074738" strokeWidth="2.5" />
      <ellipse cx="44" cy="46" rx="12" ry="20" fill="#1A9B7D" stroke="#074738" strokeWidth="2.5" transform="rotate(-18 44 46)" />
      <ellipse cx="96" cy="46" rx="12" ry="20" fill="#1A9B7D" stroke="#074738" strokeWidth="2.5" transform="rotate(18 96 46)" className="pessy-cork-ear-wiggle" />
      <circle cx="58" cy="66" r="5" fill="#074738" />
      <circle cx="82" cy="66" r="5" fill="#074738" />
      <circle cx="59.5" cy="64" r="2" fill="white" />
      <circle cx="83.5" cy="64" r="2" fill="white" />
      <ellipse cx="70" cy="78" rx="5.5" ry="4" fill="#074738" />
      <path d="M62 82 Q70 90 78 82" stroke="#074738" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="70" cy="88" rx="3.5" ry="4.5" fill="#e8847a" />
      <path d="M104 114 Q122 94 116 70" stroke="#074738" strokeWidth="2.5" fill="none" strokeLinecap="round" className="pessy-cork-wag" />
      <rect x="52" y="150" width="12" height="16" rx="6" fill="#d4ede8" stroke="#074738" strokeWidth="2.5" />
      <rect x="76" y="150" width="12" height="16" rx="6" fill="#d4ede8" stroke="#074738" strokeWidth="2.5" />
      <path d="M48 96 Q70 104 92 96" stroke="#5048CA" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="70" cy="101" r="3" fill="#5048CA" />
    </svg>
  );
}

export default CorkMascot;
