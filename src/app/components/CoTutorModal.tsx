import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../contexts/PetContext";

interface CoTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CoTutorModal({ isOpen, onClose }: CoTutorModalProps) {
  const { user } = useAuth();
  const {
    activePet,
    isOwner,
    generateInviteCode,
    joinWithCode,
    removeCoTutor,
    leaveAsTutor,
  } = usePet();

  const [generatedCode, setGeneratedCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const ownerView = useMemo(() => {
    if (!activePet) return false;
    return isOwner(activePet);
  }, [activePet, isOwner]);

  const coTutors = activePet?.coTutors || [];

  const handleGenerateCode = async () => {
    if (!activePet) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const code = await generateInviteCode(activePet.id);
      setGeneratedCode(code);
      setMessage("Código generado. Vence en 48 horas.");
    } catch (err: any) {
      setError(err?.message || "No se pudo generar el código.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await joinWithCode(joinCode.trim());
      setMessage(`Te uniste correctamente a ${result.petName}.`);
      setJoinCode("");
    } catch (err: any) {
      setError(err?.message || "No se pudo validar el código.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (coTutorUid: string) => {
    if (!activePet) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await removeCoTutor(activePet.id, coTutorUid);
      setMessage("Co-tutor eliminado.");
    } catch (err: any) {
      setError(err?.message || "No se pudo eliminar el co-tutor.");
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!activePet) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await leaveAsTutor(activePet.id);
      setMessage("Dejaste de ser co-tutor.");
      onClose();
    } catch (err: any) {
      setError(err?.message || "No se pudo salir del acceso compartido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-0 z-[61] bg-white dark:bg-slate-900 rounded-t-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Co-tutores</h3>
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
              >
                Cerrar
              </button>
            </div>

            {ownerView ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                    Generá un código para compartir acceso de esta mascota.
                  </p>
                  <button
                    onClick={handleGenerateCode}
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-[#2b6fee] text-white font-bold disabled:opacity-60"
                  >
                    {loading ? "Generando..." : "Generar código"}
                  </button>
                  {generatedCode && (
                    <div className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">Código</p>
                      <p className="text-2xl tracking-[0.2em] font-black text-slate-900 dark:text-white">
                        {generatedCode}
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                    Co-tutores actuales ({coTutors.length})
                  </p>
                  {coTutors.length === 0 && (
                    <p className="text-sm text-slate-500">No hay co-tutores registrados.</p>
                  )}
                  <div className="space-y-2">
                    {coTutors.map((coTutor) => (
                      <div
                        key={coTutor.uid}
                        className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 p-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {coTutor.name || coTutor.email || "Usuario"}
                          </p>
                          <p className="text-xs text-slate-500">{coTutor.email || coTutor.uid}</p>
                        </div>
                        <button
                          onClick={() => handleRemove(coTutor.uid)}
                          disabled={loading}
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 font-semibold disabled:opacity-60"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                    Ingresá un código para sumarte como co-tutor.
                  </p>
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Código de 6 caracteres"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium mb-3"
                    maxLength={12}
                  />
                  <button
                    onClick={handleJoin}
                    disabled={loading || joinCode.trim().length === 0}
                    className="w-full py-3 rounded-xl bg-[#2b6fee] text-white font-bold disabled:opacity-60"
                  >
                    {loading ? "Validando..." : "Unirme con código"}
                  </button>
                </div>

                {activePet && user && !isOwner(activePet) && (
                  <button
                    onClick={handleLeave}
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-red-50 text-red-600 font-bold disabled:opacity-60"
                  >
                    Dejar de ser co-tutor
                  </button>
                )}
              </div>
            )}

            {message && (
              <p className="mt-4 text-sm text-emerald-600 font-semibold">{message}</p>
            )}
            {error && (
              <p className="mt-2 text-sm text-red-600 font-semibold">{error}</p>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
