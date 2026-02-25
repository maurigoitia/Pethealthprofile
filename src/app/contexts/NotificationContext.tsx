import { useEffect, useState, useCallback } from "react";
import { NotificationService } from "../services/notificationService";
import { useAuth } from "./AuthContext";

interface InAppNotification {
  id: string;
  title: string;
  body: string;
  type: "medication" | "appointment" | "vaccine_reminder";
  timestamp: Date;
  read: boolean;
}

interface NotificationContextState {
  permission: NotificationPermission | "unknown";
  hasToken: boolean;
  inAppNotifications: InAppNotification[];
  unreadCount: number;
  requestPermission: () => Promise<void>;
  markAllRead: () => void;
  dismiss: (id: string) => void;
}

import { createContext, useContext, ReactNode } from "react";

const NotificationContext = createContext<NotificationContextState | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | "unknown">("unknown");
  const [hasToken, setHasToken] = useState(false);
  const [inAppNotifications, setInAppNotifications] = useState<InAppNotification[]>([]);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const setup = async () => {
      const initialized = await NotificationService.init();
      if (!initialized || cancelled) return;

      if ("Notification" in window && Notification.permission === "granted") {
        const token = await NotificationService.requestPermissionAndGetToken();
        if (token) setHasToken(true);
      }

      // Escucha notificaciones foreground (app abierta)
      unsubscribe = NotificationService.onForegroundMessage((payload) => {
        const { title, body } = payload.notification || {};
        const data = payload.data || {};

        const newNotif: InAppNotification = {
          id: Date.now().toString(),
          title: title || "PESSY",
          body: body || "",
          type: (data.type as any) || "medication",
          timestamp: new Date(),
          read: false,
        };

        setInAppNotifications(prev => [newNotif, ...prev].slice(0, 20));

        // Banner visual en foreground
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(newNotif.title, {
            body: newNotif.body,
            icon: "/pwa-192x192.png",
            badge: "/pwa-192x192.png",
          });
        }
      });
    };
    void setup();

    return () => {
      cancelled = true;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [user]);

  const requestPermission = useCallback(async () => {
    const token = await NotificationService.requestPermissionAndGetToken();
    if (token) {
      setHasToken(true);
      setPermission("granted");
    } else {
      setPermission(Notification.permission as NotificationPermission);
    }
  }, []);

  const markAllRead = useCallback(() => {
    setInAppNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setInAppNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const unreadCount = inAppNotifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      permission,
      hasToken,
      inAppNotifications,
      unreadCount,
      requestPermission,
      markAllRead,
      dismiss,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
}
