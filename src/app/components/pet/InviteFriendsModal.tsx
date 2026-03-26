import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { createPlatformInvitation, buildPlatformInviteUrl } from "../utils/platformInvite";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function InviteFriendsModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleGenerate = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const code = await createPlatformInvitation(user.uid);
      setInviteUrl(buildPlatformInviteUrl(code));
      setCopied(false);
    } catch {
      setError("No se pudo generar el link. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text manually
    }
  };

  const handleShare = async () => {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Te invito a Pessy",
          text: "Únete a Pessy, la app para el bienestar de tu mascota.",
          url: inviteUrl,
        });
      } catch {
        // User cancelled or share failed — no-op
      }
    } else {
      handleCopy();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={handleBackdropClick}
    >
      <div className="fixed inset-x-4 bottom-4 z-50 rounded-[2rem] bg-white p-6 shadow-2xl max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#074738]">Invitar amigos a Pessy</h2>
            <p className="mt-1 text-sm text-[#5e716b]">
              Compartí un link de acceso — válido por 24 horas.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="ml-4 text-[#5e716b] hover:text-[#074738] transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Generate button */}
        {!inviteUrl && (
          <button
            onClick={handleGenerate}
            disabled={loading || !user}
            className="w-full rounded-full bg-[#074738] py-3 text-sm font-bold uppercase tracking-[0.16em] text-white disabled:opacity-60"
          >
            {loading ? "Generando…" : "Generar link"}
          </button>
        )}

        {/* Error */}
        {error && (
          <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
        )}

        {/* Result */}
        {inviteUrl && (
          <div className="mt-2 space-y-3">
            <p className="text-xs text-[#5e716b] text-center">
              Este link expira en 24 horas y es de un solo uso.
            </p>

            <div className="rounded-xl bg-[#f0faf9] border border-[#b5efd9] px-4 py-3 text-xs font-mono text-[#074738] break-all">
              {inviteUrl}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 rounded-full bg-[#074738] py-3 text-sm font-bold uppercase tracking-[0.16em] text-white disabled:opacity-60"
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
              <button
                onClick={handleShare}
                className="flex-1 rounded-full border-2 border-[#074738] py-3 text-sm font-bold uppercase tracking-[0.16em] text-[#074738]"
              >
                Compartir
              </button>
            </div>

            <button
              onClick={() => {
                setInviteUrl(null);
                setCopied(false);
              }}
              className="w-full text-xs text-[#5e716b] underline underline-offset-2 py-1"
            >
              Generar otro link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
