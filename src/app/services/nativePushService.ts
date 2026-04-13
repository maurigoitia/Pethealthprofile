// Native push notification service stub for Capacitor
// Real implementation needs @capacitor/push-notifications plugin

type PushStatus = "available" | "denied" | "unavailable";

interface PushMessage {
  title?: string;
  body?: string;
  data?: Record<string, string>;
}

class NativePushServiceImpl {
  get isNative(): boolean {
    return typeof (window as any)?.Capacitor !== "undefined";
  }

  pushStatus: PushStatus = "unavailable";

  async init(): Promise<void> {
    // Will initialize Capacitor Push plugin when available
  }

  async requestPermissionAndRegister(): Promise<string | null> {
    // Returns FCM token when implemented
    return null;
  }

  onForegroundMessage(callback: (msg: PushMessage) => void): () => void {
    // Returns unsubscribe function
    void callback;
    return () => {};
  }
}

export const NativePushService = new NativePushServiceImpl();
