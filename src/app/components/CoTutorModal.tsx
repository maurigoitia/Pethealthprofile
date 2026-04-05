import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";
import { usePet, CoTutor } from "../contexts/PetContext";

interface CoTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CoTutorModal({ isOpen, onClose }: CoTutorModalProps) {
  const { activePet, activePetId, generateInviteCode, sendCoTutorInviteEmail, joinWithCode, removeCoTutor, leaveAsTutor, isOwner } = usePet();

  const [tab, setTab] = useState<"manage" | "join">("manage");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [loadingEmailInvite, setLoadingEmailInvite] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);

  const owner = activePet ? isOwner(activePet) : false;
  const coTutors: CoTutor[] = activePet?.coTutors || [];

  const handleGenerateCode = async () => {
    if (!activePetId) return;
    setLoadingCode(true);
    setError("");
    try {
      const code = await generateInviteCode(activePetId);
      setGeneratedCode(code);
    } catch (e: any) {
      setError(e.message || "Error generando código");
    } finally {
      setLoadingCode(false);
    }
  };

  const handleCopy = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setLoadingJoin(true);
    setError("");
    setSuccess("");
    try {
      const { petName } = await joinWithCode(joinCode);
      setSuccess(`¡Te uniste como co-tutor de ${petName}!`);
      setJoinCode("");
    } catch (e: any) {
      setError(e.message || "Error al unirse");
    } finally {
      setLoadingJoin(false);
    }
  };

  const handleSendEmailInvite = async () => {
    if (!activePetId) return;
    if (!inviteEmail.trim()) return;
    setLoadingEmailInvite(true);
    setError("");
    setSuccess("");
    try {
      const { code } = await sendCoTutorInviteEmail(activePetId, inviteEmail);
      setGeneratedCode(code);
      setSuccess(`Invitación enviada a ${inviteEmail.trim().toLowerCase()}. Revisá el correo del co-tutor.`);
      setInviteEmail("");
    } catch (e: any) {
      setError(e.message || "No se pudo enviar la invitación por correo.");
    } finally {
      setLoadingEmailInvite(false);
    }
  };

  const handleRemove = async (uid: string, name: string) => {
    if (!activePetId) return;
    if (!confirm(`¿Eliminar a ${name} como co-tutor?`)) return;
    try {
      await removeCoTutor(activePetId, uid);
    } catch (e: any) {
      setError(e.message || "Error al eliminar co-tutor");
    }
  };

  const handleLeave = async () => {
    if (!activePetId) return;
    if (!confirm("¿Querés dejar de ser co-tutor de esta mascota?")) return;
    try {
      await leaveAsTutor(activePetId);
      onClose();
    } catch (e: any) {
      setError(e.message || "Error al salir");
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col max-w-md mx-auto"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>

            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Co-tutores</h2>
                <p className="text-xs text-slate-500">{activePet?.name}</p>
              </div>
              <button onClick={onClose} className="size-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <MaterialIcon name="close" className="text-lg" />
              </button>
            </div>

            <div className="flex gap-2 mx-5 mt-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => { setTab("manage"); setError(""); setSuccess(""); }}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${tab === "manage" ? "bg-white dark:bg-slate-900 text-[#2b6fee] shadow-sm" : "text-slate-500"}`}
              >
                {owner ? "Gestionar" : "Mi acceso"}
              </button>
              <button
                onClick={() => { setTab("join"); setError(""); setSuccess(""); }}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${tab === "join" ? "bg-white dark:bg-slate-900 text-[#2b6fee] shadow-sm" : "text-slate-500"}`}
              >
                Unirme con código
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-xl text-sm text-red-700 dark:text-red-300 font-medium">{error}</div>
              )}
              {success && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 rounded-xl text-sm text-emerald-700 dark:text-emerald-300 font-medium">{success}</div>
              )}

              {tab === "manage" && (
                <>
                  {owner ? (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Invitar co-tutor</p>
                        <p className="text-xs text-slate-500 mb-3">Enviá magic link por email o compartí código manual de 6 caracteres válido por 48 horas.</p>
                        <div className="flex gap-2 mb-3">
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="email del co-tutor"
                            className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                          />
                          <button
                            onClick={handleSendEmailInvite}
                            disabled={loadingEmailInvite || !inviteEmail.includes("@")}
                            className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-xs disabled:opacity-60 flex items-center gap-2"
                          >
                            {loadingEmailInvite
                              ? <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              : <MaterialIcon name="mail" className="text-sm" />}
                            Enviar
                          </button>
                        </div>
                        {generatedCode ? (
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-white dark:bg-slate-900 border-2 border-[#2b6fee] rounded-xl px-4 py-3 text-center">
                              <span className="text-2xl font-black tracking-[0.3em] text-[#2b6fee]">{generatedCode}</span>
                            </div>
                            <button onClick={handleCopy} className="size-12 rounded-xl bg-[#2b6fee] text-white flex items-center justify-center shadow-lg">
                              <MaterialIcon name={copied ? "check" : "content_copy"} className="text-xl" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={handleGenerateCode} disabled={loadingCode}
                            className="w-full py-3 rounded-xl bg-[#2b6fee] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                            {loadingCode
                              ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              : <MaterialIcon name="add_link" className="text-lg" />}
                            Generar código de invitación
                          </button>
                        )}
                        {generatedCode && (
                          <button onClick={() => setGeneratedCode(null)} className="w-full mt-2 py-2 text-xs text-slate-500 font-semibold">
                            Generar otro código
                          </button>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Co-tutores actuales ({coTutors.length})</p>
                        {coTutors.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-sm">Todavía no hay co-tutores</div>
                        ) : (
                          <div className="space-y-2">
                            {coTutors.map((ct) => (
                              <div key={ct.uid} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="size-10 rounded-full bg-[#2b6fee]/10 flex items-center justify-center">
                                  <MaterialIcon name="person" className="text-[#2b6fee] text-lg" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{ct.name || ct.email || ct.uid}</p>
                                  {ct.email && ct.name && <p className="text-xs text-slate-500 truncate">{ct.email}</p>}
                                </div>
                                <button onClick={() => handleRemove(ct.uid, ct.name || ct.email || "este usuario")}
                                  className="size-8 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-500">
                                  <MaterialIcon name="person_remove" className="text-base" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Sos co-tutor de <strong>{activePet?.name}</strong>. Podés subir documentos, editar datos y agregar citas.
                      </p>
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                        <MaterialIcon name="info" className="text-sm inline mr-1 align-text-bottom" />
                        Solo el dueño puede gestionar otros co-tutores o eliminar la mascota.
                      </div>
                      <button onClick={handleLeave}
                        className="w-full py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 text-red-600 font-bold text-sm">
                        Dejar de ser co-tutor
                      </button>
                    </div>
                  )}
                </>
              )}

              {tab === "join" && (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Ingresar código de invitación</p>
                    <p className="text-xs text-slate-500 mb-3">Si recibiste magic link por email, abrilo directamente. Si no, pedile al dueño un código y escribilo acá.</p>
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="EJ: AB3X7K"
                      maxLength={6}
                      className="w-full text-center text-2xl font-black tracking-[0.3em] border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#2b6fee] focus:outline-none mb-3"
                    />
                    <button onClick={handleJoin} disabled={loadingJoin || joinCode.length < 6}
                      className="w-full py-3 rounded-xl bg-[#2b6fee] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                      {loadingJoin
                        ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <MaterialIcon name="group_add" className="text-lg" />}
                      Unirme como co-tutor
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
