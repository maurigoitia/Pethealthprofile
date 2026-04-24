import { useState } from "react";

import { MaterialIcon } from "../shared/MaterialIcon";
import { usePet, CoTutor } from "../../contexts/PetContext";
import { buildCoTutorReferralUrl } from "../../utils/coTutorInvite";

interface CoTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CoTutorModal({ isOpen, onClose }: CoTutorModalProps) {
  const { activePet, activePetId, generateInviteCode, sendCoTutorInviteEmail, joinWithCode, removeCoTutor, leaveAsTutor, isOwner } = usePet();

  const [tab, setTab] = useState<"manage" | "join">("manage");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatedExpiresAt, setGeneratedExpiresAt] = useState<number | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [loadingEmailInvite, setLoadingEmailInvite] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [emailWarning, setEmailWarning] = useState("");
  const [lastFailedEmail, setLastFailedEmail] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const owner = activePet ? isOwner(activePet) : false;
  const coTutors: CoTutor[] = activePet?.coTutors || [];

  const handleGenerateCode = async () => {
    if (!activePetId) return;
    setLoadingCode(true);
    setError("");
    try {
      const code = await generateInviteCode(activePetId);
      setGeneratedCode(code);
      setGeneratedExpiresAt(Date.now() + 48 * 60 * 60 * 1000);
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

  const handleCopyLink = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(buildCoTutorReferralUrl(generatedCode));
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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
    setEmailWarning("");
    const targetEmail = inviteEmail.trim().toLowerCase();
    try {
      const { code, emailSent } = await sendCoTutorInviteEmail(activePetId, inviteEmail);
      setGeneratedCode(code);
      setGeneratedExpiresAt(Date.now() + 48 * 60 * 60 * 1000);
      if (emailSent === false) {
        setEmailWarning(targetEmail);
        setLastFailedEmail(targetEmail);
      } else {
        setSuccess(`Invitación enviada a ${targetEmail}. Revisá el correo del co-tutor.`);
        setLastFailedEmail("");
      }
      setInviteEmail("");
    } catch (e: any) {
      setError(e.message || "No se pudo enviar la invitación por correo.");
      setLastFailedEmail(targetEmail);
    } finally {
      setLoadingEmailInvite(false);
    }
  };

  const handleRetryEmail = async () => {
    if (!activePetId || !lastFailedEmail) return;
    setLoadingEmailInvite(true);
    setError("");
    setEmailWarning("");
    try {
      const { code, emailSent } = await sendCoTutorInviteEmail(activePetId, lastFailedEmail);
      setGeneratedCode(code);
      setGeneratedExpiresAt(Date.now() + 48 * 60 * 60 * 1000);
      if (emailSent === false) {
        setEmailWarning(lastFailedEmail);
      } else {
        setSuccess(`Invitación enviada a ${lastFailedEmail}.`);
        setLastFailedEmail("");
      }
    } catch (e: any) {
      setError(e.message || "No se pudo reenviar la invitación.");
    } finally {
      setLoadingEmailInvite(false);
    }
  };

  const handleRemove = (uid: string, name: string) => {
    if (!activePetId) return;
    setConfirmAction({
      title: "Eliminar co-tutor",
      message: `¿Eliminar a ${name} como co-tutor? Perderá acceso a la mascota.`,
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        try {
          await removeCoTutor(activePetId, uid);
        } catch (e: any) {
          setError(e.message || "Error al eliminar co-tutor");
        }
      },
    });
  };

  const handleLeave = () => {
    if (!activePetId) return;
    setConfirmAction({
      title: "Dejar de ser co-tutor",
      message: "¿Querés dejar de ser co-tutor de esta mascota? Vas a perder el acceso.",
      confirmLabel: "Salir",
      onConfirm: async () => {
        try {
          await leaveAsTutor(activePetId);
          onClose();
        } catch (e: any) {
          setError(e.message || "Error al salir");
        }
      },
    });
  };

  if (!isOpen) return null;

  return (
        <>
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fadeIn"
          />
          <div



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
                onClick={() => { setTab("manage"); setError(""); setSuccess(""); setEmailWarning(""); }}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${tab === "manage" ? "bg-white dark:bg-slate-900 text-[#074738] shadow-sm" : "text-slate-500"}`}
              >
                {owner ? "Gestionar" : "Mi acceso"}
              </button>
              <button
                onClick={() => { setTab("join"); setError(""); setSuccess(""); setEmailWarning(""); }}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${tab === "join" ? "bg-white dark:bg-slate-900 text-[#074738] shadow-sm" : "text-slate-500"}`}
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
              {emailWarning && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium space-y-2">
                  <div className="flex items-start gap-2">
                    <MaterialIcon name="warning" className="text-base shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold">No pudimos enviar el email a {emailWarning}</p>
                      <p className="text-xs text-amber-700 mt-0.5 font-normal">El código se generó. Compartilo manualmente o reintentá el envío.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetryEmail}
                    disabled={loadingEmailInvite}
                    className="w-full px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
                  >
                    {loadingEmailInvite
                      ? <div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <MaterialIcon name="refresh" className="text-sm" />}
                    Reintentar envío
                  </button>
                </div>
              )}

              {tab === "manage" && (
                <>
                  {owner ? (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Invitar co-tutor</p>
                        <p className="text-xs text-slate-500 mb-3">Enviá magic link por email o compartí código manual de 6 caracteres válido por 48 horas.</p>
                        {/* Permisos explícitos — qué puede y qué no puede hacer un co-tutor */}
                        <div className="mb-3 rounded-xl bg-[#E0F2F1]/60 border border-[#1A9B7D]/20 px-3 py-2.5">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#074738] mb-1.5">Qué puede hacer un co-tutor</p>
                          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300 leading-snug">
                            <li className="flex items-start gap-1.5">
                              <MaterialIcon name="check_circle" className="text-sm text-[#1A9B7D] shrink-0 mt-px" />
                              <span>Ver historial, vacunas y rutinas</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <MaterialIcon name="check_circle" className="text-sm text-[#1A9B7D] shrink-0 mt-px" />
                              <span>Subir documentos y registrar eventos</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <MaterialIcon name="check_circle" className="text-sm text-[#1A9B7D] shrink-0 mt-px" />
                              <span>Recibir recordatorios de turnos y meds</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <MaterialIcon name="cancel" className="text-sm text-slate-400 shrink-0 mt-px" />
                              <span className="text-slate-500">No puede eliminar la mascota ni sacar co-tutores</span>
                            </li>
                          </ul>
                        </div>
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
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 bg-white dark:bg-slate-900 border-2 border-[#074738] rounded-xl px-4 py-3 text-center">
                                <span className="text-2xl font-black tracking-[0.3em] text-[#074738]">{generatedCode}</span>
                              </div>
                              <button onClick={handleCopy} className="size-12 rounded-xl bg-[#074738] text-white flex items-center justify-center shadow-lg">
                                <MaterialIcon name={copied ? "check" : "content_copy"} className="text-xl" />
                              </button>
                            </div>
                            {generatedExpiresAt && (
                              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 px-1">
                                <MaterialIcon name="schedule" className="text-sm" />
                                Válido hasta{" "}
                                <span className="font-semibold text-slate-700">
                                  {new Date(generatedExpiresAt).toLocaleString("es-AR", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </p>
                            )}
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-1">Link de invitación</p>
                              <p className="text-xs text-slate-600 dark:text-slate-300 break-all leading-5">
                                {buildCoTutorReferralUrl(generatedCode)}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={handleCopyLink}
                                className="py-3 rounded-xl border border-[#074738]/20 text-[#074738] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
                              >
                                <MaterialIcon name={copiedLink ? "check" : "link"} className="text-base" />
                                {copiedLink ? "Copiado" : "Copiar link"}
                              </button>
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(
                                  `Te invito a ser co-tutor de ${activePet?.name || "mi mascota"} en Pessy 🐾\n\n${buildCoTutorReferralUrl(generatedCode)}`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="py-3 rounded-xl bg-[#25D366] text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
                              >
                                <MaterialIcon name="chat" className="text-base" />
                                WhatsApp
                              </a>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-4">
                              Este link lleva al co-tutor a entrar o crear cuenta y completar el acceso a la mascota.
                            </p>
                          </div>
                        ) : (
                          <button onClick={handleGenerateCode} disabled={loadingCode}
                            className="w-full py-3 rounded-xl bg-[#074738] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                            {loadingCode
                              ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              : <MaterialIcon name="add_link" className="text-lg" />}
                            Generar código de invitación
                          </button>
                        )}
                        {generatedCode && (
                          <button onClick={() => { setGeneratedCode(null); setGeneratedExpiresAt(null); }} className="w-full mt-2 py-2 text-xs text-slate-500 font-semibold">
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
                                <div className="size-10 rounded-full bg-[#074738]/10 flex items-center justify-center">
                                  <MaterialIcon name="person" className="text-[#074738] text-lg" />
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
                      className="w-full text-center text-2xl font-black tracking-[0.3em] border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#074738] focus:outline-none mb-3"
                    />
                    <button onClick={handleJoin} disabled={loadingJoin || joinCode.length < 6}
                      className="w-full py-3 rounded-xl bg-[#074738] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                      {loadingJoin
                        ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <MaterialIcon name="group_add" className="text-lg" />}
                      Unirme como co-tutor
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Confirm dialog custom — reemplaza confirm() nativo */}
          {confirmAction && (
            <>
              <div
                onClick={() => setConfirmAction(null)}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
              />
              <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[92%] max-w-sm rounded-[20px] bg-white dark:bg-slate-900 shadow-xl p-6">
                <h3 className="text-lg font-extrabold text-[#074738] dark:text-white mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {confirmAction.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5" style={{ fontFamily: "Manrope, sans-serif" }}>
                  {confirmAction.message}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="min-h-[44px] rounded-[12px] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm active:scale-[0.97] transition-transform"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const action = confirmAction;
                      setConfirmAction(null);
                      await action.onConfirm();
                    }}
                    className="min-h-[44px] rounded-[12px] bg-red-500 text-white font-bold text-sm active:scale-[0.97] transition-transform"
                  >
                    {confirmAction.confirmLabel}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
  );
}
