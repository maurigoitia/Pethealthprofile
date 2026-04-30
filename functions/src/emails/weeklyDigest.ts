/**
 * Resumen semanal de salud — envío automático cada lunes.
 *
 * Recopila actividad de la última semana (logs de salud, recordatorios
 * completados/vencidos, eventos clínicos) y envía un resumen por email.
 *
 * Trigger: Cloud Scheduler → PubSub → esta función.
 * Depende de: pessyEmailWrap (definido en index.ts, exportar cuando sea necesario).
 */
import * as admin from "firebase-admin";
import { Resend } from "resend";

const db = admin.firestore();

export interface WeeklyDigestData {
  petName: string;
  healthEventsCount: number;
  remindersCompleted: number;
  remindersPending: number;
  upcomingReminders: string[];
}

/**
 * Recopilar datos de la última semana para una mascota.
 */
export async function gatherWeeklyData(petId: string): Promise<WeeklyDigestData | null> {
  const petSnap = await db.collection("pets").doc(petId).get();
  if (!petSnap.exists) return null;
  const petData = petSnap.data()!;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekAgoIso = oneWeekAgo.toISOString();

  // Contar eventos clínicos de la semana
  const eventsSnap = await db
    .collection("clinical_events")
    .where("petId", "==", petId)
    .where("created_at", ">=", oneWeekAgoIso)
    .get();

  // TODO: Contar recordatorios completados vs pendientes
  // cuando el schema de reminders esté estandarizado

  return {
    petName: petData.name || "tu mascota",
    healthEventsCount: eventsSnap.size,
    remindersCompleted: 0, // placeholder
    remindersPending: 0,   // placeholder
    upcomingReminders: [],  // placeholder
  };
}

/**
 * Enviar resumen semanal para todas las mascotas de un usuario.
 */
export async function sendWeeklyDigest(
  resendClient: Resend,
  userId: string,
  userEmail: string,
): Promise<void> {
  const petsSnap = await db
    .collection("pets")
    .where("ownerId", "==", userId)
    .get();

  if (petsSnap.empty) return;

  for (const petDoc of petsSnap.docs) {
    const data = await gatherWeeklyData(petDoc.id);
    if (!data) continue;

    const subject = `Resumen semanal de ${data.petName}`;
    const hasActivity = data.healthEventsCount > 0;

    // HTML inline simplificado — usa el wrapper de index.ts en producción
    const body = `
      <div style="font-family:'Manrope',sans-serif;padding:24px;">
        <h2 style="color:#074738;">Resumen de la semana de ${data.petName}</h2>
        <p style="color:#333;line-height:1.6;">
          ${hasActivity
            ? `Esta semana se registraron <strong>${data.healthEventsCount}</strong> evento(s) de salud.`
            : "No hubo actividad de salud esta semana. Todo tranquilo."}
        </p>
        <p style="margin-top:20px;">
          <a href="https://pessy.app/inicio" style="background:#1A9B7D;color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:700;">
            Ver detalle en Pessy
          </a>
        </p>
      </div>`;

    try {
      await resendClient.emails.send({
        from: "PESSY <noreply@pessy.app>",
        to: userEmail,
        subject,
        html: body,
      });
      console.log(`[EMAIL] Weekly digest sent for ${data.petName} to ${userEmail}`);
    } catch (err) {
      console.error(`[EMAIL] Weekly digest error for ${data.petName}:`, err);
    }
  }
}
