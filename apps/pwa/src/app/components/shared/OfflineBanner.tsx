"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";

/**
 * Global offline banner. Slides in from top when connection drops,
 * auto-hides when back online. Pure CSS transition, no framer-motion.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // Initialize from current state
    setIsOffline(!navigator.onLine);

    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      // Brief "reconnected" message
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 2500);
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!isOffline && !showReconnected) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-2 px-4 text-[12px] font-[700] transition-all duration-300 ${
        isOffline
          ? "bg-[#FFF3E0] text-[#E65100] translate-y-0"
          : "bg-[#E8F5E9] text-[#2E7D32] translate-y-0"
      }`}
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {isOffline ? (
        <>
          <MaterialIcon name="wifi_off" className="!text-[14px]" />
          Sin conexión — los datos se sincronizarán al volver
        </>
      ) : (
        <>✓ Conexión restablecida</>
      )}
    </div>
  );
}
