/**
 * Native push notification service for Capacitor.
 *
 * Uses @capacitor/push-notifications to register the device with FCM/APNs,
 * request permission, and handle foreground notifications.
 *
 * Falls back gracefully when running in a web browser (non-native context).
 */
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

type PushStatus = "available" | "denied" | "unavailable";

interface PushMessage {
  title?: string;
  body?: string;
  data?: Record<string, string>;
}

interface CapacitorPushNotifications {
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  addListener(event: string, callback: (data: any) => void): Promise<{ remove: () => void }>;
  removeAllListeners(): Promise<void>;
}

/**
 * Lazily imports the Capacitor PushNotifications plugin.
 * Returns null when running in a web browser.
 */
async function loadPlugin(): Promise<CapacitorPushNotifications | null> {
  try {
    if (typeof (window as any)?.Capacitor === "undefined") return null;
    // Dynamic module path prevents Rollup from statically resolving
    // the import at build time — the plugin only exists in native builds.
    const modulePath = "@capacitor/push-notifications";
    const mod = await (Function("m", "return import(m)")(modulePath));
    return mod.PushNotifications as unknown as CapacitorPushNotifications;
  } catch {
    return null;
  }
}

class NativePushServiceImpl {
  private plugin: CapacitorPushNotifications | null = null;
  private token: string | null = null;
  private listeners: Array<{ remove: () => void }> = [];

  get isNative(): boolean {
    return typeof (window as any)?.Capacitor !== "undefined";
  }

  pushStatus: PushStatus = "unavailable";

  /**
   * Initialize the native push plugin. Call once on app start.
   * Safe to call in web — does nothing if Capacitor is not present.
   */
  async init(): Promise<void> {
    this.plugin = await loadPlugin();
    if (!this.plugin) {
      this.pushStatus = "unavailable";
      return;
    }

    try {
      const { receive } = await this.plugin.checkPermissions();
      this.pushStatus = receive === "granted" ? "available" : receive === "denied" ? "denied" : "unavailable";
    } catch {
      this.pushStatus = "unavailable";
    }
  }

  /**
   * Request push notification permission and register with FCM/APNs.
   * Returns the FCM token on success, null if denied or unavailable.
   */
  async requestPermissionAndRegister(userId?: string): Promise<string | null> {
    if (!this.plugin) return null;

    try {
      const { receive } = await this.plugin.requestPermissions();
      if (receive !== "granted") {
        this.pushStatus = "denied";
        return null;
      }

      this.pushStatus = "available";

      // Listen for the registration token
      const tokenListener = await this.plugin.addListener("registration", (data: { value: string }) => {
        this.token = data.value;

        // Persist token to Firestore for server-side messaging
        if (userId && this.token) {
          setDoc(
            doc(db, "push_tokens", userId),
            {
              token: this.token,
              platform: (window as any).Capacitor?.getPlatform?.() || "unknown",
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ).catch(() => { /* non-critical — silently ignore */ });
        }
      });
      this.listeners.push(tokenListener);

      // Listen for registration errors
      const errorListener = await this.plugin.addListener("registrationError", (err: any) => {
        console.warn("[Pessy] Push registration error:", err);
        this.pushStatus = "unavailable";
      });
      this.listeners.push(errorListener);

      // Trigger the actual registration with the OS
      await this.plugin.register();

      return this.token;
    } catch (err) {
      console.warn("[Pessy] Push permission request failed:", err);
      this.pushStatus = "unavailable";
      return null;
    }
  }

  /**
   * Listen for push notifications received while the app is in the foreground.
   * Returns an unsubscribe function.
   */
  onForegroundMessage(callback: (msg: PushMessage) => void): () => void {
    if (!this.plugin) return () => {};

    let listenerHandle: { remove: () => void } | null = null;

    this.plugin
      .addListener("pushNotificationReceived", (notification: any) => {
        callback({
          title: notification.title,
          body: notification.body,
          data: notification.data,
        });
      })
      .then((handle) => {
        listenerHandle = handle;
        this.listeners.push(handle);
      })
      .catch(() => { /* ignore */ });

    return () => {
      listenerHandle?.remove();
    };
  }

  /**
   * Listen for when a user taps on a push notification (opens the app).
   * Returns an unsubscribe function.
   */
  onNotificationTapped(callback: (data: Record<string, string>) => void): () => void {
    if (!this.plugin) return () => {};

    let listenerHandle: { remove: () => void } | null = null;

    this.plugin
      .addListener("pushNotificationActionPerformed", (action: any) => {
        callback(action?.notification?.data || {});
      })
      .then((handle) => {
        listenerHandle = handle;
        this.listeners.push(handle);
      })
      .catch(() => { /* ignore */ });

    return () => {
      listenerHandle?.remove();
    };
  }

  /** Clean up all listeners. Call on logout or app teardown. */
  async destroy(): Promise<void> {
    for (const l of this.listeners) {
      try { l.remove(); } catch { /* ignore */ }
    }
    this.listeners = [];
    this.token = null;
    this.pushStatus = "unavailable";
  }
}

export const NativePushService = new NativePushServiceImpl();
