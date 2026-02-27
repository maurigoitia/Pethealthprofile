import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { doc, setDoc, collection, addDoc, getDocs, query, where, deleteDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { parseDateSafe } from "../utils/dateUtils";

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
  repeatRootId?: string;
  endAt?: string | null;
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
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    await setDoc(doc(db, "users", user.uid, "fcm_tokens", "primary"), {
      token,
      platform: this.detectPlatform(),
      timezone,
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
    if (!this.messaging) return () => { };
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
    lastDoseAt?: string | null; // si está, la próxima alarma se calcula desde esta toma real
  }) {
    const user = auth.currentUser;
    if (!user) return;

    const intervalHours = this.parseFrequencyToHours(params.frequency);
    if (!intervalHours) return;

    const hasExplicitStartTime = typeof params.startDate === "string" && /T\d{2}:\d{2}/.test(params.startDate);
    const hasExplicitEndTime = typeof params.endDate === "string" && /T\d{2}:\d{2}/.test(params.endDate);

    const start = parseDateSafe(params.startDate);
    const lastDose = params.lastDoseAt ? parseDateSafe(params.lastDoseAt) : null;
    const end = params.endDate ? parseDateSafe(params.endDate) : null;
    if (!start) return;
    const now = new Date();

    // Si la fecha vino sin hora explícita, fijamos 09:00 local para evitar
    // recordatorios ambiguos en "mediodía por defecto".
    let current = new Date(lastDose || start);
    if (!lastDose && !hasExplicitStartTime) {
      current.setHours(9, 0, 0, 0);
    }

    if (lastDose) {
      current = new Date(current.getTime() + intervalHours * 3600000);
    }

    // Avanzar hasta ahora si quedó atrasado.
    while (current <= now) {
      current = new Date(current.getTime() + intervalHours * 3600000);
    }

    if (end) {
      const effectiveEnd = new Date(end);
      if (!hasExplicitEndTime) {
        effectiveEnd.setHours(23, 59, 59, 999);
      }
      if (current > effectiveEnd) {
        return;
      }
    }

    // Limpia pendientes previos del mismo tratamiento para evitar duplicados.
    const cleanupQueries = [];
    if (params.sourceMedicationId) {
      cleanupQueries.push(query(
        collection(db, "scheduled_notifications"),
        where("userId", "==", user.uid),
        where("sourceMedicationId", "==", params.sourceMedicationId),
        where("sent", "==", false)
      ));
    }
    if (params.sourceEventId) {
      cleanupQueries.push(query(
        collection(db, "scheduled_notifications"),
        where("userId", "==", user.uid),
        where("sourceEventId", "==", params.sourceEventId),
        where("type", "==", "medication"),
        where("sent", "==", false)
      ));
    }

    const snapResults = await Promise.all(cleanupQueries.map(q => getDocs(q)));
    const seenIds = new Set<string>();
    const deletePromises: Promise<void>[] = [];

    for (const snap of snapResults) {
      for (const docSnap of snap.docs) {
        if (!seenIds.has(docSnap.id)) {
          seenIds.add(docSnap.id);
          deletePromises.push(deleteDoc(docSnap.ref));
        }
      }
    }
    await Promise.all(deletePromises);

    const repeatRootId = `med_${params.sourceMedicationId || params.sourceEventId}`;
    const notification: ScheduledNotification = {
      userId: user.uid,
      petId: params.petId,
      petName: params.petName,
      type: "medication",
      title: `💊 Hoy toca medicación — ${params.petName}`,
      body: `${params.medicationName} · ${params.dosage}`,
      scheduledFor: current.toISOString(),
      sourceEventId: params.sourceEventId,
      sourceMedicationId: params.sourceMedicationId,
      repeat: intervalHours <= 24 ? "daily" : "weekly",
      repeatInterval: intervalHours,
      repeatRootId,
      endAt: params.endDate || null,
      active: true,
      sent: false,
      createdAt: new Date().toISOString(),
    };

    await addDoc(collection(db, "scheduled_notifications"), notification);

    console.log(`✅ Recordatorio de medicación programado para ${params.medicationName}`);
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

    const appointmentDate = parseDateSafe(params.date);
    if (!appointmentDate) return;
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
    const f = (frequency || "")
      .toLowerCase()
      .replace(",", ".")
      .replace(/\s+/g, " ")
      .trim();

    // "cada 12 horas", "c/12h", "q8h", "12 hs"
    const eachHoursMatch =
      f.match(/(?:cada|c\/|q)\s*(\d+(?:\.\d+)?)\s*(?:h|hs|hora|horas)\b/) ||
      f.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hs|hora|horas)\b/);
    if (eachHoursMatch) {
      const parsed = Number(eachHoursMatch[1]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    // "2 veces al día" => cada 12h, "3 veces al día" => cada 8h
    const dailyMatch = f.match(/(\d+)\s*vez(?:es)?\s*al\s*d[ií]a/);
    if (dailyMatch) {
      const times = Number(dailyMatch[1]);
      if (Number.isFinite(times) && times > 0) {
        return Math.round(24 / times);
      }
    }

    if (/diario|diaria|cada\s+24\s*h/.test(f)) return 24;
    if (/cada\s+48\s*h|2\s*d[ií]as/.test(f)) return 48;
    if (/semanal|7\s*d[ií]as/.test(f)) return 168;
    if (/mensual|30\s*d[ií]as/.test(f)) return 720;
    return null;
  }
}

export const NotificationService = new NotificationServiceClass();
