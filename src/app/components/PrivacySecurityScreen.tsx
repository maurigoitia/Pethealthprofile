import { useEffect, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { useAuth } from "../contexts/AuthContext";
import {
  disconnectGmailSync,
  GmailSyncStatus,
  startGmailConnectFlow,
  subscribeGmailSyncStatus,
} from "../services/gmailSyncService";
import { deleteUserAccount } from "../services/accountDeletionService";
import { auth } from "../../lib/firebase";

interface PrivacySecurityScreenProps {
  onBack: () => void;
  onLogout: () => void;
}

export function PrivacySecurityScreen({ onBack, onLogout }: PrivacySecurityScreenProps) {
  const { user } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<GmailSyncStatus>({
    connected: false,
    accountEmail: null,
    grantedScopes: [],
    updatedAt: null,
    inviteEnabled: true,
    inviteStatus: "open_access",
    inviteReason: null,
  });
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailActionLoading, setGmailActionLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  useEffect(() => {
    if (!user?.uid) {
      setGmailStatus({
        connected: false,
        accountEmail: null,
        grantedScopes: [],
        updatedAt: null,
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

  const handleChangePassword = () => {
    if (passwords.new !== passwords.confirm) {
      alert("Las contraseñas no coinciden");
      return;
    }
    if (passwords.new.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    // Simulate password change
    alert("Contraseña cambiada exitosamente");
    setShowChangePassword(false);
    setPasswords({ current: "", new: "", confirm: "" });
  };

  const handleLogoutOtherDevices = () => {
    alert("Sesión cerrada en todos los demás dispositivos");
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

  const handleConnectGmail = async () => {
    if (gmailActionLoading) return;
    setGmailActionLoading(true);
    try {
      await startGmailConnectFlow();
    } catch (error) {
      console.error("No se pudo iniciar OAuth Gmail:", error);
      alert("No se pudo iniciar la conexión con Gmail. Revisá configuración de OAuth y dominios autorizados.");
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

  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 py-4 flex items-center gap-3">
            <button
              onClick={onBack}
              className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <MaterialIcon name="arrow_back" className="text-xl" />
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
                <input
                  type="password"
                  placeholder="Contraseña actual"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#074738]"
                />
                <input
                  type="password"
                  placeholder="Nueva contraseña"
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#074738]"
                />
                <input
                  type="password"
                  placeholder="Confirmar nueva contraseña"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#074738]"
                />
                <button
                  onClick={handleChangePassword}
                  className="w-full py-3 rounded-xl bg-[#074738] text-white font-bold hover:bg-[#1a9b7d] transition-colors"
                >
                  Cambiar contraseña
                </button>
              </div>
            )}
          </div>

          {/* Logout Other Devices */}
          <button
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
                  Permiso solicitado por Pessy para leer correos veterinarios y extraer historia clínica.
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
                      onClick={() => void handleDisconnectGmail()}
                      disabled={gmailActionLoading}
                      className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-60"
                    >
                      {gmailActionLoading ? "Procesando..." : "Desconectar Gmail"}
                    </button>
                  ) : (
                    <button
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

          {/* Delete Account */}
          <button
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
              datos y el historial de tus mascotas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
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
