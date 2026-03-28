export default function RecommendationFeed() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-12" style={{ background: "#F0FAF9" }}>
      {/* Cork mascot */}
      <svg viewBox="0 0 140 170" fill="none" width="120" height="140" className="mb-6 opacity-80">
        <ellipse cx="70" cy="128" rx="36" ry="30" fill="#d4ede8" stroke="#074738" strokeWidth="2.5"/>
        <circle cx="70" cy="70" r="30" fill="#d4ede8" stroke="#074738" strokeWidth="2.5"/>
        <ellipse cx="44" cy="46" rx="12" ry="20" fill="#1A9B7D" stroke="#074738" strokeWidth="2.5" transform="rotate(-18,44,46)"/>
        <ellipse cx="96" cy="46" rx="12" ry="20" fill="#1A9B7D" stroke="#074738" strokeWidth="2.5" transform="rotate(18,96,46)"/>
        <circle cx="58" cy="66" r="5" fill="#074738"/>
        <circle cx="82" cy="66" r="5" fill="#074738"/>
        <circle cx="59.5" cy="64" r="2" fill="white"/>
        <circle cx="83.5" cy="64" r="2" fill="white"/>
        <ellipse cx="70" cy="78" rx="5.5" ry="4" fill="#074738"/>
        <path d="M62 82 Q70 90 78 82" stroke="#074738" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M104 114 Q122 94 116 70" stroke="#074738" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <rect x="52" y="150" width="12" height="16" rx="6" fill="#d4ede8" stroke="#074738" strokeWidth="2.5"/>
        <rect x="76" y="150" width="12" height="16" rx="6" fill="#d4ede8" stroke="#074738" strokeWidth="2.5"/>
      </svg>

      <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: "#074738", fontSize: "1.4rem", marginBottom: "0.5rem", textAlign: "center" }}>
        Pronto vas a poder explorar
      </h2>
      <p style={{ fontFamily: "'Manrope', sans-serif", color: "#3d5a50", fontSize: "0.95rem", textAlign: "center", maxWidth: 320, lineHeight: 1.6, marginBottom: "1.5rem" }}>
        Estamos armando una guía de lugares pet-friendly cerca tuyo: cafés, parques, veterinarias y más.
      </p>

      <a
        href="mailto:it@pessy.app?subject=Sugerir%20lugar%20pet-friendly"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "#1A9B7D",
          color: "white",
          padding: "10px 24px",
          borderRadius: 999,
          fontSize: "0.85rem",
          fontWeight: 700,
          textDecoration: "none",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        Sugerir un lugar
      </a>
    </div>
  );
}