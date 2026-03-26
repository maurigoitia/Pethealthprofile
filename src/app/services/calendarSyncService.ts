import { httpsCallable } from "firebase/functions";
import { functions as firebaseFunctions } from "../../lib/firebase";
import { Appointment } from "../types/medical";

interface CalendarSyncResult {
  ok: boolean;
  action?: "created" | "updated" | "deleted" | "skipped" | "error";
  reason?: string;
  eventId?: string | null;
  htmlLink?: string | null;
  syncedAt?: string;
}

type SyncCallablePayload = {
  appointmentId: string;
  petName?: string | null;
  title: string;
  date: string;
  time: string;
  clinic?: string | null;
  veterinarian?: string | null;
  notes?: string | null;
  status: "upcoming" | "completed" | "cancelled";
  googleCalendarEventId?: string | null;
  timeZone: string;
};

export async function syncAppointmentWithGoogleCalendar(
  appointment: Appointment
): Promise<CalendarSyncResult> {
  const callable = httpsCallable<SyncCallablePayload, CalendarSyncResult>(
    firebaseFunctions,
    "syncAppointmentCalendarEvent"
  );

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const result = await callable({
    appointmentId: appointment.id,
    petName: appointment.petName || null,
    title: appointment.title,
    date: appointment.date,
    time: appointment.time,
    clinic: appointment.clinic || null,
    veterinarian: appointment.veterinarian || null,
    notes: appointment.notes || null,
    status: appointment.status,
    googleCalendarEventId: appointment.googleCalendarEventId || null,
    timeZone,
  });

  return result.data;
}
