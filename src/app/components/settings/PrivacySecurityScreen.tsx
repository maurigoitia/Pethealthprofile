import { useEffect, useState } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { useAuth } from "../../contexts/AuthContext";
import {
  disconnectGmailSync,
  GmailSyncStatus,
  startGmailConnectFlow,
  subscribeGmailSyncStatus,
} from "../../services/gmailSyncService";
import { deleteUserAccount, deleteAllUserClinicalData } from "../../services/accountDeletionService";
import { exportAllUserData, downloadAsJSON } from "../../services/dataExportService";
import { clearAllSensitiveData } from "../../utils/secureStorage";
import { auth, db } from "../../../lib/firebase";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { toast } from "sonner";
import { GmailConsentScreen } from "../auth/GmailConsentScreen";

interface PrivacySecurityScreenProps {
  onBack: () => void;
  onLogout: () => void;
  autoOpenGmail?: boolean;
}

export function PrivacySecurityScreen({ onBack, onLogout, autoOpenGmail }: PrivacySecurityScreenProps) {
  const { user } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<GmailSyncStatus>({
    connected: false,
    accountEmail: null,
    grantedScopes: [],
    updatedAt: null,
    syncStatus: "idle",
    ingestionStatus: "idle",
    inviteEnabled: true,
    inviteStatus: "open_access",
    inviteReason: null,
  });
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailActionLoading, setGmailActionLoading] = useState(false);
  const [showGmailConsent, setShowGmailConsent] = useState(autoOpenGmail ?? false);
  const [clinicalDeleteLoading, setClinicalDeleteLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setGmailStatus({
        connected: false,
        accountEmail: null,
        grantedScopes: [],
        updatedAt: null,
        syncStatus: "idle",
        ingestionStatus: "idle",
        inviteEnabled: true,
        inviteStatus: "open_access",
        inviteReason: null,
      });
      setGmailLoading(false);
      return;
    }

    setGmailLoading(true);
    const unsubscribe = subscribeGmailSyncStatus(user.uid, (status) => {
      setGmailStatus(status);
      setGmailLoading(false);
    });
    return unsubscribe;
  }, [user?.uid]);

  const handleChangePassword = async () => {
    setPasswordError("");

    // BUG-02 fix: client-side validations
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      setPasswordError("Completá todos los campos.");
      return;
    }
    if (passwords.new !== passwords.confirm) {
      setPasswordError("Las contraseñas nuevas no coinciden.");
      return;
    }
    if (passwords.new.length < 8) {
      setPasswordError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      toast.error("No se pudo obtener tu email. Intentá cerrar sesión y volver a entrar.");
      return;
    }

    // BUG-08 fix: loading state
    setPasswordLoading(true);
    try {
      // BUG-01 fix: reauthenticate + updatePassword instead of sendPasswordResetEmail
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwords.current
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, passwords.new);

      toast.success("Contraseña actualizada correctamente.");
      // BUG-07 fix: only close accordion on success
      setShowChangePassword(false);
      setPasswords({ current: "", new: "", confirm: "" });
      setPasswordError("");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setPasswordError("La contraseña actual es incorrecta.");
      } else if (code === "auth/weak-password") {
        setPasswordError("La contraseña nueva es demasiado débil.");
      } else {
        setPasswordError("No se pudo actualizar la contraseña. Intentá de nuevo.");
      }
      // BUG-07 fix: keep accordion open on error so the user sees the message
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogoutOtherDevices = () => {
    toast.info("Próximamente: gestión avanzada de dispositivos.");
  };

  const clearClientArtifacts = async () => {
    localStorage.clear();
    sessionStorage.clear();

    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key).catch(() => false)));
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteLoading) return;

    setDeleteLoading(true);
    setDeleteError("");

    try {
      await deleteUserAccount();
      setShowDeleteConfirm(false);
      // SECURITY: Limpiar TODOS los datos del cliente (GDPR Art. 17)
      clearAllSensitiveData();
      await clearClientArtifacts();
      await auth.signOut().catch(() => undefined);
      window.location.assign("/");
    } catch (error) {
      console.error("No se pudo eliminar la cuenta:", error);
      setDeleteError("No pudimos eliminar tu cuenta completa. Reintentá en unos minutos.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // GDPR Art. 20 — Portabilidad de datos
  const [exportLoading, setExportLoading] = useState(false);
  const handleExportData = async () => {
    if (!user?.uid || exportLoading) return;
    setExportLoading(true);
    try {
      const { doc: docRef, getDoc: getDocFn } = await import("firebase/firestore");
      const userSnap = await getDocFn(docRef(db, "users", user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};

      // Obtener IDs de mascotas del usuario
      const { collection: colRef, query: queryFn, where: whereFn, getDocs: getDocsFn } = await import("firebase/firestore");
      const petsQuery = queryFn(colRef(db, "pets"), whereFn("ownerId", "==", user.uid));
      const petsSnap = await getDocsFn(petsQuery);
      const petIds = petsSnap.docs.map(d => d.id);
      const petsData = petsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const exported = await exportAllUserData(user.uid, userData, petIds);
      exported.pets = petsData;
      downloadAsJSON(exported);
      toast.success("Datos exportados correctamente");
    } catch (err) {
      console.error("Error exportando datos:", err);
      toast.error("No se pudieron exportar los datos. Intentá de nuevo.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleConnectGmail = () => {
    setShowGmailConsent(true);
  };

  const handleGmailConsentAccepted = async () => {
    if (gmailActionLoading) return;
    setGmailActionLoading(true);
    setShowGmailConsent(false);
    try {
      await startGmailConnectFlow();
    } catch (error: any) {
      console.error("No se pudo iniciar OAuth Gmail:", error);
      const msg = error?.message || "Error desconocido al iniciar la conexión.";
      alert(`No se pudo conectar Gmail: ${msg}`);
      setGmailActionLoading(false);
    }
  };

  const handleDisconnectGmail = async () => {
    if (gmailActionLoading) return;
    if (!confirm("¿Desconectar Gmail Sync?")) return;
    setGmailActionLoading(true);
    try {
      await disconnectGmailSync();
    } catch (error) {
      console.error("No se pudo desconectar Gmail Sync:", error);
      alert("No se pudo desconectar Gmail. Reintentá en unos segundos.");
    } finally {
      setGmailActionLoading(false);
    }
  };

  const handleDeleteClinicalData = async () => {
    if (clinicalDeleteLoading) return;
    if (!confirm("¿Borrar todos los datos clínicos y de Gmail? Tu cuenta y mascotas se mantienen, pero se pierde toda la historia médica.")) return;
    setClinicalDeleteLoading(true);
    try {
      await deleteAllUserClinicalData();
      toast.success("Datos clínicos eliminados correctamente.");
    } catch (error) {
      console.error("No se pudieron eliminar datos clínicos:", error);
      toast.error("No se pudieron eliminar los datos clínicos. Reintentá en unos minutos.");
    } finally {
      setClinicalDeleteLoading(false);
    }
  };

  return (
    <div className="bg-[#F0FAF9] dark:bg-[#101622] min-h-screen">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 py-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Volver"
              className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-[#074738] focus-visible:ring-offset-2"
            >
              <MaterialIcon name="arrow_back" className="text-xl" aria-hidden />
            </button>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Privacidad y Seguridad
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Change Password */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowChangePassword(!showChangePassword)}
              className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-[#074738]/10 flex items-center justify-center">
                  <MaterialIcon name="lock" className="text-[#074738] text-xl" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Cambiar contraseña
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Actualiza tu contraseña
                  </p>
                </div>
              </div>
              <MaterialIcon
                name={showChangePassword ? "expand_less" : "expand_more"}
                className="text-slate-400"
              />
            </button>

            {showChangePassword && (
              <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                {/* BUG-03 fix: autocomplete attributes / BUG-04 fix: PasswordFieldWithToggle */}
                <PasswordFieldWithToggle
                  placeholder="Contraseña actual"
                  autoComplete="current-password"
                  value={passwords.current}
                  onChange={(v) => setPasswords({ ...passwords, current: v })}
                />
                <PasswordFieldWithToggle
                  placeholder="Nueva contraseña"
                  autoComplete="new-password"
                  value={passwords.new}
                  onChange={(v) => setPasswords({ ...passwords, new: v })}
                />
                {/* BUG-05 fix: password strength hints */}
                {passwords.new.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs" aria-live="polite">
                    <span className={passwords.new.length >= 8 ? "text-emerald-600" : "text-slate-400"}>
                      {passwords.new.length >= 8 ? "✓" : "○"} 8+ caracteres
                    </span>
                    <span className={/[A-Z]/.test(passwords.new) ? "text-emerald-600" : "text-slate-400"}>
                      {/[A-Z]/.test(passwords.new) ? "✓" : "○"} Mayúscula
                    </span>
                    <span className={/[0-9]/.test(passwords.new) ? "text-emerald-600" : "text-slate-400"}>
                      {/[0-9]/.test(passwords.new) ? "✓" : "○"} Número
                    </span>
                  </div>
                )}
                <PasswordFieldWithToggle
                  placeholder="Confirmar nueva contraseña"
                  autoComplete="new-password"
                  value={passwords.confirm}
                  onChange={(v) => setPasswords({ ...passwords, confirm: v })}
                />
                {/* Show inline error */}
                {passwordError && (
                  <p role="alert" className="text-sm text-red-500 font-medium">{passwordError}</p>
                )}
                {/* BUG-06 fix: type="button" since no <form>; BUG-08 fix: disabled during loading */}
                <button
                  type="button"
                  onClick={() => void handleChangePassword()}
                  disabled={passwordLoading}
                  className="w-full py-3 rounded-xl bg-[#074738] text-white font-bold hover:bg-[#1a9b7d] transition-colors disabled:opacity-60"
                >
                  {passwordLoading ? "Guardando..." : "Cambiar contraseña"}
                </button>
              </div>
            )}
          </div>

          {/* Logout Other Devices */}
          <button
            type="button"
            onClick={handleLogoutOtherDevices}
            className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <MaterialIcon name="devices" className="text-amber-500 text-xl" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Cerrar sesión en otros dispositivos
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cierra tu sesión en todos los demás dispositivos
                </p>
              </div>
            </div>
            <MaterialIcon name="chevron_right" className="text-slate-400" />
          </button>
          {false && (

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg bg-[#074738]/10 flex items-center justify-center shrink-0">
                <MaterialIcon name="mail" className="text-[#074738] text-xl" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Sincronización Gmail (Pessy App)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Permiso solicitado por Pessy para leer correos de turnos y documentos y ordenar la informacion de tu mascota.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  Scope: <span className="font-semibold">gmail.readonly</span>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Estado:{" "}
                  <span className={gmailStatus.connected ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                    {gmailLoading ? "verificando..." : gmailStatus.connected ? "conectado" : "desconectado"}
                  </span>
                </p>
                {!gmailStatus.connected && !gmailLoading && !gmailStatus.inviteEnabled && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Acceso: <span className="font-semibold">solo por invitación</span>
                  </p>
                )}
                {gmailStatus.accountEmail && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Cuenta: <span className="font-semibold">{gmailStatus.accountEmail}</span>
                  </p>
                )}
                <div className="mt-3">
                  {gmailStatus.connected ? (
                    <button
                      type="button"
                      onClick={() => void handleDisconnectGmail()}
                      disabled={gmailActionLoading}
                      className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-60"
                    >
                      {gmailActionLoading ? "Procesando..." : "Desconectar Gmail"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleConnectGmail()}
                      disabled={gmailActionLoading || gmailLoading || !gmailStatus.inviteEnabled}
                      className="px-3 py-2 rounded-lg bg-[#074738] text-white text-xs font-bold hover:bg-[#074738] transition-colors disabled:opacity-60"
                    >
                      {gmailActionLoading
                        ? "Abriendo Google..."
                        : gmailStatus.inviteEnabled
                          ? "Conectar Gmail"
                          : "Solo por invitación"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Privacy Policy */}
          <a
            href="https://pessy.app/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <MaterialIcon name="privacy_tip" className="text-slate-600 dark:text-slate-400 text-xl" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Política de privacidad
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lee cómo protegemos tus datos
                </p>
              </div>
            </div>
            <MaterialIcon name="open_in_new" className="text-slate-400" />
          </a>

          {/* GDPR: Delete Clinical Data Only */}
          <button
            type="button"
            onClick={() => void handleDeleteClinicalData()}
            disabled={clinicalDeleteLoading}
            className="w-full bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/30 p-4 flex items-center justify-between hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <MaterialIcon name="healing" className="text-amber-600 text-xl" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-amber-700 dark:text-amber-400">
                  {clinicalDeleteLoading ? "Eliminando..." : "Borrar datos clínicos"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Elimina historia médica y datos de Gmail. Tu cuenta y mascotas se mantienen.
                </p>
              </div>
            </div>
            <MaterialIcon name="chevron_right" className="text-amber-400" />
          </button>

          {/* GDPR Art. 20 — Data Export / Portability */}
          <button
            type="button"
            onClick={() => void handleExportData()}
            disabled={exportLoading}
            className="w-full bg-white dark:bg-slate-900 rounded-xl border border-[#1A9B7D]/30 p-4 flex items-center justify-between hover:bg-[#F0FAF9] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-[#E0F2F1] flex items-center justify-center">
                <MaterialIcon name="download" className="text-[#1A9B7D] text-xl" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-[#074738]">
                  {exportLoading ? "Exportando..." : "Descargar mis datos"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Descargá una copia completa de tus datos en formato JSON
                </p>
              </div>
            </div>
            <MaterialIcon name="chevron_right" className="text-[#1A9B7D]" />
          </button>

          {/* Delete Account */}
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/30 p-4 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <MaterialIcon name="delete_forever" className="text-red-500 text-xl" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-red-600 dark:text-red-400">
                  Eliminar cuenta
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Elimina permanentemente tu cuenta y datos
                </p>
              </div>
            </div>
            <MaterialIcon name="chevron_right" className="text-red-400" />
          </button>
        </div>
      </div>

      {/* Gmail Consent Screen — Apple 5.1.1 / Google Data Safety compliant */}
      {showGmailConsent && (
        <GmailConsentScreen
          onAccept={() => void handleGmailConsentAccepted()}
          onDecline={() => setShowGmailConsent(false)}
          loading={gmailActionLoading}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full">
            <div className="size-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <MaterialIcon name="warning" className="text-red-500 text-4xl" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white text-center mb-2">
              ¿Eliminar cuenta?
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-6">
              Esta acción es permanente y no se puede deshacer. Se eliminarán todos tus
              datos y la historia de tus mascotas.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteAccount()}
                disabled={deleteLoading}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {deleteLoading ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
            {deleteError && (
              <p className="mt-4 text-sm text-red-500 text-center">
                {deleteError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** BUG-04 fix: Reusable password input with show/hide toggle */
function PasswordFieldWithToggle({
  placeholder,
  autoComplete,
  value,
  onChange,
}: {
  placeholder: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#074738]"
      />
      <button
        type="button"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        <MaterialIcon name={visible ? "visibility_off" : "visibility"} className="text-xl" aria-hidden />
      </button>
    </div>
  );
}
