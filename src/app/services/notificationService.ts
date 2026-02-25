import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { doc, setDoc, collection, addDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

// VAPID key — generala en Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
// Por ahora usa placeholder, hay que reemplazar con la key real
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

export interface ScheduledNotification {
  id?: string;
  userId: string;
  petId: string;
  petName: string;
  type: "medication" | "appointment" | "vaccine_reminder";
  title: string;
  body: string;
  scheduledFor: string; // ISO 8601
  sourceEventId?: string;
  sourceMedicationId?: string;
  repeat?: "daily" | "weekly" | "monthly" | "none";
  repeatInterval?: number; // horas entre dosis
  active: boolean;
  sent: boolean;
  createdAt: string;
}

class NotificationServiceClass {
  private messaging: any = null;
  private initialized = false;

  async init(): Promise<boolean> {
    if (this.initialized) return true;
    if (!("Notification" in window)) {
      console.warn("Este browser no soporta notificaciones");
      return false;
    }

    try {
      const supported = await isSupported();
      if (!supported) {
        console.warn("FCM no está soportado en este navegador");
        return false;
      }

      const { getApp } = await import("firebase/app");
      this.messaging = getMessaging(getApp());
      this.initialized = true;
      return true;
    } catch (err) {
      console.error("Error inicializando FCM:", err);
      return false;
    }
  }

  async requestPermissionAndGetToken(): Promise<string | null> {
    const ready = await this.init();
    if (!ready) return null;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("Permiso de notificaciones denegado");
        return null;
      }

      if (!VAPID_KEY) {
        console.warn("VAPID_KEY no configurada — notificaciones en background deshabilitadas");
        return null;
      }

      // Evita conflicto con el SW de PWA registrando FCM en un scope dedicado.
      const swRegistration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/firebase-cloud-messaging-push-scope" }
      );

      const token = await getToken(this.messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      });
      if (token) {
        await this.saveTokenToFirestore(token);
        return token;
      }
      return null;
    } catch (err) {
      console.error("Error obteniendo FCM token:", err);
      return null;
    }
  }

  private async saveTokenToFirestore(token: string) {
    const user = auth.currentUser;
    if (!user) return;

    await setDoc(doc(db, "users", user.uid, "fcm_tokens", "primary"), {
      token,
      platform: this.detectPlatform(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }

  private detectPlatform(): string {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return "ios";
    if (/Android/.test(ua)) return "android";
    return "web";
  }

  // Escucha notificaciones cuando la app ESTÁ abierta (foreground)
  onForegroundMessage(callback: (payload: any) => void) {
    if (!this.messaging) return () => {};
    return onMessage(this.messaging, callback);
  }

  // ─── Crea notificaciones programadas en Firestore ─────────────────────────

  async scheduleMedicationReminders(params: {
    petId: string;
    petName: string;
    medicationName: string;
    dosage: string;
    frequency: string; // "Cada 12 horas", "Cada 24 horas", "Mensual", etc
    startDate: string;
    endDate: string | null;
    sourceEventId: string;
    sourceMedicationId?: string;
  }) {
    const user = auth.currentUser;
    if (!user) return;

    const intervalHours = this.parseFrequencyToHours(params.frequency);
    if (!intervalHours) return;

    const start = new Date(params.startDate);
    const end = params.endDate ? new Date(params.endDate) : null;
    const now = new Date();

    // Genera las próximas 7 notificaciones desde ahora
    const notifications: ScheduledNotification[] = [];
    let current = new Date(start);

    // Avanzar hasta ahora si la fecha de inicio ya pasó
    while (current < now) {
      current = new Date(current.getTime() + intervalHours * 3600000);
    }

    for (let i = 0; i < 7; i++) {
      if (end && current > end) break;

      notifications.push({
        userId: user.uid,
        petId: params.petId,
        petName: params.petName,
        type: "medication",
        title: `💊 Medicación de ${params.petName}`,
        body: `${params.medicationName} · ${params.dosage}`,
        scheduledFor: current.toISOString(),
        sourceEventId: params.sourceEventId,
        sourceMedicationId: params.sourceMedicationId,
        repeat: intervalHours <= 24 ? "daily" : "weekly",
        repeatInterval: intervalHours,
        active: true,
        sent: false,
        createdAt: new Date().toISOString(),
      });

      current = new Date(current.getTime() + intervalHours * 3600000);
    }

    // Guarda en Firestore — Firebase Function las procesa
    const batch = notifications.map(n =>
      addDoc(collection(db, "scheduled_notifications"), n)
    );
    await Promise.all(batch);

    console.log(`✅ ${notifications.length} recordatorios programados para ${params.medicationName}`);
  }

  async scheduleAppointmentReminder(params: {
    petId: string;
    petName: string;
    title: string;
    date: string; // ISO
    clinic?: string;
    veterinarian?: string;
    appointmentId: string;
  }) {
    const user = auth.currentUser;
    if (!user) return;

    const appointmentDate = new Date(params.date);
    const oneDayBefore = new Date(appointmentDate.getTime() - 24 * 3600000);
    const twoHoursBefore = new Date(appointmentDate.getTime() - 2 * 3600000);
    const now = new Date();

    const reminders: ScheduledNotification[] = [];

    if (oneDayBefore > now) {
      reminders.push({
        userId: user.uid,
        petId: params.petId,
        petName: params.petName,
        type: "appointment",
        title: `📅 Turno mañana — ${params.petName}`,
        body: `${params.title}${params.clinic ? ` · ${params.clinic}` : ""}`,
        scheduledFor: oneDayBefore.toISOString(),
        sourceEventId: params.appointmentId,
        repeat: "none",
        active: true,
        sent: false,
        createdAt: new Date().toISOString(),
      });
    }

    if (twoHoursBefore > now) {
      reminders.push({
        userId: user.uid,
        petId: params.petId,
        petName: params.petName,
        type: "appointment",
        title: `⏰ Turno en 2 horas — ${params.petName}`,
        body: `${params.title}${params.veterinarian ? ` · ${params.veterinarian}` : ""}`,
        scheduledFor: twoHoursBefore.toISOString(),
        sourceEventId: params.appointmentId,
        repeat: "none",
        active: true,
        sent: false,
        createdAt: new Date().toISOString(),
      });
    }

    await Promise.all(reminders.map(n =>
      addDoc(collection(db, "scheduled_notifications"), n)
    ));

    console.log(`✅ ${reminders.length} recordatorios de turno programados`);
  }

  // Parsea "Cada 12 horas" → 12, "Mensual" → 720, etc
  private parseFrequencyToHours(frequency: string): number | null {
    const f = frequency.toLowerCase();
    if (f.includes("12")) return 12;
    if (f.includes("8")) return 8;
    if (f.includes("6")) return 6;
    if (f.includes("24") || f.includes("día") || f.includes("diario")) return 24;
    if (f.includes("48") || f.includes("2 días")) return 48;
    if (f.includes("semanal") || f.includes("7 días")) return 168;
    if (f.includes("mensual") || f.includes("30 días")) return 720;
    return null;
  }
}

export const NotificationService = new NotificationServiceClass();
