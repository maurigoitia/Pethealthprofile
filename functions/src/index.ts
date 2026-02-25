import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// ─────────────────────────────────────────────────────────────────────────────
// CRON: Revisa cada 15 minutos si hay notificaciones pendientes para enviar
// ─────────────────────────────────────────────────────────────────────────────
export const sendScheduledNotifications = functions.pubsub
  .schedule("every 15 minutes")
  .onRun(async () => {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 15 * 60 * 1000); // próximos 15 min

    console.log(`[CRON] Revisando notificaciones hasta ${windowEnd.toISOString()}`);

    const snapshot = await db
      .collection("scheduled_notifications")
      .where("active", "==", true)
      .where("sent", "==", false)
      .where("scheduledFor", "<=", windowEnd.toISOString())
      .get();

    if (snapshot.empty) {
      console.log("[CRON] Sin notificaciones pendientes");
      return null;
    }

    console.log(`[CRON] ${snapshot.size} notificaciones a enviar`);

    const results = await Promise.allSettled(
      snapshot.docs.map(async (docSnap) => {
        const notification = docSnap.data();

        // Obtener FCM token del usuario
        const tokenDoc = await db
          .collection("users")
          .doc(notification.userId)
          .collection("fcm_tokens")
          .doc("primary")
          .get();

        if (!tokenDoc.exists) {
          console.warn(`[CRON] Sin token para usuario ${notification.userId}`);
          // Marcar como sent igual para no reintentar indefinidamente
          await docSnap.ref.update({ sent: true, sentAt: now.toISOString(), error: "no_token" });
          return;
        }

        const { token } = tokenDoc.data()!;

        // Construir mensaje FCM
        const message = {
          token,
          notification: {
            title: notification.title,
            body: notification.body,
          },
          data: {
            notificationId: docSnap.id,
            type: notification.type,
            petId: notification.petId,
            petName: notification.petName,
            sourceEventId: notification.sourceEventId || "",
          },
          android: {
            priority: "high" as const,
            notification: {
              channelId: "pessy_reminders",
              priority: "high" as const,
              defaultVibrateTimings: true,
              icon: "ic_notification",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
                contentAvailable: true,
              },
            },
          },
          webpush: {
            headers: { Urgency: "high" },
            notification: {
              icon: "/pwa-192x192.png",
              badge: "/pwa-192x192.png",
              requireInteraction: true,
              actions: [
                { action: "view", title: "Ver detalles" },
                { action: "dismiss", title: "Descartar" },
              ],
            },
          },
        };

        // Enviar
        await messaging.send(message);

        // Marcar como enviada
        await docSnap.ref.update({
          sent: true,
          sentAt: now.toISOString(),
        });

        // Si es repetible, programar la siguiente
        if (notification.repeat !== "none" && notification.repeatInterval) {
          const nextDate = new Date(
            new Date(notification.scheduledFor).getTime() +
            notification.repeatInterval * 3600000
          );

          // Solo programar si no hay endDate o si la siguiente está antes del endDate
          const shouldScheduleNext = true; // En app real: verificar contra endDate de la medicación

          if (shouldScheduleNext) {
            await db.collection("scheduled_notifications").add({
              ...notification,
              scheduledFor: nextDate.toISOString(),
              sent: false,
              createdAt: now.toISOString(),
            });
          }
        }

        console.log(`[CRON] ✅ Enviada: ${notification.title} → ${notification.petName}`);
      })
    );

    const failed = results.filter(r => r.status === "rejected");
    if (failed.length > 0) {
      console.error(`[CRON] ${failed.length} notificaciones fallaron`);
    }

    return null;
  });

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER: Cuando se agrega una cita en Firestore → programa recordatorios
// ─────────────────────────────────────────────────────────────────────────────
export const onAppointmentCreated = functions.firestore
  .document("appointments/{appointmentId}")
  .onCreate(async (snap, context) => {
    const appointment = snap.data();
    if (!appointment || !appointment.date) return;

    const rawDateTime = appointment.time
      ? `${appointment.date}T${appointment.time}:00`
      : `${appointment.date}T09:00:00`;
    const appointmentDate = new Date(rawDateTime);
    if (Number.isNaN(appointmentDate.getTime())) {
      console.warn(`[TRIGGER] Fecha/hora inválida para cita ${context.params.appointmentId}`);
      return;
    }
    const now = new Date();

    const reminders = [];

    // 24 horas antes
    const oneDayBefore = new Date(appointmentDate.getTime() - 24 * 3600000);
    if (oneDayBefore > now) {
      reminders.push({
        userId: appointment.userId || appointment.ownerId,
        petId: appointment.petId,
        petName: appointment.petName || "Tu mascota",
        type: "appointment",
        title: `📅 Turno mañana — ${appointment.petName || "Tu mascota"}`,
        body: `${appointment.title}${appointment.clinic ? ` · ${appointment.clinic}` : ""}`,
        scheduledFor: oneDayBefore.toISOString(),
        sourceEventId: context.params.appointmentId,
        repeat: "none",
        repeatInterval: null,
        active: true,
        sent: false,
        createdAt: now.toISOString(),
      });
    }

    // 2 horas antes
    const twoHoursBefore = new Date(appointmentDate.getTime() - 2 * 3600000);
    if (twoHoursBefore > now) {
      reminders.push({
        userId: appointment.userId || appointment.ownerId,
        petId: appointment.petId,
        petName: appointment.petName || "Tu mascota",
        type: "appointment",
        title: `⏰ Turno en 2 horas — ${appointment.petName || "Tu mascota"}`,
        body: `${appointment.title}${appointment.veterinarian ? ` · Dr. ${appointment.veterinarian}` : ""}`,
        scheduledFor: twoHoursBefore.toISOString(),
        sourceEventId: context.params.appointmentId,
        repeat: "none",
        repeatInterval: null,
        active: true,
        sent: false,
        createdAt: now.toISOString(),
      });
    }

    if (reminders.length > 0) {
      await Promise.all(reminders.map(r => db.collection("scheduled_notifications").add(r)));
      console.log(`[TRIGGER] ${reminders.length} recordatorios creados para cita ${context.params.appointmentId}`);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP: Borra notificaciones enviadas con más de 7 días
// ─────────────────────────────────────────────────────────────────────────────
export const cleanupOldNotifications = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    const cutoff = new Date(Date.now() - 7 * 24 * 3600000).toISOString();

    const old = await db
      .collection("scheduled_notifications")
      .where("sent", "==", true)
      .where("sentAt", "<=", cutoff)
      .get();

    if (old.empty) return null;

    const batch = db.batch();
    old.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.log(`[CLEANUP] Borradas ${old.size} notificaciones viejas`);
    return null;
  });
