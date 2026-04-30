/**
 * Email de alerta cuando un recordatorio se vence sin completar.
 *
 * Trigger: Cloud Scheduler diario que revisa reminders vencidos,
 * o listener en Firestore cuando un reminder pasa a status "overdue".
 */
import { Resend } from "resend";

export interface OverdueReminderArgs {
  toEmail: string;
  petName: string;
  reminderType: "vaccine" | "medication" | "checkup" | "grooming" | "deworming";
  reminderLabel: string;
  dueDate: string; // ISO date
}

const TYPE_LABELS: Record<string, string> = {
  vaccine: "Vacuna",
  medication: "Medicación",
  checkup: "Control veterinario",
  grooming: "Peluquería",
  deworming: "Desparasitación",
};

export async function sendOverdueReminder(
  resendClient: Resend,
  args: OverdueReminderArgs,
): Promise<void> {
  const typeLabel = TYPE_LABELS[args.reminderType] || args.reminderType;
  const dueFormatted = new Date(args.dueDate).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const subject = `Recordatorio pendiente: ${typeLabel} de ${args.petName}`;

  const html = `
    <div style="font-family:'Manrope',sans-serif;padding:24px;">
      <h2 style="color:#074738;">Recordatorio vencido</h2>
      <p style="color:#333;line-height:1.6;">
        El recordatorio de <strong>${typeLabel}</strong> para
        <strong>${args.petName}</strong> estaba programado para el
        <strong>${dueFormatted}</strong> y aún no fue completado.
      </p>
      <p style="color:#666;line-height:1.6;">
        ${args.reminderLabel}
      </p>
      <p style="margin-top:20px;">
        <a href="https://pessy.app/inicio"
           style="background:#1A9B7D;color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:700;">
          Revisar en Pessy
        </a>
      </p>
    </div>`;

  try {
    await resendClient.emails.send({
      from: "PESSY <alertas@pessy.app>",
      to: args.toEmail,
      subject,
      html,
    });
    console.log(`[EMAIL] Overdue reminder sent: ${typeLabel} for ${args.petName}`);
  } catch (err) {
    console.error("[EMAIL] Overdue reminder error:", err);
  }
}
