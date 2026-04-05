import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getUserTokenAndTimezone } from "../utils/users";
import { parseLocalToUtc, toDateKeyInTimezone } from "../utils/time";

const db = () => admin.firestore();

async function clearPendingAppointmentNotifications(appointmentId: string): Promise<void> {
  const pendingSnap = await db()
    .collection("scheduled_notifications")
    .where("sourceEventId", "==", appointmentId)
    .where("type", "==", "appointment")
    .where("sent", "==", false)
    .get();
  if (pendingSnap.empty) return;

  const batch = db().batch();
  pendingSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
}

async function scheduleAppointmentReminders(appointmentId: string, appointment: Record<string, any>): Promise<void> {
  await clearPendingAppointmentNotifications(appointmentId);
  if (!appointment.date) return;
  const appointmentStatus = typeof appointment.status === "string" ? appointment.status.toLowerCase() : "upcoming";
  if (!["upcoming", "scheduled", "confirmed"].includes(appointmentStatus)) return;

  const now = new Date();
  const nowIso = now.toISOString();
  const userId = appointment.userId || appointment.ownerId;
  if (!userId) return;

  const { timezone } = await getUserTokenAndTimezone(userId);
  const appointmentDate = parseLocalToUtc(
    appointment.date,
    appointment.time || "09:00",
    timezone
  );
  if (Number.isNaN(appointmentDate.getTime())) {
    console.warn(`[TRIGGER] Fecha/hora inválida para cita ${appointmentId}`);
    return;
  }

  const reminders: Array<{ id: string; payload: Record<string, any> }> = [];

  const oneDayBefore = new Date(appointmentDate.getTime() - 24 * 3600000);
  if (oneDayBefore > now) {
    reminders.push({
      id: `appt_${appointmentId}_24h`,
      payload: {
        userId,
        petId: appointment.petId || "",
        petName: appointment.petName || "Tu mascota",
        type: "appointment",
        title: `📅 Turno mañana — ${appointment.petName || "Tu mascota"}`,
        body: `${appointment.title || "Consulta"}${appointment.clinic ? ` · ${appointment.clinic}` : ""}`,
        scheduledFor: oneDayBefore.toISOString(),
        sourceEventId: appointmentId,
        repeat: "none",
        repeatInterval: null,
        repeatRootId: `appt_${appointmentId}`,
        endAt: null,
        active: true,
        sent: false,
        createdAt: nowIso,
      },
    });
  }

  const twoHoursBefore = new Date(appointmentDate.getTime() - 2 * 3600000);
  if (twoHoursBefore > now) {
    reminders.push({
      id: `appt_${appointmentId}_2h`,
      payload: {
        userId,
        petId: appointment.petId || "",
        petName: appointment.petName || "Tu mascota",
        type: "appointment",
        title: `⏰ Turno en 2 horas — ${appointment.petName || "Tu mascota"}`,
        body: `${appointment.title || "Consulta"}${appointment.veterinarian ? ` · Dr. ${appointment.veterinarian}` : ""}`,
        scheduledFor: twoHoursBefore.toISOString(),
        sourceEventId: appointmentId,
        repeat: "none",
        repeatInterval: null,
        repeatRootId: `appt_${appointmentId}`,
        endAt: null,
        active: true,
        sent: false,
        createdAt: nowIso,
      },
    });
  }

  const appointmentDayKey = toDateKeyInTimezone(appointmentDate, timezone);
  const localHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).format(appointmentDate)
  );
  const targetHour = Math.max(7, localHour - 3);
  const sameDayReminderTime = `${targetHour.toString().padStart(2, "0")}:00`;
  const sameDayReminder = parseLocalToUtc(appointmentDayKey, sameDayReminderTime, timezone);

  if (sameDayReminder > now && sameDayReminder < appointmentDate) {
    reminders.push({
      id: `appt_${appointmentId}_today`,
      payload: {
        userId,
        petId: appointment.petId || "",
        petName: appointment.petName || "Tu mascota",
        type: "appointment",
        title: `📌 Hoy toca turno — ${appointment.petName || "Tu mascota"}`,
        body: `${appointment.title || "Consulta"}${appointment.time ? ` a las ${appointment.time}` : ""}`,
        scheduledFor: sameDayReminder.toISOString(),
        sourceEventId: appointmentId,
        repeat: "none",
        repeatInterval: null,
        repeatRootId: `appt_${appointmentId}`,
        endAt: null,
        active: true,
        sent: false,
        createdAt: nowIso,
      },
    });
  }

  if (reminders.length > 0) {
    await Promise.all(
      reminders.map((r) =>
        db().collection("scheduled_notifications").doc(r.id).set(r.payload)
      )
    );
    console.log(`[TRIGGER] ${reminders.length} recordatorios creados para cita ${appointmentId}`);
  }
}

export const onAppointmentCreated = functions.firestore
  .document("appointments/{appointmentId}")
  .onCreate(async (snap, context) => {
    const appointment = snap.data() as Record<string, any> | undefined;
    if (!appointment) return;
    await scheduleAppointmentReminders(context.params.appointmentId, appointment);
  });

export const onAppointmentUpdated = functions.firestore
  .document("appointments/{appointmentId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() as Record<string, any> | undefined;
    const after = change.after.data() as Record<string, any> | undefined;
    if (!after) return null;

    const significantChange =
      (before?.date || "") !== (after.date || "") ||
      (before?.time || "") !== (after.time || "") ||
      (before?.status || "") !== (after.status || "") ||
      (before?.clinic || "") !== (after.clinic || "") ||
      (before?.veterinarian || "") !== (after.veterinarian || "") ||
      (before?.title || "") !== (after.title || "");

    if (!significantChange) return null;
    await scheduleAppointmentReminders(context.params.appointmentId, after);
    return null;
  });

export const onAppointmentDeleted = functions.firestore
  .document("appointments/{appointmentId}")
  .onDelete(async (_snap, context) => {
    await clearPendingAppointmentNotifications(context.params.appointmentId);
    return null;
  });
