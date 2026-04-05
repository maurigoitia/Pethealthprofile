"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveAccessRequest = exports.seedBrainKnowledge = exports.syncNotebookKnowledge = exports.submitDataDeletionRequest = exports.deleteAllUserClinicalData = exports.deleteUserAccount = exports.backfillClinicalEpisodes = exports.backfillClinicalProjection = exports.onClinicalEventProjection = exports.syncTreatmentTimezoneV3 = exports.evaluateTreatmentDedupV3 = exports.recordDoseEventV3 = exports.markMissedTreatmentDosesV3 = exports.dispatchTreatmentRemindersV3 = exports.onTreatmentWriteScheduleV3 = exports.onMedicationWriteScheduleV3 = exports.uploadPetPhoto = exports.provisionPessyVertexDatastore = exports.pessyClinicalBrainGrounding = exports.syncAppointmentCalendarEvent = exports.disconnectGmailSync = exports.gmailAuthCallback = exports.getGmailConnectUrl = exports.acceptCoTutorInvite = exports.sendCoTutorInvite = exports.resolveBrainPayload = exports.generateClinicalSummary = exports.analyzeDocument = exports.cleanupOldNotifications = exports.recomputeClinicalAlertsDaily = exports.reconcileExistingTreatments = exports.sendBroadcastPushCampaigns = exports.sendDailyCareSummary = exports.sendScheduledNotifications = exports.onUserCreatedSendWelcome = exports.pessySendCoTutorInvitation = exports.pessySendWelcomeEmail = exports.pessySendInvitationEmail = exports.nearbyVets = exports.computeAdoptionMatches = exports.onPetSighting = exports.onLostPetReport = exports.ingestHistory = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const resend_1 = require("resend");
const rateLimiter = require("./utils/rateLimiter");
__exportStar(require("./appointments"), exports);
var ingestHistory_1 = require("./clinical/ingestHistory");
Object.defineProperty(exports, "ingestHistory", { enumerable: true, get: function () { return ingestHistory_1.ingestHistory; } });
var community_1 = require("./community");
Object.defineProperty(exports, "onLostPetReport", { enumerable: true, get: function () { return community_1.onLostPetReport; } });
Object.defineProperty(exports, "onPetSighting", { enumerable: true, get: function () { return community_1.onPetSighting; } });
Object.defineProperty(exports, "computeAdoptionMatches", { enumerable: true, get: function () { return community_1.computeAdoptionMatches; } });
var places_1 = require("./places");
Object.defineProperty(exports, "nearbyVets", { enumerable: true, get: function () { return places_1.nearbyVets; } });
// Resend — email fallback para notificaciones de medicación
// API key se configura en: firebase functions:secrets:set RESEND_API_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const resendClient = RESEND_API_KEY ? new resend_1.Resend(RESEND_API_KEY) : null;
// ─── PESSY LOGO SVG (inline para máxima compatibilidad email) ───
const pessyLogoSvgWhite = `<svg width="32" height="36" viewBox="0 0 214.848 240.928" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.8826 0.101688L12.0892 0.0939362C19.3159 -0.118314 27.2282 0.0891794 34.4962 0.133929L70.1119 0.193927L108.921 0.183429C117.756 0.209429 127.246 0.0274282 135.998 0.538928C139.448 0.740678 147.088 2.34518 150.461 3.17818C164.121 6.47343 176.683 13.2814 186.901 22.9272C205.723 40.6399 213.993 61.1484 214.803 86.8074C215.503 109.009 208.096 132.621 192.371 148.569C186.658 153.824 179.556 162.934 171.653 164.326C167.318 164.204 163.026 153.514 162.396 150.046C162.286 148.271 165.603 145.811 166.798 144.891C184.343 131.381 194.678 112.523 195.101 90.1144C195.633 71.1989 188.423 52.8852 175.136 39.4112C169.043 33.1554 158.048 25.9717 149.678 23.2562C138.481 19.6232 128.223 19.8317 116.658 19.8712L97.1804 19.9189L39.5581 19.9119C36.3306 19.8867 32.4451 20.1522 29.3126 20.0337C19.4289 19.6604 19.9614 24.0957 19.9886 32.3012L19.9444 154.071L19.9459 188.229C19.9379 196.381 19.3009 206.164 20.7399 214.041C21.9614 220.729 30.8409 223.971 36.9424 221.449C46.2629 217.519 44.9236 206.946 44.8254 197.696C44.6046 176.944 60.7044 161.226 80.4254 157.371C85.5081 156.376 94.6234 156.574 99.6301 157.461C100.969 157.699 100.658 160.934 100.816 161.931C100.278 165.041 104.758 172.956 103.398 175.101C101.471 176.344 90.2986 175.824 87.1954 176.009C75.8424 176.689 66.2094 183.471 64.8956 195.361C64.1791 201.849 65.1986 208.461 64.1264 214.901C63.1911 220.524 60.6926 226.066 56.8961 230.329C51.3921 236.509 43.9576 240.349 35.6996 240.824C26.2839 241.364 18.0029 239.931 10.7711 233.414C3.56614 226.921 0.771647 218.699 0.330897 209.176C0.119647 204.614 0.274392 200.006 0.284892 195.439L0.262889 173.299L0.215144 98.6262L0.118403 38.9669C0.136403 33.4217 0.121148 27.8762 0.072398 22.3312C0.040898 18.7044 -0.0823572 14.6782 0.0888928 11.0789C0.221893 8.28294 0.476153 5.63918 2.3834 3.52918C5.66515 -0.101572 7.35389 0.236938 11.8826 0.101688Z" fill="white"/><path d="M131.773 134.566C138.826 134.309 140.791 140.514 144.906 144.904C146.801 146.926 149.096 148.784 150.978 150.839C154.043 154.184 155.326 157.091 155.018 161.631C154.883 164.701 153.236 168.364 150.826 170.261C144.251 175.431 140.008 172.509 133.576 172.089L133.181 172.064C125.998 172.209 121.768 175.736 115.543 170.686C104.318 161.579 111.396 151.521 119.671 144.241C124.311 140.161 124.341 135.374 131.773 134.566Z" fill="white"/></svg>`;
const pessyLogoSvgGreen = `<svg width="32" height="36" viewBox="0 0 214.848 240.928" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.8826 0.101688L12.0892 0.0939362C19.3159 -0.118314 27.2282 0.0891794 34.4962 0.133929L70.1119 0.193927L108.921 0.183429C117.756 0.209429 127.246 0.0274282 135.998 0.538928C139.448 0.740678 147.088 2.34518 150.461 3.17818C164.121 6.47343 176.683 13.2814 186.901 22.9272C205.723 40.6399 213.993 61.1484 214.803 86.8074C215.503 109.009 208.096 132.621 192.371 148.569C186.658 153.824 179.556 162.934 171.653 164.326C167.318 164.204 163.026 153.514 162.396 150.046C162.286 148.271 165.603 145.811 166.798 144.891C184.343 131.381 194.678 112.523 195.101 90.1144C195.633 71.1989 188.423 52.8852 175.136 39.4112C169.043 33.1554 158.048 25.9717 149.678 23.2562C138.481 19.6232 128.223 19.8317 116.658 19.8712L97.1804 19.9189L39.5581 19.9119C36.3306 19.8867 32.4451 20.1522 29.3126 20.0337C19.4289 19.6604 19.9614 24.0957 19.9886 32.3012L19.9444 154.071L19.9459 188.229C19.9379 196.381 19.3009 206.164 20.7399 214.041C21.9614 220.729 30.8409 223.971 36.9424 221.449C46.2629 217.519 44.9236 206.946 44.8254 197.696C44.6046 176.944 60.7044 161.226 80.4254 157.371C85.5081 156.376 94.6234 156.574 99.6301 157.461C100.969 157.699 100.658 160.934 100.816 161.931C100.278 165.041 104.758 172.956 103.398 175.101C101.471 176.344 90.2986 175.824 87.1954 176.009C75.8424 176.689 66.2094 183.471 64.8956 195.361C64.1791 201.849 65.1986 208.461 64.1264 214.901C63.1911 220.524 60.6926 226.066 56.8961 230.329C51.3921 236.509 43.9576 240.349 35.6996 240.824C26.2839 241.364 18.0029 239.931 10.7711 233.414C3.56614 226.921 0.771647 218.699 0.330897 209.176C0.119647 204.614 0.274392 200.006 0.284892 195.439L0.262889 173.299L0.215144 98.6262L0.118403 38.9669C0.136403 33.4217 0.121148 27.8762 0.072398 22.3312C0.040898 18.7044 -0.0823572 14.6782 0.0888928 11.0789C0.221893 8.28294 0.476153 5.63918 2.3834 3.52918C5.66515 -0.101572 7.35389 0.236938 11.8826 0.101688Z" fill="#074738"/><path d="M131.773 134.566C138.826 134.309 140.791 140.514 144.906 144.904C146.801 146.926 149.096 148.784 150.978 150.839C154.043 154.184 155.326 157.091 155.018 161.631C154.883 164.701 153.236 168.364 150.826 170.261C144.251 175.431 140.008 172.509 133.576 172.089L133.181 172.064C125.998 172.209 121.768 175.736 115.543 170.686C104.318 161.579 111.396 151.521 119.671 144.241C124.311 140.161 124.341 135.374 131.773 134.566Z" fill="#074738"/></svg>`;
// ─── EMAIL WRAPPER (reutilizable para todos los emails) ───
function pessyEmailWrap(opts) {
    const footerBg = opts.footerDark ? "#074738" : "#F0FAF9";
    const footerTextColor = opts.footerDark ? "rgba(255,255,255,0.6)" : "#666666";
    const footerNameColor = opts.footerDark ? "#ffffff" : "#074738";
    const footerTagColor = opts.footerDark ? "rgba(255,255,255,0.5)" : "rgba(7,71,56,0.5)";
    const footerLogo = opts.footerDark ? pessyLogoSvgWhite : pessyLogoSvgGreen;
    const footerLinkColor = "#1A9B7D";
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#e8e8e8;font-family:'Manrope',sans-serif;">
<div style="display:none!important;font-size:1px;color:#fff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${opts.preheader}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#e8e8e8;padding:0;">
<tr><td align="center">
<table width="100%" style="max-width:600px;background:#ffffff;" cellpadding="0" cellspacing="0">
<!-- HEADER -->
<tr><td style="background:#074738;padding:20px 28px;">
<table cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;padding-right:14px;">${pessyLogoSvgWhite}</td>
<td style="vertical-align:middle;">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:22px;color:#fff;letter-spacing:0.06em;line-height:1;">PESSY</div>
<div style="font-family:'Manrope',sans-serif;font-size:11px;color:rgba(255,255,255,0.5);font-weight:500;margin-top:3px;">${opts.headerSubtitle || "Tu mascota, todo en orden"}</div>
</td>
</tr></table>
</td></tr>
<!-- BODY -->
${opts.bodyHtml}
<!-- FOOTER -->
<tr><td style="background:${footerBg};padding:28px 32px;text-align:center;">
<table cellpadding="0" cellspacing="0" style="margin:0 auto 12px;"><tr>
<td style="vertical-align:middle;padding-right:10px;">${footerLogo}</td>
<td style="vertical-align:middle;">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:17px;color:${footerNameColor};letter-spacing:0.05em;line-height:1.1;">PESSY</div>
<div style="font-size:10px;font-weight:500;color:${footerTagColor};">Tu mascota, todo en orden</div>
</td>
</tr></table>
<p style="margin:0;font-size:12px;color:${footerTextColor};line-height:1.6;">&copy; 2026 Pessy. Todos los derechos reservados.</p>
<p style="margin:4px 0 0;font-size:12px;color:${footerTextColor};">¿No querés recibir más emails? <a href="https://pessy.app" style="color:${footerLinkColor};text-decoration:none;font-weight:600;">Desuscribirme</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
async function sendEmailReminder(args) {
    if (!resendClient) {
        console.warn("[EMAIL] RESEND_API_KEY no configurada — email omitido");
        return;
    }
    const doseTime = new Date(args.scheduledFor);
    const actualDoseTime = new Date(doseTime.getTime() + args.minutesBefore * 60 * 1000);
    const timeStr = actualDoseTime.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Argentina/Buenos_Aires",
    });
    const dateStr = actualDoseTime.toLocaleDateString("es-AR", {
        weekday: "long", day: "numeric", month: "long",
        timeZone: "America/Argentina/Buenos_Aires",
    });
    const isNow = args.minutesBefore === 0;
    const esc = (s) => (s || "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c] || c));
    const safePetName = esc(args.petName);
    const safeMedName = esc(args.medicationName);
    const safeDosage = esc(args.dosage);
    const subject = isNow
        ? `Hora de la medicación de ${safePetName} — Pessy`
        : `En ${args.minutesBefore} min: medicación de ${safePetName} — Pessy`;
    const body = `
<!-- HERO -->
<tr>
  <td style="background:linear-gradient(135deg,#074738 0%,#1A9B7D 100%);padding:36px 32px;text-align:center;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:rgba(255,255,255,0.06);border-radius:50%;"></div>
    <span style="display:inline-block;background:${isNow ? '#ffffff' : 'rgba(255,255,255,0.15)'};color:${isNow ? '#074738' : '#ffffff'};font-size:12px;font-weight:700;padding:6px 16px;border-radius:100px;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:16px;position:relative;z-index:1;">
      ${isNow ? 'Hora de la toma' : `En ${args.minutesBefore} minutos`}
    </span>
    <h1 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:24px;font-weight:800;color:#fff;line-height:1.2;margin:0;position:relative;z-index:1;">
      ${isNow ? `Toca darle la medicación a ${safePetName}` : `Preparate, en ${args.minutesBefore} min toca la medicación de ${safePetName}`}
    </h1>
  </td>
</tr>
<!-- PHOTO BANNER -->
<tr><td style="font-size:0;line-height:0;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="33%"><img src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=200&fit=crop" alt="" style="width:100%;height:100px;object-fit:cover;display:block;"></td>
<td width="34%"><img src="https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=200&fit=crop" alt="" style="width:100%;height:100px;object-fit:cover;display:block;"></td>
<td width="33%"><img src="https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=200&fit=crop" alt="" style="width:100%;height:100px;object-fit:cover;display:block;"></td>
</tr></table>
</td></tr>
<!-- MEDICAMENTO CARD -->
<tr>
  <td style="padding:28px 32px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FAF9;border-radius:14px;border:1px solid #E0F2F1;overflow:hidden;">
      <tr><td style="padding:4px 0 0;"><div style="height:3px;background:#074738;border-radius:3px 3px 0 0;"></div></td></tr>
      <tr>
        <td style="padding:20px 24px;">
          <div style="font-size:11px;font-weight:700;color:#074738;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Medicamento</div>
          <div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:22px;font-weight:800;color:#0f1f1c;line-height:1.1;">${safeMedName}</div>
          ${safeDosage ? `<div style="font-size:14px;color:#4a6b62;margin-top:6px;font-weight:500;">${safeDosage}</div>` : ""}
        </td>
      </tr>
    </table>
  </td>
</tr>
<!-- HORA -->
<tr>
  <td style="padding:0 32px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9fb;border-radius:14px;border:1px solid #e8eae8;">
      <tr>
        <td style="padding:16px 24px;">
          <div style="font-size:12px;color:#888;margin-bottom:4px;font-weight:500;">Hora de la toma</div>
          <div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:17px;font-weight:700;color:#0f1f1c;">${dateStr} · ${timeStr}</div>
        </td>
      </tr>
    </table>
  </td>
</tr>
<!-- CTA -->
<tr>
  <td style="text-align:center;padding:0 32px 32px;">
    <a href="https://pessy.app/inicio" style="display:inline-block;background:#1A9B7D;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:16px;padding:16px 48px;border-radius:14px;text-decoration:none;letter-spacing:0.02em;">
      Abrir Pessy
    </a>
  </td>
</tr>`;
    const html = pessyEmailWrap({
        preheader: isNow ? `Es hora de la medicación de ${safePetName}` : `En ${args.minutesBefore} min: medicación de ${safePetName}`,
        headerSubtitle: "Recordatorio de medicación",
        bodyHtml: body,
        footerDark: true,
    });
    try {
        await resendClient.emails.send({
            from: "PESSY <noreply@pessy.app>",
            to: args.toEmail,
            subject,
            html,
        });
        console.log(`[EMAIL] ✅ Notificación de medicamento enviada`);
    }
    catch (err) {
        console.error("[EMAIL] Error enviando:", err);
    }
}
// ═══════════════════════════════════════════════════════════════
// 1. EMAIL DE INVITACIÓN (pre-registro / acceso anticipado)
// ═══════════════════════════════════════════════════════════════
async function sendInvitationEmail(args) {
    if (!resendClient) {
        console.warn("[EMAIL] RESEND_API_KEY no configurada — email omitido");
        return;
    }
    const greeting = args.userName ? `¡Hola ${args.userName}!` : "¡Hola!";
    const body = `
<tr><td style="position:relative;overflow:hidden;">
<img src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=500&fit=crop" alt="Perro feliz" style="width:100%;height:320px;object-fit:cover;display:block;">
<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(7,71,56,0.85) 0%,rgba(7,71,56,0.4) 60%,transparent 100%);padding:40px 32px 28px;">
<h1 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:26px;font-weight:800;color:#fff;line-height:1.2;margin:0;">Tu mascota, sus cosas,<br>todo en orden.</h1>
<p style="font-size:14px;color:rgba(255,255,255,0.85);margin:6px 0 0;">La app que organiza la vida con tu mascota</p>
</div>
</td></tr>
<tr><td style="padding:32px;">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:20px;font-weight:700;color:#074738;margin-bottom:16px;">${greeting}</div>
<p style="font-size:15px;color:#333;line-height:1.65;margin:0 0 16px;">Sabemos lo que es querer a una mascota y, al mismo tiempo, perder de vista cuándo fue la última vacuna, si ya compré el alimento o quién lo lleva al veterinario esta vez.</p>
<p style="font-size:15px;color:#333;line-height:1.65;margin:0 0 16px;"><strong style="color:#074738;">Pessy</strong> nació para resolver eso: una app simple que centraliza la información, las rutinas y los recordatorios de tu mascota en un solo lugar.</p>
<p style="font-size:15px;color:#333;line-height:1.65;margin:0 0 16px;">Estamos armando una comunidad de personas que quieren probarla antes que nadie. Y nos encantaría que seas parte.</p>
</td></tr>
<tr><td style="padding:0;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="33%" style="text-align:center;padding:20px 8px;"><img src="https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=300&h=300&fit=crop" alt="Perro" style="width:100%;height:80px;object-fit:cover;border-radius:10px;"><div style="font-size:12px;color:#074738;font-weight:600;margin-top:10px;">Salud al día</div></td>
<td width="33%" style="text-align:center;padding:20px 8px;border-left:1px solid #E0F2F1;border-right:1px solid #E0F2F1;"><img src="https://images.unsplash.com/photo-1574158622682-e40e69881006?w=300&h=300&fit=crop" alt="Gato" style="width:100%;height:80px;object-fit:cover;border-radius:10px;"><div style="font-size:12px;color:#074738;font-weight:600;margin-top:10px;">Rutinas claras</div></td>
<td width="33%" style="text-align:center;padding:20px 8px;"><img src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300&h=300&fit=crop" alt="Perros" style="width:100%;height:80px;object-fit:cover;border-radius:10px;"><div style="font-size:12px;color:#074738;font-weight:600;margin-top:10px;">Todo compartido</div></td>
</tr></table>
</td></tr>
<tr><td style="text-align:center;padding:8px 0 24px;">
<a href="https://pessy.app/empezar" style="display:inline-block;background:#1A9B7D;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:16px;padding:16px 48px;border-radius:14px;text-decoration:none;">Quiero probar Pessy</a>
</td></tr>
<tr><td><img src="https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=800&h=500&fit=crop" alt="Gato" style="width:100%;height:180px;object-fit:cover;display:block;"></td></tr>`;
    const html = pessyEmailWrap({
        preheader: "Tu mascota, sus cosas, todo en orden. Pessy te invita a organizar la vida con tu mascota.",
        bodyHtml: body,
        footerDark: false,
    });
    try {
        await resendClient.emails.send({
            from: "PESSY <noreply@pessy.app>",
            to: args.toEmail,
            subject: "Te invitamos a probar Pessy",
            html,
        });
        console.log(`[EMAIL] ✅ Invitación enviada`);
    }
    catch (err) {
        console.error("[EMAIL] Error enviando invitación:", err);
    }
}
// ═══════════════════════════════════════════════════════════════
// 2. EMAIL DE BIENVENIDA (post-registro)
// ═══════════════════════════════════════════════════════════════
async function sendWelcomeEmail(args) {
    if (!resendClient) {
        console.warn("[EMAIL] RESEND_API_KEY no configurada — email omitido");
        return;
    }
    const body = `
<tr><td style="background:linear-gradient(135deg,#074738 0%,#1A9B7D 100%);padding:40px 32px;text-align:center;position:relative;overflow:hidden;">
<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:rgba(255,255,255,0.06);border-radius:50%;"></div>
<h1 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:28px;font-weight:800;color:#fff;line-height:1.2;margin:0 0 8px;position:relative;z-index:1;">¡Bienvenido a Pessy!</h1>
<p style="font-size:15px;color:rgba(255,255,255,0.8);margin:0;position:relative;z-index:1;">Ya sos parte. Ahora, a organizar todo.</p>
</td></tr>
<tr><td style="font-size:0;line-height:0;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="33%"><img src="https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=300&fit=crop" alt="Perro" style="width:100%;height:160px;object-fit:cover;display:block;"></td>
<td width="34%"><img src="https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop" alt="Gato" style="width:100%;height:160px;object-fit:cover;display:block;"></td>
<td width="33%"><img src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop" alt="Perro" style="width:100%;height:160px;object-fit:cover;display:block;"></td>
</tr></table>
</td></tr>
<tr><td style="padding:32px;">
<p style="font-size:15px;color:#333;line-height:1.65;margin:0 0 16px;">Gracias por sumarte. <strong style="color:#074738;">Pessy</strong> está pensada para que la vida con tu mascota sea más simple, más clara y un poco más linda.</p>
<p style="font-size:15px;color:#333;line-height:1.65;margin:0;">Te dejamos tres pasos rápidos para arrancar:</p>
</td></tr>
<tr><td style="padding:0 32px 24px;">
<table cellpadding="0" cellspacing="0" width="100%">
<tr><td style="padding-bottom:20px;">
<table cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:top;padding-right:16px;"><img src="https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=200&h=200&fit=crop" alt="Cachorro" style="width:64px;height:64px;border-radius:14px;object-fit:cover;"></td>
<td style="vertical-align:top;">
<div style="display:inline-block;background:#E0F2F1;color:#074738;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:12px;width:24px;height:24px;border-radius:8px;text-align:center;line-height:24px;margin-bottom:6px;">1</div>
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:15px;color:#074738;">Creá el perfil de tu mascota</div>
<div style="font-size:13px;color:#666;line-height:1.5;">Nombre, raza, fecha de nacimiento y una foto. Así queda todo listo.</div>
</td></tr></table>
</td></tr>
<tr><td style="padding-bottom:20px;">
<table cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:top;padding-right:16px;"><img src="https://images.unsplash.com/photo-1586671267731-da2cf3ceeb80?w=200&h=200&fit=crop" alt="Perro" style="width:64px;height:64px;border-radius:14px;object-fit:cover;"></td>
<td style="vertical-align:top;">
<div style="display:inline-block;background:#E0F2F1;color:#074738;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:12px;width:24px;height:24px;border-radius:8px;text-align:center;line-height:24px;margin-bottom:6px;">2</div>
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:15px;color:#074738;">Agregá lo importante</div>
<div style="font-size:13px;color:#666;line-height:1.5;">Vacunas, controles, rutinas. Lo que necesites tener a mano.</div>
</td></tr></table>
</td></tr>
<tr><td>
<table cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:top;padding-right:16px;"><img src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=200&h=200&fit=crop" alt="Perros" style="width:64px;height:64px;border-radius:14px;object-fit:cover;"></td>
<td style="vertical-align:top;">
<div style="display:inline-block;background:#E0F2F1;color:#074738;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:12px;width:24px;height:24px;border-radius:8px;text-align:center;line-height:24px;margin-bottom:6px;">3</div>
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:15px;color:#074738;">Invitá a un co-tutor</div>
<div style="font-size:13px;color:#666;line-height:1.5;">Tu pareja, un familiar, quien también cuide a tu mascota. Compartan todo.</div>
</td></tr></table>
</td></tr>
</table>
</td></tr>
<tr><td style="text-align:center;padding:8px 32px 32px;">
<a href="https://pessy.app/register-pet" style="display:inline-block;background:#1A9B7D;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:16px;padding:16px 48px;border-radius:14px;text-decoration:none;">Crear perfil de mascota</a>
</td></tr>
<tr><td style="background:#F0FAF9;padding:28px 32px;text-align:center;border-top:3px solid #E0F2F1;">
<img src="https://images.unsplash.com/photo-1544568100-847a948585b9?w=200&h=200&fit=crop" alt="Perro" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:12px;border:3px solid #E0F2F1;">
<p style="font-size:14px;color:#074738;font-style:italic;line-height:1.6;margin:0 0 8px;">"La idea es simple: que no se te pase nada importante de tu mascota, nunca más."</p>
<span style="font-size:12px;color:#666;font-weight:600;">— Equipo Pessy</span>
</td></tr>`;
    const html = pessyEmailWrap({
        preheader: "¡Ya estás dentro! Tu perfil de mascota te espera en Pessy.",
        bodyHtml: body,
        footerDark: true,
    });
    try {
        await resendClient.emails.send({
            from: "PESSY <noreply@pessy.app>",
            to: args.toEmail,
            subject: "¡Bienvenido a Pessy!",
            html,
        });
        console.log(`[EMAIL] ✅ Bienvenida enviada a ${args.toEmail}`);
    }
    catch (err) {
        console.error("[EMAIL] Error enviando bienvenida:", err);
    }
}
// ═══════════════════════════════════════════════════════════════
// 3. EMAIL DE INVITACIÓN CO-TUTOR
// ═══════════════════════════════════════════════════════════════
async function sendCoTutorInvitationEmail(args) {
    if (!resendClient) {
        console.warn("[EMAIL] RESEND_API_KEY no configurada — email omitido");
        return;
    }
    const petDetail = [args.petBreed, args.petAge].filter(Boolean).join(" · ");
    const body = `
<tr><td style="position:relative;overflow:hidden;">
<img src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&h=500&fit=crop" alt="Perros juntos" style="width:100%;height:280px;object-fit:cover;display:block;">
<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(7,71,56,0.9) 0%,rgba(7,71,56,0.5) 50%,transparent 100%);padding:48px 32px 28px;">
<h1 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:24px;font-weight:800;color:#fff;line-height:1.25;margin:0;">Te invitaron a ser<br>co-tutor</h1>
<p style="font-size:14px;color:rgba(255,255,255,0.8);margin:6px 0 0;">Alguien quiere que compartan el cuidado de su mascota</p>
</div>
</td></tr>
<tr><td style="padding:32px;">
<p style="font-size:15px;color:#333;line-height:1.65;margin:0 0 16px;"><strong style="color:#074738;">${args.inviterName}</strong> te invitó a ser co-tutor de su mascota en <strong style="color:#074738;">Pessy</strong>.</p>
<p style="font-size:15px;color:#333;line-height:1.65;margin:0;">Esto significa que vas a poder ver toda la información, recibir recordatorios y colaborar en el cuidado. Sin perder nada, sin preguntar "¿cuándo fue la última vacuna?".</p>
</td></tr>
<tr><td style="padding:0 32px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FAF9;border-radius:18px;border:1px solid #E0F2F1;"><tr>
<td style="padding:20px;vertical-align:middle;width:72px;"><img src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=200&h=200&fit=crop" alt="Mascota" style="width:72px;height:72px;border-radius:16px;object-fit:cover;"></td>
<td style="padding:20px 20px 20px 0;vertical-align:middle;">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:18px;color:#074738;">${args.petName}</div>
${petDetail ? `<div style="font-size:13px;color:#666;margin-top:2px;">${petDetail}</div>` : ""}
<div style="display:inline-block;background:#E0F2F1;color:#1A9B7D;font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;margin-top:6px;">Perfil completo</div>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 32px 24px;">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:16px;color:#074738;margin-bottom:16px;">Como co-tutor vas a poder:</div>
<table cellpadding="0" cellspacing="0" width="100%">
<tr><td style="padding-bottom:14px;">
<table cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:top;padding-right:14px;"><img src="https://images.unsplash.com/photo-1586671267731-da2cf3ceeb80?w=200&h=200&fit=crop" alt="" style="width:48px;height:48px;border-radius:12px;object-fit:cover;"></td>
<td style="vertical-align:top;"><div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;color:#074738;font-weight:700;">Ver el historial completo</div><div style="font-size:13px;color:#666;line-height:1.5;">Vacunas, controles, tratamientos. Todo en un solo lugar.</div></td>
</tr></table>
</td></tr>
<tr><td style="padding-bottom:14px;">
<table cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:top;padding-right:14px;"><img src="https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=200&h=200&fit=crop" alt="" style="width:48px;height:48px;border-radius:12px;object-fit:cover;"></td>
<td style="vertical-align:top;"><div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;color:#074738;font-weight:700;">Recibir recordatorios</div><div style="font-size:13px;color:#666;line-height:1.5;">Para que entre los dos no se pase nada importante.</div></td>
</tr></table>
</td></tr>
<tr><td>
<table cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:top;padding-right:14px;"><img src="https://images.unsplash.com/photo-1544568100-847a948585b9?w=200&h=200&fit=crop" alt="" style="width:48px;height:48px;border-radius:12px;object-fit:cover;"></td>
<td style="vertical-align:top;"><div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;color:#074738;font-weight:700;">Agregar información</div><div style="font-size:13px;color:#666;line-height:1.5;">Si llevás a la mascota al veterinario, cargalo directo.</div></td>
</tr></table>
</td></tr>
</table>
</td></tr>
<tr><td style="text-align:center;padding:8px 32px 12px;">
<a href="${args.acceptUrl}" style="display:inline-block;background:#5048CA;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:16px;padding:16px 48px;border-radius:14px;text-decoration:none;">Aceptar invitación</a>
</td></tr>
<tr><td style="text-align:center;padding:0 32px 32px;">
<span style="font-size:13px;color:#666;">¿No conocés a esta persona? <a href="https://pessy.app" style="color:#1A9B7D;text-decoration:none;font-weight:600;">Ignorar invitación</a></span>
</td></tr>
<tr><td style="font-size:0;line-height:0;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="33%"><img src="https://images.unsplash.com/photo-1574158622682-e40e69881006?w=300&h=300&fit=crop" alt="" style="width:100%;height:120px;object-fit:cover;display:block;"></td>
<td width="34%"><img src="https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300&h=300&fit=crop" alt="" style="width:100%;height:120px;object-fit:cover;display:block;"></td>
<td width="33%"><img src="https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=300&h=300&fit=crop" alt="" style="width:100%;height:120px;object-fit:cover;display:block;"></td>
</tr></table>
</td></tr>`;
    const html = pessyEmailWrap({
        preheader: `${args.inviterName} te invitó a ser co-tutor de ${args.petName} en Pessy.`,
        bodyHtml: body,
        footerDark: false,
    });
    try {
        await resendClient.emails.send({
            from: "PESSY <noreply@pessy.app>",
            to: args.toEmail,
            subject: `${args.inviterName} te invitó a ser co-tutor en Pessy`,
            html,
        });
        console.log(`[EMAIL] ✅ Invitación co-tutor enviada`);
    }
    catch (err) {
        console.error("[EMAIL] Error enviando invitación co-tutor:", err);
    }
}
// ═══════════════════════════════════════════════════════════════
// CLOUD FUNCTIONS — exponer los emails como callable
// ═══════════════════════════════════════════════════════════════
exports.pessySendInvitationEmail = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Requiere autenticación");
    if (!rateLimiter.perUser(context.auth.uid, 10, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests.");
    if (!rateLimiter.globalLimit("pessySendInvitationEmail", 100, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Service is busy.");
    await sendInvitationEmail({ toEmail: data.toEmail, userName: data.userName });
    return { success: true };
});
exports.pessySendWelcomeEmail = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Requiere autenticación");
    if (!rateLimiter.perUser(context.auth.uid, 10, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests.");
    if (!rateLimiter.globalLimit("pessySendWelcomeEmail", 100, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Service is busy.");
    await sendWelcomeEmail({ toEmail: data.toEmail, userName: data.userName });
    return { success: true };
});
exports.pessySendCoTutorInvitation = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Requiere autenticación");
    if (!rateLimiter.perUser(context.auth.uid, 10, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests.");
    if (!rateLimiter.globalLimit("pessySendCoTutorInvitation", 100, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Service is busy.");
    await sendCoTutorInvitationEmail({
        toEmail: data.toEmail,
        inviterName: data.inviterName,
        petName: data.petName,
        petBreed: data.petBreed,
        petAge: data.petAge,
        acceptUrl: data.acceptUrl || "https://pessy.app/login",
    });
    return { success: true };
});
// ─── AUTO-TRIGGER: enviar bienvenida al crear usuario ───
exports.onUserCreatedSendWelcome = functions.auth.user().onCreate(async (user) => {
    if (!user.email)
        return;
    await sendWelcomeEmail({
        toEmail: user.email,
        userName: user.displayName || undefined,
    });
});
const oauth_1 = require("./gmail/oauth");
Object.defineProperty(exports, "disconnectGmailSync", { enumerable: true, get: function () { return oauth_1.disconnectGmailSync; } });
Object.defineProperty(exports, "getGmailConnectUrl", { enumerable: true, get: function () { return oauth_1.getGmailConnectUrl; } });
Object.defineProperty(exports, "gmailAuthCallback", { enumerable: true, get: function () { return oauth_1.gmailAuthCallback; } });
Object.defineProperty(exports, "syncAppointmentCalendarEvent", { enumerable: true, get: function () { return oauth_1.syncAppointmentCalendarEvent; } });
const petPhotos_1 = require("./media/petPhotos");
Object.defineProperty(exports, "uploadPetPhoto", { enumerable: true, get: function () { return petPhotos_1.uploadPetPhoto; } });
const knowledgeBase_1 = require("./clinical/knowledgeBase");
const brainResolver_1 = require("./clinical/brainResolver");
const groundedBrain_1 = require("./clinical/groundedBrain");
Object.defineProperty(exports, "pessyClinicalBrainGrounding", { enumerable: true, get: function () { return groundedBrain_1.pessyClinicalBrainGrounding; } });
const vertexDatastoreAdmin_1 = require("./clinical/vertexDatastoreAdmin");
Object.defineProperty(exports, "provisionPessyVertexDatastore", { enumerable: true, get: function () { return vertexDatastoreAdmin_1.provisionPessyVertexDatastore; } });
const notebookKnowledgeSync_1 = require("./clinical/notebookKnowledgeSync");
Object.defineProperty(exports, "syncNotebookKnowledge", { enumerable: true, get: function () { return notebookKnowledgeSync_1.syncNotebookKnowledge; } });
const seedNotebookKnowledge_1 = require("./clinical/seedNotebookKnowledge");
Object.defineProperty(exports, "seedBrainKnowledge", { enumerable: true, get: function () { return seedNotebookKnowledge_1.seedBrainKnowledge; } });
const treatmentReminderEngine_1 = require("./clinical/treatmentReminderEngine");
Object.defineProperty(exports, "dispatchTreatmentRemindersV3", { enumerable: true, get: function () { return treatmentReminderEngine_1.dispatchTreatmentRemindersV3; } });
Object.defineProperty(exports, "evaluateTreatmentDedupV3", { enumerable: true, get: function () { return treatmentReminderEngine_1.evaluateTreatmentDedupV3; } });
Object.defineProperty(exports, "markMissedTreatmentDosesV3", { enumerable: true, get: function () { return treatmentReminderEngine_1.markMissedTreatmentDosesV3; } });
Object.defineProperty(exports, "onMedicationWriteScheduleV3", { enumerable: true, get: function () { return treatmentReminderEngine_1.onMedicationWriteScheduleV3; } });
Object.defineProperty(exports, "onTreatmentWriteScheduleV3", { enumerable: true, get: function () { return treatmentReminderEngine_1.onTreatmentWriteScheduleV3; } });
Object.defineProperty(exports, "recordDoseEventV3", { enumerable: true, get: function () { return treatmentReminderEngine_1.recordDoseEventV3; } });
Object.defineProperty(exports, "syncTreatmentTimezoneV3", { enumerable: true, get: function () { return treatmentReminderEngine_1.syncTreatmentTimezoneV3; } });
const projectionLayer_1 = require("./clinical/projectionLayer");
Object.defineProperty(exports, "onClinicalEventProjection", { enumerable: true, get: function () { return projectionLayer_1.onClinicalEventProjection; } });
const backfillProjection_1 = require("./clinical/backfillProjection");
Object.defineProperty(exports, "backfillClinicalProjection", { enumerable: true, get: function () { return backfillProjection_1.backfillClinicalProjection; } });
const episodeCompiler_1 = require("./clinical/episodeCompiler");
Object.defineProperty(exports, "backfillClinicalEpisodes", { enumerable: true, get: function () { return episodeCompiler_1.backfillClinicalEpisodes; } });
const accountDeletion_1 = require("./compliance/accountDeletion");
Object.defineProperty(exports, "deleteUserAccount", { enumerable: true, get: function () { return accountDeletion_1.deleteUserAccount; } });
Object.defineProperty(exports, "deleteAllUserClinicalData", { enumerable: true, get: function () { return accountDeletion_1.deleteAllUserClinicalData; } });
Object.defineProperty(exports, "submitDataDeletionRequest", { enumerable: true, get: function () { return accountDeletion_1.submitDataDeletionRequest; } });
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
const LAB_LIKE_DOCUMENT_TYPES = new Set(["laboratory_result", "lab_result", "lab_test", "clinical_report"]);
const userSettingsCache = new Map();
const userTokenCache = new Map();
const userTimezoneCache = new Map();
const petNameCache = new Map();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const GMAIL_SYNC_REMINDER_LAST_DAY = 3;
const GMAIL_SYNC_AUTO_ACCEPT_DAY = 4;
function toDateKeyInTimezone(date, timeZone) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    return formatter.format(date);
}
function parseYmdOrIsoToDateKey(value, timeZone = "UTC") {
    if (typeof value !== "string" || !value.trim())
        return "";
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed))
        return trimmed;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime()))
        return "";
    return toDateKeyInTimezone(parsed, timeZone);
}
function normalizeMedicationName(value) {
    if (typeof value !== "string")
        return "";
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}
function parseDurationToEndDate(duration, startDateIso) {
    if (typeof duration !== "string" || !duration.trim())
        return null;
    if (typeof startDateIso !== "string" || !startDateIso.trim())
        return null;
    const normalized = duration.toLowerCase().trim();
    if (normalized.includes("cronic") ||
        normalized.includes("indefin") ||
        normalized.includes("continu")) {
        return null;
    }
    const match = normalized.match(/(\d+)\s*(dia|dias|días|semana|semanas|mes|meses)/i);
    if (!match)
        return null;
    const quantity = Number(match[1]);
    if (!Number.isFinite(quantity) || quantity <= 0)
        return null;
    const start = new Date(startDateIso);
    if (Number.isNaN(start.getTime()))
        return null;
    const end = new Date(start);
    const unit = match[2].toLowerCase();
    if (unit.startsWith("dia") || unit.startsWith("día"))
        end.setDate(end.getDate() + quantity);
    if (unit.startsWith("semana"))
        end.setDate(end.getDate() + quantity * 7);
    if (unit.startsWith("mes"))
        end.setMonth(end.getMonth() + quantity);
    return end.toISOString();
}
function isChronicMarker(value) {
    if (typeof value !== "string")
        return false;
    const normalized = value.toLowerCase();
    return normalized.includes("cronic") || normalized.includes("indefin") || normalized.includes("continu");
}
function isTypeEnabled(settings, type) {
    if (settings.enabled === false)
        return false;
    if (type === "medication")
        return settings.medications !== false;
    if (type === "appointment")
        return settings.appointments !== false;
    if (type === "vaccine_reminder")
        return settings.vaccines !== false;
    if (type === "results")
        return settings.results !== false;
    return true;
}
async function getUserEmail(userId) {
    try {
        const userRecord = await admin.auth().getUser(userId);
        return userRecord.email || null;
    }
    catch (_a) {
        return null;
    }
}
async function getUserSettings(userId) {
    var _a;
    if (userSettingsCache.has(userId))
        return userSettingsCache.get(userId);
    const userSnap = await db.collection("users").doc(userId).get();
    const settings = (((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.notificationSettings) || {});
    userSettingsCache.set(userId, settings);
    return settings;
}
async function getUserTokenAndTimezone(userId) {
    var _a, _b;
    let token = userTokenCache.get(userId);
    let timezone = userTimezoneCache.get(userId);
    if (token === undefined || !timezone) {
        const tokenCol = db.collection("users").doc(userId).collection("fcm_tokens");
        const primaryDoc = await tokenCol.doc("primary").get();
        if (primaryDoc.exists) {
            token = ((_a = primaryDoc.data()) === null || _a === void 0 ? void 0 : _a.token) || null;
            timezone = ((_b = primaryDoc.data()) === null || _b === void 0 ? void 0 : _b.timezone) || "UTC";
        }
        else {
            const fallbackSnap = await tokenCol.limit(1).get();
            if (!fallbackSnap.empty) {
                const fallback = fallbackSnap.docs[0].data();
                token = (fallback === null || fallback === void 0 ? void 0 : fallback.token) || null;
                timezone = (fallback === null || fallback === void 0 ? void 0 : fallback.timezone) || "UTC";
            }
            else {
                token = null;
                timezone = "UTC";
            }
        }
        userTokenCache.set(userId, token);
        userTimezoneCache.set(userId, timezone);
    }
    return { token: token || null, timezone: timezone || "UTC" };
}
async function resolvePetName(petId) {
    var _a;
    if (!petId)
        return "tu mascota";
    if (petNameCache.has(petId))
        return petNameCache.get(petId);
    const petSnap = await db.collection("pets").doc(petId).get();
    const name = petSnap.exists ? ((_a = petSnap.data()) === null || _a === void 0 ? void 0 : _a.name) || "tu mascota" : "tu mascota";
    petNameCache.set(petId, name);
    return name;
}
async function sendPushMessage(args) {
    const message = {
        token: args.token,
        notification: {
            title: args.title,
            body: args.body,
        },
        data: {
            notificationId: args.notificationId || "",
            type: args.type || "general",
            petId: args.petId || "",
            petName: args.petName || "",
            sourceEventId: args.sourceEventId || "",
        },
        android: {
            priority: "high",
            notification: {
                channelId: "pessy_reminders",
                priority: "high",
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
    await messaging.send(message);
}
function chunkItems(items, size) {
    if (size <= 0)
        return [items];
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}
function toStringDataRecord(value) {
    if (!value || typeof value !== "object")
        return {};
    const entries = Object.entries(value);
    const out = {};
    for (const [key, raw] of entries) {
        if (raw == null)
            continue;
        if (typeof raw === "string")
            out[key] = raw;
        else if (typeof raw === "number" || typeof raw === "boolean")
            out[key] = String(raw);
        else
            out[key] = JSON.stringify(raw);
    }
    return out;
}
function asRecord(value) {
    if (!value || typeof value !== "object")
        return {};
    return value;
}
function parseIsoToMs(value) {
    if (typeof value !== "string" || !value.trim())
        return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}
function getGmailReminderCopy(dayNumber) {
    if (dayNumber >= 3) {
        return {
            title: "⚠️ Último aviso: activá Gmail Sync",
            body: "Último día para activar la sincronización de correos veterinarios en Pessy.",
        };
    }
    if (dayNumber === 2) {
        return {
            title: "📧 Recordatorio día 2: activá Gmail Sync",
            body: "Falta 1 día para cerrar este recordatorio. Podés activar Gmail Sync en segundos.",
        };
    }
    return {
        title: "📧 Recordatorio día 1: activá Gmail Sync",
        body: "Danos permiso para leer correos veterinarios y completar historial, turnos y tratamientos.",
    };
}
function slugifyKey(value) {
    if (typeof value !== "string")
        return "unknown";
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .trim() || "unknown";
}
function buildAlertId(petId, ruleId, scopeKey) {
    return `alt_${petId}_${slugifyKey(ruleId)}_${slugifyKey(scopeKey)}`;
}
function parseEventTimestamp(event) {
    const extracted = asRecord(event.extractedData);
    const candidate = event.eventDate || extracted.eventDate || event.createdAt || "";
    const ts = Date.parse(candidate);
    return Number.isNaN(ts) ? 0 : ts;
}
function getEventDocumentType(event) {
    const extracted = asRecord(event.extractedData);
    const raw = (event.documentType || extracted.documentType || "").toString().toLowerCase().trim();
    return raw;
}
function hasFollowupKeyword(text) {
    if (typeof text !== "string")
        return false;
    const normalized = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    return /(control|recheck|re chequeo|seguimiento|cardio|presion|consulta|turno|revision)/i.test(normalized);
}
function extractRecommendations(event) {
    const extracted = asRecord(event.extractedData);
    const master = asRecord(extracted.masterClinical);
    const fromTop = Array.isArray(event.recommendations) ? event.recommendations : [];
    const fromMaster = Array.isArray(master.recommendations) ? master.recommendations : [];
    const fromLegacy = [extracted.nextAppointmentReason];
    return [...fromTop, ...fromMaster, ...fromLegacy]
        .filter((item) => typeof item === "string")
        .map((item) => String(item).trim())
        .filter(Boolean);
}
function extractAbnormalFindings(event) {
    const findings = [];
    const topLevel = Array.isArray(event.abnormalFindings) ? event.abnormalFindings : [];
    for (const row of topLevel) {
        const item = asRecord(row);
        const parameter = typeof item.parameter === "string" ? item.parameter.trim() : "";
        const status = typeof item.status === "string" ? item.status.trim().toLowerCase() : "";
        if (!parameter || !status)
            continue;
        if (status === "alto" || status === "bajo" || status === "alterado") {
            findings.push({ parameter, status });
        }
    }
    if (findings.length > 0)
        return findings;
    const extracted = asRecord(event.extractedData);
    const measurements = Array.isArray(extracted.measurements) ? extracted.measurements : [];
    for (const row of measurements) {
        const item = asRecord(row);
        const parameter = typeof item.name === "string" ? item.name.trim() : "";
        const range = typeof item.referenceRange === "string" ? item.referenceRange.toLowerCase() : "";
        let status = "";
        if (range.includes("alto") || range.includes("elevado") || range.includes("high"))
            status = "alto";
        if (range.includes("bajo") || range.includes("low") || range.includes("disminuido"))
            status = "bajo";
        if (range.includes("alterado") || range.includes("abnormal"))
            status = "alterado";
        if (!parameter || !status)
            continue;
        findings.push({ parameter, status });
    }
    return findings;
}
async function upsertClinicalAlert(alert) {
    const ref = db.collection("clinical_alerts").doc(alert.id);
    const prevSnap = await ref.get();
    if (!prevSnap.exists) {
        await ref.set(alert);
        return;
    }
    const prev = prevSnap.data();
    const uniq = (items = []) => Array.from(new Set(items.filter(Boolean)));
    await ref.set(Object.assign(Object.assign(Object.assign({}, prev), alert), { triggeredOn: prev.triggeredOn || alert.triggeredOn, lastSeenOn: alert.lastSeenOn, status: alert.status, linkedConditionIds: uniq([...(prev.linkedConditionIds || []), ...(alert.linkedConditionIds || [])]), linkedEventIds: uniq([...(prev.linkedEventIds || []), ...(alert.linkedEventIds || [])]), linkedAppointmentIds: uniq([...(prev.linkedAppointmentIds || []), ...(alert.linkedAppointmentIds || [])]) }), { merge: true });
}
async function resolveClinicalAlert(alertId, notes, nowIso) {
    const ref = db.collection("clinical_alerts").doc(alertId);
    const snap = await ref.get();
    if (!snap.exists)
        return;
    const current = snap.data();
    if (current.status !== "active")
        return;
    await ref.update({
        status: "resolved",
        resolutionNotes: notes,
        lastSeenOn: nowIso,
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// CRON: Revisa cada 15 minutos si hay notificaciones pendientes para enviar
// ─────────────────────────────────────────────────────────────────────────────
exports.sendScheduledNotifications = functions
    .runWith({ secrets: ["RESEND_API_KEY"] })
    .pubsub.schedule("every 15 minutes")
    .onRun(async () => {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 16 * 60 * 1000); // ventana 16 min para cubrir gap entre ejecuciones
    const nowIso = now.toISOString();
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
    const uniqueDocs = [];
    const seenKeys = new Set();
    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const dedupeKey = [
            data.repeatRootId || data.sourceMedicationId || docSnap.id,
            data.userId || "",
            data.petId || "",
            data.type || "",
            data.scheduledFor || "",
        ].join("|");
        if (seenKeys.has(dedupeKey)) {
            await docSnap.ref.update({ sent: true, sentAt: nowIso, skipped: "duplicate_window" });
            continue;
        }
        seenKeys.add(dedupeKey);
        uniqueDocs.push(docSnap);
    }
    console.log(`[CRON] ${uniqueDocs.length} notificaciones únicas a enviar`);
    const results = await Promise.allSettled(uniqueDocs.map(async (docSnap) => {
        const notification = docSnap.data();
        const userId = notification.userId || "";
        const type = notification.type || "medication";
        if (!userId) {
            await docSnap.ref.update({ sent: true, sentAt: nowIso, error: "missing_user" });
            return;
        }
        const settings = await getUserSettings(userId);
        if (!isTypeEnabled(settings, type)) {
            await docSnap.ref.update({ sent: true, sentAt: nowIso, skipped: "settings_disabled" });
            return;
        }
        const { token } = await getUserTokenAndTimezone(userId);
        const tokenMissing = !token;
        if (tokenMissing) {
            console.warn(`[CRON] Sin token para usuario ${userId} — marcando sent y reprogramando cadena`);
            await docSnap.ref.update({ sent: true, sentAt: nowIso, error: "no_token" });
            // No hacemos return: dejamos que la lógica de repeat corra igual
            // para que la cadena recurrente no se rompa cuando el usuario aún no tiene token.
        }
        else {
            await sendPushMessage({
                token,
                title: notification.title || "Pessy",
                body: notification.body || "",
                type,
                petId: notification.petId,
                petName: notification.petName,
                sourceEventId: notification.sourceEventId,
                notificationId: docSnap.id,
            });
            // Email fallback para medicaciones (solo pre-aviso de 15 min o menos)
            if (type === "medication") {
                const scheduledFor = notification.scheduledFor;
                const repeatRootId = notification.repeatRootId || "";
                const isPre5 = repeatRootId.endsWith("_pre5");
                const isPre60 = repeatRootId.endsWith("_pre60");
                // Solo mandamos email en el aviso de 5 min (isPre5) — es el más cercano a la toma
                if (isPre5) {
                    const userEmail = await getUserEmail(userId);
                    if (userEmail) {
                        await sendEmailReminder({
                            toEmail: userEmail,
                            petName: notification.petName || "tu mascota",
                            medicationName: (notification.body || "").split(" · ")[0] || "Medicación",
                            dosage: (notification.body || "").split(" · ")[1] || "",
                            scheduledFor,
                            minutesBefore: 5,
                        });
                    }
                }
                else if (!isPre60 && !isPre5) {
                    // Es la dosis exacta — también mandamos email
                    const userEmail = await getUserEmail(userId);
                    if (userEmail) {
                        await sendEmailReminder({
                            toEmail: userEmail,
                            petName: notification.petName || "tu mascota",
                            medicationName: (notification.body || "").split(" · ")[0] || "Medicación",
                            dosage: (notification.body || "").split(" · ")[1] || "",
                            scheduledFor,
                            minutesBefore: 0,
                        });
                    }
                }
            }
            await docSnap.ref.update({ sent: true, sentAt: nowIso });
        }
        if (notification.repeat !== "none" && Number(notification.repeatInterval) > 0) {
            const currentScheduled = new Date(notification.scheduledFor);
            const nextDate = new Date(currentScheduled.getTime() + Number(notification.repeatInterval) * 3600000);
            if (!Number.isNaN(nextDate.getTime())) {
                const endAtRaw = notification.endAt;
                const endAt = endAtRaw ? new Date(endAtRaw) : null;
                const shouldScheduleNext = !endAt || nextDate.getTime() <= endAt.getTime();
                if (shouldScheduleNext) {
                    const repeatRootId = notification.repeatRootId || docSnap.id;
                    // Limpiar sufijo _pre60 / _pre5 del rootId para obtener el id base
                    const baseRootId = repeatRootId.replace(/_pre60$|_pre5$/, "");
                    // Dosis principal
                    const nextDocId = `${baseRootId}_${nextDate.getTime()}`;
                    const basePayload = {
                        userId,
                        petId: notification.petId || "",
                        petName: notification.petName || "Tu mascota",
                        type,
                        body: notification.body || "",
                        sourceEventId: notification.sourceEventId || null,
                        sourceMedicationId: notification.sourceMedicationId || null,
                        repeat: notification.repeat || "none",
                        repeatInterval: Number(notification.repeatInterval) || null,
                        endAt: endAtRaw || null,
                        active: true,
                        sent: false,
                        createdAt: nowIso,
                    };
                    // Solo reprogramar si este doc es la dosis principal (no los pre-avisos)
                    const isPreAlert = repeatRootId.endsWith("_pre60") || repeatRootId.endsWith("_pre5");
                    if (!isPreAlert) {
                        await db.collection("scheduled_notifications").doc(nextDocId).set(Object.assign(Object.assign({}, basePayload), { title: notification.title || "Pessy", scheduledFor: nextDate.toISOString(), repeatRootId: baseRootId }));
                        // Pre-aviso 1 hora
                        const oneHourBefore = new Date(nextDate.getTime() - 60 * 60 * 1000);
                        if (!endAt || oneHourBefore.getTime() <= endAt.getTime()) {
                            await db.collection("scheduled_notifications").doc(`${baseRootId}_pre60_${nextDate.getTime()}`).set(Object.assign(Object.assign({}, basePayload), { title: `En 1 hora medicación — ${notification.petName || "tu mascota"}`, scheduledFor: oneHourBefore.toISOString(), repeatRootId: `${baseRootId}_pre60` }));
                        }
                        // Pre-aviso 5 min
                        const fiveMinBefore = new Date(nextDate.getTime() - 5 * 60 * 1000);
                        if (!endAt || fiveMinBefore.getTime() <= endAt.getTime()) {
                            await db.collection("scheduled_notifications").doc(`${baseRootId}_pre5_${nextDate.getTime()}`).set(Object.assign(Object.assign({}, basePayload), { title: `¡En 5 min! Medicación — ${notification.petName || "tu mascota"}`, scheduledFor: fiveMinBefore.toISOString(), repeatRootId: `${baseRootId}_pre5` }));
                        }
                    }
                }
            }
        }
        console.log(`[CRON] ✅ Notificación enviada`);
    }));
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
        console.error(`[CRON] ${failed.length} notificaciones fallaron`);
    }
    return null;
});
// ─────────────────────────────────────────────────────────────────────────────
// CRON: Avisos diarios core ("hoy toca medicación" / "hoy toca turno")
// ─────────────────────────────────────────────────────────────────────────────
exports.sendDailyCareSummary = functions.pubsub
    .schedule("every 3 hours")
    .onRun(async () => {
    const now = new Date();
    const usersSnap = await db.collection("users").get();
    if (usersSnap.empty)
        return null;
    const sends = [];
    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const settings = await getUserSettings(userId);
        if (settings.enabled === false)
            continue;
        const appointmentsEnabled = settings.appointments !== false;
        const medicationsEnabled = settings.medications !== false;
        if (!appointmentsEnabled && !medicationsEnabled)
            continue;
        let timezone = typeof userData.timezone === "string" && userData.timezone.trim()
            ? userData.timezone.trim()
            : "";
        if (!timezone) {
            const tokenData = await getUserTokenAndTimezone(userId);
            timezone = tokenData.timezone || "UTC";
        }
        const localHour = Number(new Intl.DateTimeFormat("en-GB", {
            timeZone: timezone,
            hour: "2-digit",
            hour12: false,
        }).format(now));
        // Ventana de envío diaria: mañana.
        if (localHour < 7 || localHour > 10)
            continue;
        const { token } = await getUserTokenAndTimezone(userId);
        if (!token)
            continue;
        const todayKey = toDateKeyInTimezone(now, timezone);
        if (appointmentsEnabled) {
            const appointmentsSnap = await db.collection("appointments").where("userId", "==", userId).get();
            const appointmentsToday = appointmentsSnap.docs
                .map((d) => (Object.assign({ id: d.id }, d.data())))
                .filter((a) => (a.status || "upcoming") === "upcoming" && (a.date || "") === todayKey);
            for (const appointment of appointmentsToday) {
                const logId = `daily_turno_${appointment.id}_${todayKey}`;
                const logRef = db.collection("daily_notification_logs").doc(logId);
                const logSnap = await logRef.get();
                if (logSnap.exists)
                    continue;
                const title = `📌 Hoy toca turno — ${appointment.petName || "tu mascota"}`;
                const body = `${appointment.title || "Consulta"}${appointment.time ? ` a las ${appointment.time}` : ""}`;
                sends.push(sendPushMessage({
                    token,
                    title,
                    body,
                    type: "appointment",
                    petId: appointment.petId,
                    petName: appointment.petName,
                    sourceEventId: appointment.sourceEventId || appointment.id,
                }).then(() => logRef.set({ userId, kind: "appointment", petId: appointment.petId || "", date: todayKey, sentAt: now.toISOString() })));
            }
        }
        if (medicationsEnabled) {
            const medsSnap = await db.collection("medications").where("userId", "==", userId).get();
            const activeByPet = new Map();
            for (const medDoc of medsSnap.docs) {
                const med = medDoc.data();
                if (med.active === false)
                    continue;
                const startKey = parseYmdOrIsoToDateKey(med.startDate, timezone);
                const endKey = parseYmdOrIsoToDateKey(med.endDate, timezone);
                const isActiveToday = startKey && startKey <= todayKey && (!endKey || endKey >= todayKey);
                if (!isActiveToday)
                    continue;
                const petId = med.petId || "unknown_pet";
                const existing = activeByPet.get(petId);
                const resolvedName = med.petName || (await resolvePetName(petId));
                activeByPet.set(petId, {
                    petName: resolvedName || (existing === null || existing === void 0 ? void 0 : existing.petName) || "tu mascota",
                    count: ((existing === null || existing === void 0 ? void 0 : existing.count) || 0) + 1,
                });
            }
            for (const [petId, info] of activeByPet.entries()) {
                const logId = `daily_med_${userId}_${petId}_${todayKey}`;
                const logRef = db.collection("daily_notification_logs").doc(logId);
                const logSnap = await logRef.get();
                if (logSnap.exists)
                    continue;
                const title = `💊 Hoy toca medicación — ${info.petName}`;
                const body = info.count === 1
                    ? "Tenés 1 tratamiento activo para hoy."
                    : `Tenés ${info.count} tratamientos activos para hoy.`;
                sends.push(sendPushMessage({
                    token,
                    title,
                    body,
                    type: "medication",
                    petId,
                    petName: info.petName,
                }).then(() => logRef.set({ userId, kind: "medication", petId, date: todayKey, sentAt: now.toISOString() })));
            }
        }
    }
    const results = await Promise.allSettled(sends);
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
        console.error(`[DAILY] ${failed.length} envíos diarios fallaron`);
    }
    return null;
});
// ─────────────────────────────────────────────────────────────────────────────
// CRON: campañas push masivas
// Cargar en Firestore (colección "broadcast_push_campaigns") un doc con:
// {
//   active: true,
//   sent: false,
//   sendAt: "<ISO>",
//   title: "Activá notificaciones en PESSY",
//   body: "Entrá a Perfil > Notificaciones y activalas para recibir recordatorios.",
//   data: { cta: "open_notifications_settings" }
// }
// ─────────────────────────────────────────────────────────────────────────────
exports.sendBroadcastPushCampaigns = functions.pubsub
    .schedule("every 15 minutes")
    .onRun(async () => {
    const nowIso = new Date().toISOString();
    const campaignsSnap = await db
        .collection("broadcast_push_campaigns")
        .where("active", "==", true)
        .where("sent", "==", false)
        .where("sendAt", "<=", nowIso)
        .get();
    if (campaignsSnap.empty) {
        return null;
    }
    const tokenDocs = await db.collectionGroup("fcm_tokens").get();
    const tokenEntries = [];
    const seenTokens = new Set();
    for (const tokenDoc of tokenDocs.docs) {
        const data = tokenDoc.data();
        const token = typeof data.token === "string" ? data.token.trim() : "";
        if (!token || seenTokens.has(token))
            continue;
        seenTokens.add(token);
        tokenEntries.push({
            token,
            ref: tokenDoc.ref,
            platform: typeof data.platform === "string" ? data.platform : "web",
        });
    }
    if (tokenEntries.length === 0) {
        await Promise.all(campaignsSnap.docs.map((doc) => doc.ref.update({
            sent: true,
            sentAt: nowIso,
            totalTokens: 0,
            successCount: 0,
            failureCount: 0,
            invalidTokenCount: 0,
            warning: "no_tokens",
        })));
        return null;
    }
    for (const campaignDoc of campaignsSnap.docs) {
        const campaign = campaignDoc.data();
        const title = campaign.title || "PESSY";
        const body = campaign.body || "";
        const extraData = toStringDataRecord(campaign.data || {});
        const audience = campaign.audience || "all";
        const selectedTokens = tokenEntries
            .filter((entry) => {
            if (audience === "all")
                return true;
            return entry.platform === audience;
        })
            .map((entry) => entry.token);
        if (selectedTokens.length === 0) {
            await campaignDoc.ref.update({
                sent: true,
                sentAt: nowIso,
                totalTokens: 0,
                successCount: 0,
                failureCount: 0,
                invalidTokenCount: 0,
                warning: "no_tokens_for_audience",
            });
            continue;
        }
        const tokenChunks = chunkItems(selectedTokens, 500);
        let successCount = 0;
        let failureCount = 0;
        const invalidTokens = new Set();
        for (const tokenChunk of tokenChunks) {
            const response = await messaging.sendEachForMulticast({
                tokens: tokenChunk,
                notification: { title, body },
                data: Object.assign({ campaignId: campaignDoc.id, type: "broadcast" }, extraData),
                android: {
                    priority: "high",
                    notification: {
                        channelId: "pessy_reminders",
                        priority: "high",
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
                    },
                },
            });
            successCount += response.successCount;
            failureCount += response.failureCount;
            response.responses.forEach((sendResponse, idx) => {
                var _a;
                if (sendResponse.success)
                    return;
                const code = ((_a = sendResponse.error) === null || _a === void 0 ? void 0 : _a.code) || "";
                if (code === "messaging/registration-token-not-registered" ||
                    code === "messaging/invalid-registration-token") {
                    invalidTokens.add(tokenChunk[idx]);
                }
            });
        }
        if (invalidTokens.size > 0) {
            const invalidRefs = tokenEntries
                .filter((entry) => invalidTokens.has(entry.token))
                .map((entry) => entry.ref);
            await Promise.all(invalidRefs.map((ref) => ref.delete()));
        }
        await campaignDoc.ref.update({
            sent: true,
            sentAt: nowIso,
            totalTokens: selectedTokens.length,
            successCount,
            failureCount,
            invalidTokenCount: invalidTokens.size,
        });
    }
    return null;
});
// ─────────────────────────────────────────────────────────────────────────────
// CRON: Recordatorio de consentimiento Gmail Sync (Día 1, 2, 3 + auto-cierre en día 4)
// - Usuarios sin Gmail Sync conectado
// - Envío por push si hay token activo
// ─────────────────────────────────────────────────────────────────────────────
// [GMAIL-EXTRACTION-DISABLED]
const sendGmailSyncConsentReminders_DISABLED = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();
    const usersSnap = await db.collection("users").get();
    if (usersSnap.empty) {
        console.log("[GMAIL_CONSENT_REMINDER] No hay usuarios para revisar.");
        return null;
    }
    let sent = 0;
    let skippedConnected = 0;
    let skippedNotDue = 0;
    let skippedNoToken = 0;
    let autoAccepted = 0;
    let failed = 0;
    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const gmailSync = asRecord(userData.gmailSync);
        const reminderMeta = asRecord(userData.gmailSyncReminder);
        const connected = gmailSync.connected === true;
        if (connected) {
            skippedConnected += 1;
            continue;
        }
        const status = typeof reminderMeta.status === "string" ? reminderMeta.status : "pending_permission";
        if (status === "auto-accepted") {
            skippedNotDue += 1;
            continue;
        }
        const anchorMs = parseIsoToMs(gmailSync.consentRequestedAt) ||
            parseIsoToMs(reminderMeta.consentRequestedAt) ||
            parseIsoToMs(userData.createdAt) ||
            nowMs;
        const daysElapsed = Math.floor((nowMs - anchorMs) / ONE_DAY_MS);
        const dayNumberRaw = Number(reminderMeta.dayNumber);
        const dayNumber = Number.isFinite(dayNumberRaw) && dayNumberRaw > 0 ? Math.floor(dayNumberRaw) : 0;
        if (daysElapsed >= GMAIL_SYNC_AUTO_ACCEPT_DAY) {
            await userDoc.ref.set({
                gmailSyncReminder: {
                    status: "auto-accepted",
                    dayNumber: GMAIL_SYNC_REMINDER_LAST_DAY,
                    autoAcceptedAt: nowIso,
                    updatedAt: nowIso,
                    lastError: null,
                },
            }, { merge: true });
            autoAccepted += 1;
            continue;
        }
        const nextDayNumber = dayNumber + 1;
        const isDue = nextDayNumber >= 1 &&
            nextDayNumber <= GMAIL_SYNC_REMINDER_LAST_DAY &&
            daysElapsed >= nextDayNumber;
        if (!isDue) {
            skippedNotDue += 1;
            continue;
        }
        const { token } = await getUserTokenAndTimezone(userId);
        if (!token) {
            skippedNoToken += 1;
            continue;
        }
        try {
            const copy = getGmailReminderCopy(nextDayNumber);
            await sendPushMessage({
                token,
                title: copy.title,
                body: copy.body,
                type: "results",
            });
            await userDoc.ref.set({
                gmailSync: {
                    consentRequestedAt: typeof gmailSync.consentRequestedAt === "string"
                        ? gmailSync.consentRequestedAt
                        : nowIso,
                    updatedAt: nowIso,
                },
                gmailSyncReminder: {
                    lastPushSentAt: nowIso,
                    sentCount: Number(reminderMeta.sentCount || 0) + 1,
                    dayNumber: nextDayNumber,
                    updatedAt: nowIso,
                    status: `day_${nextDayNumber}_sent`,
                    lastError: null,
                },
            }, { merge: true });
            sent += 1;
        }
        catch (error) {
            failed += 1;
            console.error(`[GMAIL_CONSENT_REMINDER] Error user=${userId}`, error);
            await userDoc.ref.set({
                gmailSyncReminder: {
                    updatedAt: nowIso,
                    status: `day_${nextDayNumber}_failed`,
                    lastError: String(error).slice(0, 300),
                },
            }, { merge: true });
        }
    }
    console.log(`[GMAIL_CONSENT_REMINDER] sent=${sent} connected=${skippedConnected} not_due=${skippedNotDue} noToken=${skippedNoToken} autoAccepted=${autoAccepted} failed=${failed}`);
    return null;
});
// ─────────────────────────────────────────────────────────────────────────────
// CRON: Reconciliación de tratamientos existentes
// - Completa frecuencia/fin usando el documento médico fuente cuando falta.
// - Si no alcanza la info, crea pendiente y avisa al usuario.
// ─────────────────────────────────────────────────────────────────────────────
exports.reconcileExistingTreatments = functions.pubsub
    .schedule("every 12 hours")
    .onRun(async () => {
    var _a, _b;
    const now = new Date();
    const nowIso = now.toISOString();
    const medsSnap = await db
        .collection("medications")
        .where("active", "==", true)
        .get();
    if (medsSnap.empty)
        return null;
    let patched = 0;
    let reviewQueued = 0;
    let notified = 0;
    for (const medDoc of medsSnap.docs) {
        const med = medDoc.data();
        const userId = med.userId || "";
        const petId = med.petId || "";
        if (!userId || !petId)
            continue;
        const hasFrequency = typeof med.frequency === "string" && med.frequency.trim().length > 0;
        const hasEndDate = typeof med.endDate === "string" && med.endDate.trim().length > 0;
        if (hasFrequency && (hasEndDate || isChronicMarker(med.frequency)))
            continue;
        let nextFrequency = hasFrequency ? String(med.frequency) : "";
        let nextEndDate = hasEndDate ? String(med.endDate) : null;
        const sourceEventId = med.generatedFromEventId || "";
        if (sourceEventId) {
            const eventSnap = await db.collection("medical_events").doc(sourceEventId).get();
            if (eventSnap.exists) {
                const event = eventSnap.data();
                const extracted = (event.extractedData || {});
                const medsExtracted = Array.isArray(extracted.medications) ? extracted.medications : [];
                const targetName = normalizeMedicationName(med.name);
                const matched = medsExtracted.find((item) => normalizeMedicationName(item === null || item === void 0 ? void 0 : item.name) === targetName)
                    || medsExtracted[0];
                if (matched) {
                    if (!hasFrequency && typeof matched.frequency === "string" && matched.frequency.trim()) {
                        nextFrequency = matched.frequency.trim();
                    }
                    if (!hasEndDate && !isChronicMarker(nextFrequency)) {
                        const startDate = (typeof med.startDate === "string" && med.startDate.trim())
                            ? med.startDate
                            : (typeof extracted.eventDate === "string" && extracted.eventDate.trim())
                                ? extracted.eventDate
                                : (typeof event.createdAt === "string" ? event.createdAt : nowIso);
                        const inferredEndDate = parseDurationToEndDate(matched.duration, startDate);
                        if (inferredEndDate) {
                            nextEndDate = inferredEndDate;
                        }
                    }
                }
            }
        }
        const patch = {};
        if (!hasFrequency && nextFrequency)
            patch.frequency = nextFrequency;
        if (!hasEndDate && nextEndDate)
            patch.endDate = nextEndDate;
        if (Object.keys(patch).length > 0) {
            patch.updatedAt = nowIso;
            patch.metadataReconciledAt = nowIso;
            await medDoc.ref.update(patch);
            patched += 1;
        }
        const resolvedFrequency = (_a = patch.frequency) !== null && _a !== void 0 ? _a : med.frequency;
        const resolvedEndDate = (_b = patch.endDate) !== null && _b !== void 0 ? _b : med.endDate;
        const stillMissingFrequency = !(typeof resolvedFrequency === "string" && String(resolvedFrequency).trim());
        const stillMissingEnd = !isChronicMarker(String(resolvedFrequency || "")) &&
            !(typeof resolvedEndDate === "string" && String(resolvedEndDate).trim());
        if (!stillMissingFrequency && !stillMissingEnd)
            continue;
        const pendingId = `med_review_${medDoc.id}`;
        const pendingRef = db.collection("pending_actions").doc(pendingId);
        const pendingSnap = await pendingRef.get();
        if (!pendingSnap.exists) {
            await pendingRef.set({
                petId,
                userId,
                type: "follow_up",
                title: `Completar tratamiento: ${med.name || "Medicacion"}`,
                subtitle: "Falta confirmar frecuencia o duracion para recordatorios precisos.",
                dueDate: nowIso,
                createdAt: nowIso,
                generatedFromEventId: sourceEventId || null,
                autoGenerated: true,
                completed: false,
                completedAt: null,
                reminderEnabled: true,
                reminderDaysBefore: 0,
            });
            reviewQueued += 1;
        }
        const { token, timezone } = await getUserTokenAndTimezone(userId);
        const settings = await getUserSettings(userId);
        if (!token || !isTypeEnabled(settings, "medication"))
            continue;
        const dateKey = toDateKeyInTimezone(now, timezone);
        const notifyLogId = `med_reconcile_prompt_${medDoc.id}_${dateKey}`;
        const notifyLogRef = db.collection("daily_notification_logs").doc(notifyLogId);
        const notifyLogSnap = await notifyLogRef.get();
        if (notifyLogSnap.exists)
            continue;
        await sendPushMessage({
            token,
            title: `📝 Revisá un tratamiento de ${await resolvePetName(petId)}`,
            body: "Falta confirmar frecuencia o duración para activar recordatorios correctos.",
            type: "medication",
            petId,
            petName: await resolvePetName(petId),
            sourceEventId: sourceEventId || medDoc.id,
        });
        await notifyLogRef.set({
            userId,
            kind: "medication_reconcile",
            petId,
            medicationId: medDoc.id,
            date: dateKey,
            sentAt: nowIso,
        });
        notified += 1;
    }
    console.log(`[RECONCILE] patched=${patched} reviewQueued=${reviewQueued} notified=${notified}`);
    return null;
});
// ─────────────────────────────────────────────────────────────────────────────
// CRON: Recalcula alertas clínicas persistentes desde entidades consolidadas
// - No relee PDFs
// - Reevalúa R1/R2/R3/R4 una vez por día
// ─────────────────────────────────────────────────────────────────────────────
exports.recomputeClinicalAlertsDaily = functions.pubsub
    .schedule("every 48 hours")
    .onRun(async () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const nowTs = now.getTime();
    const recentWindowMs = 120 * 24 * 3600000;
    const followupWindowMs = 45 * 24 * 3600000;
    const treatmentFollowupGapMs = 45 * 24 * 3600000;
    const [petsSnap, conditionsSnap, treatmentsSnap, appointmentsSnap, eventsSnap, activeAlertsSnap] = await Promise.all([
        db.collection("pets").get(),
        db.collection("clinical_conditions").get(),
        db.collection("treatments").get(),
        db.collection("appointments").get(),
        db.collection("medical_events").get(),
        db.collection("clinical_alerts").where("status", "==", "active").get(),
    ]);
    if (petsSnap.empty)
        return null;
    const petIds = new Set(petsSnap.docs.map((docSnap) => docSnap.id));
    const conditionsByPet = new Map();
    conditionsSnap.docs.forEach((docSnap) => {
        const row = Object.assign({ id: docSnap.id }, docSnap.data());
        if (!row.petId)
            return;
        const list = conditionsByPet.get(row.petId) || [];
        list.push(row);
        conditionsByPet.set(row.petId, list);
        petIds.add(row.petId);
    });
    const treatmentsByPet = new Map();
    treatmentsSnap.docs.forEach((docSnap) => {
        const row = Object.assign({ id: docSnap.id }, docSnap.data());
        if (!row.petId)
            return;
        const list = treatmentsByPet.get(row.petId) || [];
        list.push(row);
        treatmentsByPet.set(row.petId, list);
        petIds.add(row.petId);
    });
    const appointmentsByPet = new Map();
    appointmentsSnap.docs.forEach((docSnap) => {
        const row = Object.assign({ id: docSnap.id }, docSnap.data());
        if (!row.petId)
            return;
        const list = appointmentsByPet.get(row.petId) || [];
        list.push(row);
        appointmentsByPet.set(row.petId, list);
        petIds.add(row.petId);
    });
    const eventsByPet = new Map();
    eventsSnap.docs.forEach((docSnap) => {
        const row = Object.assign({ id: docSnap.id }, docSnap.data());
        const petId = typeof row.petId === "string" ? row.petId : "";
        if (!petId)
            return;
        const list = eventsByPet.get(petId) || [];
        list.push(row);
        eventsByPet.set(petId, list);
        petIds.add(petId);
    });
    const activeAlertsByPet = new Map();
    activeAlertsSnap.docs.forEach((docSnap) => {
        const row = Object.assign({ id: docSnap.id }, docSnap.data());
        if (!row.petId)
            return;
        const list = activeAlertsByPet.get(row.petId) || [];
        list.push(row);
        activeAlertsByPet.set(row.petId, list);
        petIds.add(row.petId);
    });
    let upserted = 0;
    let resolved = 0;
    for (const petId of petIds) {
        const petConditions = conditionsByPet.get(petId) || [];
        const petTreatments = treatmentsByPet.get(petId) || [];
        const petAppointments = appointmentsByPet.get(petId) || [];
        const petEvents = eventsByPet.get(petId) || [];
        const petActiveAlerts = activeAlertsByPet.get(petId) || [];
        // R1: laboratorio fuera de rango (solo con eventos lab/clinical)
        const latestLabEvent = [...petEvents]
            .filter((event) => LAB_LIKE_DOCUMENT_TYPES.has(getEventDocumentType(event)))
            .sort((a, b) => parseEventTimestamp(b) - parseEventTimestamp(a))[0];
        const currentOutOfRangeAlertIds = new Set();
        const abnormalFindings = latestLabEvent ? extractAbnormalFindings(latestLabEvent) : [];
        if (abnormalFindings.length > 0) {
            for (const finding of abnormalFindings) {
                const alertId = buildAlertId(petId, "R1_out_of_range", finding.parameter);
                currentOutOfRangeAlertIds.add(alertId);
                await upsertClinicalAlert({
                    id: alertId,
                    petId,
                    type: "out_of_range",
                    severity: "medium",
                    title: `Valor fuera de rango: ${finding.parameter}`,
                    description: `${finding.parameter} reportado como ${finding.status}. Revisar seguimiento clínico.`,
                    triggeredOn: nowIso,
                    lastSeenOn: nowIso,
                    status: "active",
                    resolutionNotes: null,
                    linkedConditionIds: [],
                    linkedEventIds: (latestLabEvent === null || latestLabEvent === void 0 ? void 0 : latestLabEvent.id) ? [String(latestLabEvent.id)] : [],
                    linkedAppointmentIds: [],
                    ruleId: "R1_out_of_range",
                });
                upserted += 1;
            }
        }
        for (const alert of petActiveAlerts) {
            if (alert.type !== "out_of_range")
                continue;
            if (currentOutOfRangeAlertIds.has(alert.id))
                continue;
            await resolveClinicalAlert(alert.id, "No persiste hallazgo alterado en el último control de laboratorio.", nowIso);
            resolved += 1;
        }
        // R2: condición persistente
        for (const condition of petConditions) {
            const occurrences = Number(condition.occurrencesCount || 0);
            const lastSeenTs = Date.parse(condition.lastDetectedDate || "");
            const recentEnough = !Number.isNaN(lastSeenTs) && nowTs - lastSeenTs <= recentWindowMs;
            const conditionScope = condition.normalizedName || condition.id;
            const alertId = buildAlertId(petId, "R2_condition_persistent", conditionScope);
            const isPersistent = occurrences >= 2 && recentEnough;
            if (isPersistent) {
                await upsertClinicalAlert({
                    id: alertId,
                    petId,
                    type: "condition_persistent",
                    severity: condition.pattern === "chronic" ? "high" : "medium",
                    title: `Condición persistente: ${condition.normalizedName || "sin nombre"}`,
                    description: `Detectada ${occurrences} veces entre ${condition.firstDetectedDate || "—"} y ${condition.lastDetectedDate || "—"}.`,
                    triggeredOn: nowIso,
                    lastSeenOn: nowIso,
                    status: "active",
                    resolutionNotes: null,
                    linkedConditionIds: [condition.id],
                    linkedEventIds: [],
                    linkedAppointmentIds: [],
                    ruleId: "R2_condition_persistent",
                });
                upserted += 1;
            }
            else {
                await resolveClinicalAlert(alertId, "No cumple criterio actual de persistencia clínica.", nowIso);
                resolved += 1;
            }
        }
        // R3: seguimiento recomendado sin turno futuro
        const followupEvents = petEvents.filter((event) => {
            const eventTs = parseEventTimestamp(event);
            if (eventTs <= 0 || nowTs - eventTs > recentWindowMs)
                return false;
            return extractRecommendations(event).some(hasFollowupKeyword);
        });
        const hasUpcomingAppointment = petAppointments.some((appointment) => {
            const status = (appointment.status || "").toLowerCase();
            if (status && status !== "upcoming" && status !== "programado" && status !== "confirmado")
                return false;
            if (!appointment.date)
                return false;
            const appointmentTs = Date.parse(`${appointment.date}T${appointment.time || "00:00"}:00`);
            if (Number.isNaN(appointmentTs))
                return false;
            return appointmentTs >= nowTs && appointmentTs <= nowTs + followupWindowMs;
        });
        const followupAlertId = buildAlertId(petId, "R3_followup_not_scheduled", "pet_followup");
        if (followupEvents.length > 0 && !hasUpcomingAppointment) {
            const linkedEventIds = followupEvents
                .map((event) => (typeof event.id === "string" ? event.id : ""))
                .filter(Boolean);
            await upsertClinicalAlert({
                id: followupAlertId,
                petId,
                type: "followup_not_scheduled",
                severity: "medium",
                title: "Seguimiento recomendado sin turno agendado",
                description: "Hay recomendación de control sin cita futura dentro de la ventana sugerida.",
                triggeredOn: nowIso,
                lastSeenOn: nowIso,
                status: "active",
                resolutionNotes: null,
                linkedConditionIds: [],
                linkedEventIds,
                linkedAppointmentIds: [],
                ruleId: "R3_followup_not_scheduled",
            });
            upserted += 1;
        }
        else {
            await resolveClinicalAlert(followupAlertId, "Seguimiento clínico cubierto por turno futuro o sin recomendación vigente.", nowIso);
            resolved += 1;
        }
        // R4: tratamiento activo sin seguimiento reciente
        const latestEventTs = Math.max(...petEvents.map((event) => parseEventTimestamp(event)), 0);
        const activeTreatments = petTreatments.filter((treatment) => (treatment.status || "").toLowerCase() === "active");
        for (const treatment of activeTreatments) {
            const scope = treatment.normalizedName || treatment.id;
            const alertId = buildAlertId(petId, "R4_treatment_no_followup", scope);
            const stale = latestEventTs <= 0 || nowTs - latestEventTs > treatmentFollowupGapMs;
            if (stale) {
                await upsertClinicalAlert({
                    id: alertId,
                    petId,
                    type: "treatment_no_followup",
                    severity: "medium",
                    title: `Tratamiento activo sin seguimiento: ${treatment.normalizedName || "sin nombre"}`,
                    description: "No hay eventos clínicos recientes para validar evolución del tratamiento activo.",
                    triggeredOn: nowIso,
                    lastSeenOn: nowIso,
                    status: "active",
                    resolutionNotes: null,
                    linkedConditionIds: treatment.linkedConditionIds || [],
                    linkedEventIds: [],
                    linkedAppointmentIds: [],
                    ruleId: "R4_treatment_no_followup",
                });
                upserted += 1;
            }
            else {
                await resolveClinicalAlert(alertId, "Se detectó seguimiento clínico reciente.", nowIso);
                resolved += 1;
            }
        }
    }
    console.log(`[CLINICAL_ALERTS_DAILY] upserted=${upserted} resolved=${resolved} pets=${petIds.size}`);
    return null;
});
// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP: Borra notificaciones enviadas con más de 7 días
// ─────────────────────────────────────────────────────────────────────────────
exports.cleanupOldNotifications = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async () => {
    const cutoff = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
    const old = await db
        .collection("scheduled_notifications")
        .where("sent", "==", true)
        .where("sentAt", "<=", cutoff)
        .get();
    if (!old.empty) {
        const batch = db.batch();
        old.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`[CLEANUP] Borradas ${old.size} notificaciones viejas`);
    }
    const dailyOld = await db
        .collection("daily_notification_logs")
        .where("sentAt", "<=", cutoff)
        .get();
    if (!dailyOld.empty) {
        const batch = db.batch();
        dailyOld.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`[CLEANUP] Borrados ${dailyOld.size} logs diarios`);
    }
    return null;
});
// ─────────────────────────────────────────────────────────────────────────────
// ANALISIS IA (BACKEND-ONLY): evita exponer API keys en frontend
// ─────────────────────────────────────────────────────────────────────────────
const ANALYSIS_PROMPT_TEMPLATE = `Sos el motor de extracción clínica de PESSY.
Fecha de hoy: __TODAY__

PESSY CLINICAL PROCESSING PROTOCOL

FASE 0 — CLASIFICACIÓN OBLIGATORIA
Clasificá primero el documento en UNA categoría:
- clinical_report
- laboratory_result
- prescription
- medical_study
- medical_appointment
- vaccination_record
- other

Reglas críticas:
- Si detectás fecha futura + hora + especialidad o términos de turno (turno, confirmado, centro de atención, consulta), tratar como medical_appointment.
- Si es medical_appointment, NO generar diagnósticos ni hallazgos clínicos.
- No inventar datos faltantes.
- NUNCA inferir tratamientos o medicamentos a partir de volúmenes, diámetros o medidas anatómicas.
- Si no hay nombre de fármaco explícito, "treatments_detected" debe quedar vacío.
- NUNCA convertir texto histórico, calendarios o referencias informativas antiguas en tratamiento activo.
- NUNCA esconder hallazgos o diagnósticos en texto libre: deben ir en "diagnoses_detected", "abnormal_findings" o "imaging_findings". Si no encajan con seguridad, devolver null.

FASE 0.5 — LECTURA CLÍNICA OBLIGATORIA (informes cualitativos: KOH, tricograma, citología, raspado)
1) Identificá estudio solicitado y técnica.
2) Extraé resultado principal literal (ej. "no se observaron...", "compatible con...", "positivo/negativo").
3) Diferenciá explícitamente:
   - qué descarta en esta muestra,
   - qué NO descarta de forma global.
4) Capturá limitaciones/disclaimers del informe (ej. "su ausencia no es excluyente").
5) Listá observaciones secundarias separadas del resultado principal.
6) Traducí términos técnicos en lenguaje simple dentro de recomendaciones.

FASE 1 — EXTRACCIÓN ESTRUCTURADA
Analizá el documento completo en modo multimodal y devolvé SOLO JSON válido:
{
  "pet": {
    "name": "string|null",
    "species": "string|null",
    "breed": "string|null",
    "age_at_study": "string|null",
    "owner": "string|null"
  },
  "document": {
    "type": "radiografia|ecografia|laboratorio|receta|informe|otro",
    "study_date": "YYYY-MM-DD|null",
    "clinic_name": "string|null",
    "clinic_address": "string|null",
    "veterinarian_name": "string|null",
    "veterinarian_license": "string|null",
    "protocol_or_record_number": "string|null"
  },
  "diagnoses_detected": [
    {
      "condition_name": "string|null",
      "organ_system": "string|null",
      "status": "nuevo|recurrente|persistente|null",
      "severity": "leve|moderado|severo|no_especificado|null"
    }
  ],
  "abnormal_findings": [
    {
      "parameter": "string|null",
      "value": "string|null",
      "reference_range": "string|null",
      "interpretation": "alto|bajo|alterado|normal|no_observado|inconcluso|null"
    }
  ],
  "imaging_findings": [
    {
      "region": "torax|abdomen|pelvis|columna|cadera|otro|null",
      "view": "ventrodorsal|lateral|dorsoventral|oblicua|otro|null",
      "finding": "string|null",
      "severity": "leve|moderado|severo|no_especificado|null"
    }
  ],
  "treatments_detected": [
    {
      "treatment_name": "string|null",
      "start_date": "YYYY-MM-DD|null",
      "end_date": "YYYY-MM-DD|null",
      "dosage": "string|null",
      "status": "activo|finalizado|desconocido|null"
    }
  ],
  "medical_recommendations": ["string"],
  "requires_followup": true
}

Opcional para documentos de turno:
{
  "appointment_event": {
    "event_type": "medical_appointment",
    "date": "YYYY-MM-DD|null",
    "time": "HH:MM|null",
    "specialty": "string|null",
    "procedure": "string|null",
    "clinic": "string|null",
    "address": "string|null",
    "professional_name": "string|null",
    "preparation_required": "string|null",
    "status": "scheduled|programado|confirmado|recordatorio|null"
  }
}

Opcional para certificados/carnets de vacunación:
{
  "vaccine_artifacts": {
    "sticker_detected": true,
    "stamp_detected": true,
    "signature_detected": true,
    "product_name": "string|null",
    "manufacturer": "string|null",
    "lot_number": "string|null",
    "serial_number": "string|null",
    "expiry_date": "YYYY-MM-DD|null",
    "application_date": "YYYY-MM-DD|null",
    "revaccination_date": "YYYY-MM-DD|null"
  }
}

FASE 2 — NORMALIZACIÓN
- Fechas en ISO YYYY-MM-DD.
- Unificar patologías equivalentes.
- Estandarizar órgano/sistema cuando esté explícito.

Reglas:
- Si un campo no está presente: null.
- No inventar información.
- No devolver texto fuera del JSON.
- No exceder 6 elementos por lista.
- Ignorar fecha de impresión y priorizar fecha clínica principal.
- Si el documento es turno, no completar diagnósticos ni hallazgos clínicos.
- En estudios cualitativos, usar "abnormal_findings.value" con literal clínico (ej. "no se observaron estructuras compatibles...").
- Si aparece "ausencia no excluyente" o equivalente, incluirlo textualmente en "medical_recommendations".
- Si el documento es por imágenes (radiografía/ecografía/ECG), completar "imaging_findings" con región, vista/proyección y hallazgo.
- Para radiografía, mapear abreviaturas de proyección cuando aparezcan (VD, DV, LL) a "view".
- Priorizar recomendaciones con prefijos:
  1) "Resultado principal: ..."
  2) "No descarta: ..." (si aplica)
  3) "Limitación: ..." (si aplica)
  4) "Siguiente paso: ..." (si aplica).
- Si hay troquel/sello/firma visibles, registrarlo en "vaccine_artifacts".
- Si el troquel tiene lote o serie, priorizar esos valores como fuente de verdad sobre texto libre.`;
const ANALYSIS_PDF_MIME_ALIASES = new Set([
    "application/pdf",
    "application/x-pdf",
    "application/acrobat",
    "applications/vnd.pdf",
    "text/pdf",
]);
const ANALYSIS_IMAGE_MIME_NORMALIZATION = {
    "image/jpg": "image/jpeg",
    "image/pjpeg": "image/jpeg",
};
const ANALYSIS_OCTET_STREAM_MIME_TYPES = new Set([
    "",
    "application/octet-stream",
    "binary/octet-stream",
]);
const SUPPORTED_ANALYSIS_MIME_TYPES = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
]);
function inferMimeTypeFromFilename(fileName) {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith(".pdf"))
        return "application/pdf";
    if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg"))
        return "image/jpeg";
    if (lowerName.endsWith(".png"))
        return "image/png";
    if (lowerName.endsWith(".webp"))
        return "image/webp";
    if (lowerName.endsWith(".heic") || lowerName.endsWith(".heif"))
        return "image/heic";
    return "";
}
function inferMimeTypeFromBase64(base64) {
    const normalized = base64.trim().replace(/\s+/g, "");
    if (!normalized)
        return "";
    if (normalized.startsWith("JVBERi0"))
        return "application/pdf";
    if (normalized.startsWith("/9j/"))
        return "image/jpeg";
    if (normalized.startsWith("iVBORw0KGgo"))
        return "image/png";
    if (normalized.startsWith("UklGR"))
        return "image/webp";
    return "";
}
function normalizeAnalysisMimeType(args) {
    const raw = args.rawMimeType.toLowerCase().trim();
    if (ANALYSIS_PDF_MIME_ALIASES.has(raw))
        return "application/pdf";
    if (ANALYSIS_IMAGE_MIME_NORMALIZATION[raw])
        return ANALYSIS_IMAGE_MIME_NORMALIZATION[raw];
    if (!ANALYSIS_OCTET_STREAM_MIME_TYPES.has(raw))
        return raw;
    const fromFilename = inferMimeTypeFromFilename(args.fileName);
    if (fromFilename)
        return fromFilename;
    const fromBase64 = inferMimeTypeFromBase64(args.base64);
    if (fromBase64)
        return fromBase64;
    return raw || "application/octet-stream";
}
const getGeminiSettings = () => {
    const keyFromEnv = process.env.GEMINI_API_KEY || "";
    const modelFromEnv = process.env.ANALYSIS_MODEL || "";
    return {
        apiKey: keyFromEnv,
        model: modelFromEnv || "gemini-2.5-flash",
    };
};
async function callGeminiBackend(payload) {
    var _a, _b, _c, _d, _e, _f;
    const { apiKey, model } = getGeminiSettings();
    if (!apiKey) {
        throw new functions.https.HttpsError("failed-precondition", "GEMINI_API_KEY no configurada en backend.");
    }
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new functions.https.HttpsError("internal", `Gemini backend error (${response.status}): ${errorText.slice(0, 600)}`);
    }
    const data = await response.json();
    const rawText = ((_e = (_d = (_c = (_b = (_a = data === null || data === void 0 ? void 0 : data.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text) || "";
    const totalTokenCount = Number(((_f = data === null || data === void 0 ? void 0 : data.usageMetadata) === null || _f === void 0 ? void 0 : _f.totalTokenCount) || 0);
    return { rawText, totalTokenCount };
}
exports.analyzeDocument = functions
    .runWith({ secrets: ["GEMINI_API_KEY"] })
    .region("us-central1")
    .https.onCall(async (data, context) => {
    var _a;
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión para analizar documentos.");
    }
    if (!rateLimiter.perUser(context.auth.uid, 10, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests.");
    if (!rateLimiter.globalLimit("analyzeDocument", 100, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Service is busy.");
    const requestedMimeType = typeof (data === null || data === void 0 ? void 0 : data.mimeType) === "string" ? data.mimeType.trim() : "";
    const fileName = typeof (data === null || data === void 0 ? void 0 : data.fileName) === "string" ? data.fileName.trim().slice(0, 260) : "";
    const base64 = typeof (data === null || data === void 0 ? void 0 : data.base64) === "string" ? data.base64.trim() : "";
    const normalizedMimeType = normalizeAnalysisMimeType({
        rawMimeType: requestedMimeType,
        fileName,
        base64,
    });
    if (!base64) {
        throw new functions.https.HttpsError("invalid-argument", "Falta el contenido del archivo (base64).");
    }
    if (!SUPPORTED_ANALYSIS_MIME_TYPES.has(normalizedMimeType)) {
        throw new functions.https.HttpsError("invalid-argument", "Formato no compatible. Subí PDF, JPG, PNG o WEBP.");
    }
    // Base64 aproximado <= 8MB de binario
    const approxBytes = Math.floor((base64.length * 3) / 4);
    if (approxBytes > 8 * 1024 * 1024) {
        throw new functions.https.HttpsError("invalid-argument", "Documento demasiado grande para análisis en tiempo real.");
    }
    const today = new Date().toISOString().slice(0, 10);
    const contextHint = typeof (data === null || data === void 0 ? void 0 : data.contextHint) === "string" ? data.contextHint.slice(0, 1200) : "";
    const knowledgeContext = await (0, knowledgeBase_1.resolveClinicalKnowledgeContext)({
        query: [contextHint, fileName, normalizedMimeType, today].filter(Boolean).join(" "),
        maxSections: 7,
    });
    const prompt = `${ANALYSIS_PROMPT_TEMPLATE.replace("__TODAY__", today)}\n\n${knowledgeContext.contextText}`;
    const startedAt = Date.now();
    const { rawText, totalTokenCount } = await callGeminiBackend({
        contents: [
            {
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: normalizedMimeType,
                            data: base64,
                        },
                    },
                ],
            },
        ],
        generationConfig: {
            temperature: 0,
            topK: 1,
            topP: 1,
            responseMimeType: "application/json",
            maxOutputTokens: 2600,
            thinkingConfig: {
                thinkingBudget: 0,
            },
        },
    });
    const { model } = getGeminiSettings();
    return {
        rawText,
        model,
        tokensUsed: totalTokenCount,
        processingTimeMs: Date.now() - startedAt,
        resolvedMimeType: normalizedMimeType,
        knowledgeVersion: knowledgeContext.version,
        knowledgeSectionIds: knowledgeContext.sectionIds,
        knowledgeSource: knowledgeContext.source,
    };
});
exports.generateClinicalSummary = functions
    .runWith({ secrets: ["GEMINI_API_KEY"] })
    .region("us-central1")
    .https.onCall(async (data, context) => {
    var _a, _b;
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión para generar resúmenes.");
    }
    if (!rateLimiter.perUser(context.auth.uid, 10, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests.");
    if (!rateLimiter.globalLimit("generateClinicalSummary", 100, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Service is busy.");
    const prompt = typeof (data === null || data === void 0 ? void 0 : data.prompt) === "string" ? data.prompt.trim() : "";
    if (!prompt) {
        throw new functions.https.HttpsError("invalid-argument", "Falta prompt.");
    }
    if (prompt.length > 35000) {
        throw new functions.https.HttpsError("invalid-argument", "Prompt demasiado largo.");
    }
    const maxOutputTokens = Number((data === null || data === void 0 ? void 0 : data.maxOutputTokens) || 1200);
    const temperature = Number((_b = data === null || data === void 0 ? void 0 : data.temperature) !== null && _b !== void 0 ? _b : 0.1);
    const responseMimeType = typeof (data === null || data === void 0 ? void 0 : data.responseMimeType) === "string" && data.responseMimeType.trim()
        ? data.responseMimeType.trim()
        : undefined;
    const knowledgeContext = await (0, knowledgeBase_1.resolveClinicalKnowledgeContext)({
        query: prompt.slice(0, 6000),
        maxSections: 8,
    });
    const promptWithKnowledge = `${knowledgeContext.contextText}\n\nINSTRUCCION_CLINICA:\n${prompt}`;
    const startedAt = Date.now();
    const { rawText, totalTokenCount } = await callGeminiBackend({
        contents: [{ parts: [{ text: promptWithKnowledge }] }],
        generationConfig: Object.assign({ temperature, topK: 1, topP: 1, maxOutputTokens }, (responseMimeType ? { responseMimeType } : {})),
    });
    const { model } = getGeminiSettings();
    return {
        rawText,
        model,
        tokensUsed: totalTokenCount,
        processingTimeMs: Date.now() - startedAt,
        knowledgeVersion: knowledgeContext.version,
        knowledgeSectionIds: knowledgeContext.sectionIds,
        knowledgeSource: knowledgeContext.source,
    };
});
exports.resolveBrainPayload = functions
    .region("us-central1")
    .https.onCall(async (data, context) => {
    var _a, _b;
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión para resolver datos clínicos.");
    }
    if (!rateLimiter.perUser(context.auth.uid, 10, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests.");
    if (!rateLimiter.globalLimit("resolveBrainPayload", 100, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Service is busy.");
    const payload = asRecord(data === null || data === void 0 ? void 0 : data.brainOutput);
    const category = String(payload.category || "").trim();
    if (!category) {
        throw new functions.https.HttpsError("invalid-argument", "Falta brainOutput.category.");
    }
    const rawConfidence = Number((_b = payload.confidence) !== null && _b !== void 0 ? _b : 0);
    const confidence = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence;
    const entities = Array.isArray(payload.entities)
        ? payload.entities.map((item) => asRecord(item))
        : [];
    const sourceMetadata = asRecord(data === null || data === void 0 ? void 0 : data.sourceMetadata);
    // GOLDEN RULE: reviewThreshold removed — always uses hardcoded DEFAULT_REVIEW_THRESHOLD.
    const result = await (0, brainResolver_1.resolveBrainOutput)({
        userId: context.auth.uid,
        brainOutput: {
            schema_version: typeof payload.schema_version === "string" ? payload.schema_version : undefined,
            pet_reference: typeof payload.pet_reference === "string" ? payload.pet_reference : null,
            category,
            document_type: typeof payload.document_type === "string" ? payload.document_type : null,
            study_type: typeof payload.study_type === "string" ? payload.study_type : null,
            primary_finding: typeof payload.primary_finding === "string" ? payload.primary_finding : null,
            entities,
            confidence: Math.min(1, Math.max(0, confidence)),
            review_required: payload.review_required === true,
            reason_if_review_needed: typeof payload.reason_if_review_needed === "string" ? payload.reason_if_review_needed : null,
            semantic_flags: asRecord(payload.semantic_flags),
            ui_hint: asRecord(payload.ui_hint),
        },
        sourceMetadata: Object.assign({ source: typeof sourceMetadata.source === "string" ? sourceMetadata.source : "manual" }, sourceMetadata),
    });
    return Object.assign({ ok: true }, result);
});
// ---------------------------------------------------------------------------
// Co-tutor invite — genera magic link via Admin SDK + envía por Resend
// ---------------------------------------------------------------------------
exports.sendCoTutorInvite = functions
    .region("us-central1")
    .runWith({ secrets: ["RESEND_API_KEY"] })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Requiere sesión activa.");
    }
    if (!rateLimiter.perUser(context.auth.uid, 10, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests.");
    if (!rateLimiter.globalLimit("sendCoTutorInvite", 100, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Service is busy.");
    const toEmail = (data.email || "").trim().toLowerCase();
    const inviteCode = (data.inviteCode || "").trim().toUpperCase();
    const petName = (data.petName || "tu mascota").trim();
    const ownerUid = context.auth.uid;
    if (!toEmail || !toEmail.includes("@")) {
        throw new functions.https.HttpsError("invalid-argument", "Email inválido.");
    }
    if (!inviteCode) {
        throw new functions.https.HttpsError("invalid-argument", "Código de invitación requerido.");
    }
    // Validar que el código pertenece al dueño y a una mascota real
    const invRef = db.collection("invitations").doc(inviteCode);
    const invSnap = await invRef.get();
    if (!invSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Código de invitación no encontrado.");
    }
    const inv = invSnap.data();
    if (inv.createdBy !== ownerUid) {
        throw new functions.https.HttpsError("permission-denied", "No sos el dueño de este código.");
    }
    // Validar que el email del destinatario coincida con el del invite (si se especificó)
    const inviteEmail = (inv.inviteEmail || "").trim().toLowerCase();
    if (inviteEmail && inviteEmail !== toEmail) {
        throw new functions.https.HttpsError("invalid-argument", `Este código fue generado para ${inviteEmail}, no para ${toEmail}.`);
    }
    // Link directo a la app con el código — no usamos Firebase Auth magic link
    // porque manda un email genérico feo desde @firebaseapp.com
    const appUrl = "https://pessy.app";
    const magicLink = `${appUrl}/inicio?invite=${inviteCode}`;
    // Enviar por Resend (único email, branded)
    const resendKey = process.env.RESEND_API_KEY || "";
    if (!resendKey) {
        throw new functions.https.HttpsError("internal", "Servicio de email no configurado.");
    }
    const resend = new resend_1.Resend(resendKey);
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#ffffff;">
        <div style="background:#074738;border-radius:16px;padding:20px 24px;margin-bottom:24px;">
          <h1 style="color:white;margin:0;font-size:24px;font-weight:900;">🐾 PESSY</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">Invitación a co-tutor</p>
        </div>
        <h2 style="color:#1a1a2e;font-size:18px;margin:0 0 12px;">Te invitaron a cuidar a <strong>${petName}</strong></h2>
        <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 24px;">
          Hacé clic en el botón para unirte al equipo de <strong>${petName}</strong>. El enlace expira en 48 horas.
        </p>
        <a href="${magicLink}"
           style="display:inline-block;background:#074738;color:white;font-weight:900;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none;">
          Ser guardián de ${petName}
        </a>
        <p style="color:#aaa;font-size:12px;margin-top:24px;line-height:1.5;">
          Si no esperabas esta invitación, podés ignorar este mensaje.<br/>
          Este email fue enviado desde <a href="https://pessy.app" style="color:#074738;">pessy.app</a>
        </p>
      </div>
    `;
    const MAX_RETRIES = 3;
    let lastErr = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await resend.emails.send({
                from: "PESSY <noreply@pessy.app>",
                to: toEmail,
                subject: `Te invitaron a ser guardián de ${petName} en PESSY`,
                html,
            });
            console.log(`[COTUTORES] ✅ Invitación enviada`);
            lastErr = null;
            break;
        }
        catch (err) {
            lastErr = err;
            console.warn(`[COTUTORES] Intento ${attempt}/${MAX_RETRIES} falló para ${toEmail}:`, (err === null || err === void 0 ? void 0 : err.message) || err);
            if (attempt < MAX_RETRIES)
                await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
    }
    if (lastErr) {
        console.error("[COTUTORES] Error enviando email después de reintentos:", lastErr);
        throw new functions.https.HttpsError("internal", "No se pudo enviar el correo de invitación.");
    }
    return { ok: true };
});
exports.acceptCoTutorInvite = functions
    .region("us-central1")
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Requiere sesión activa.");
    }
    if (!rateLimiter.perUser(context.auth.uid, 10, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests.");
    if (!rateLimiter.globalLimit("acceptCoTutorInvite", 100, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Service is busy.");
    const authData = context.auth;
    const inviteCode = ((data === null || data === void 0 ? void 0 : data.code) || "").toString().trim().toUpperCase();
    if (!inviteCode) {
        throw new functions.https.HttpsError("invalid-argument", "Código de invitación requerido.");
    }
    const uid = authData.uid;
    const userEmail = (authData.token.email || "").toString().trim().toLowerCase();
    return db.runTransaction(async (tx) => {
        var _a, _b;
        const invRef = db.collection("invitations").doc(inviteCode);
        const invSnap = await tx.get(invRef);
        if (!invSnap.exists) {
            throw new functions.https.HttpsError("not-found", "Código inválido o expirado");
        }
        const inv = invSnap.data() || {};
        const inviteEmail = (inv.inviteEmail || "").toString().trim().toLowerCase();
        if (inviteEmail && inviteEmail !== userEmail) {
            throw new functions.https.HttpsError("permission-denied", "Este código fue emitido para otro correo.");
        }
        const accessRole = inv.accessRole === "viewer" ? "viewer" : "editor";
        const petRef = db.collection("pets").doc((inv.petId || "").toString());
        const petSnap = await tx.get(petRef);
        if (!petSnap.exists) {
            throw new functions.https.HttpsError("not-found", "La mascota de esta invitación ya no existe.");
        }
        const pet = petSnap.data() || {};
        if ((pet.ownerId || "").toString() === uid) {
            throw new functions.https.HttpsError("failed-precondition", "No podés unirte a tu propia mascota con un código");
        }
        const expiresAt = typeof ((_a = inv.expiresAt) === null || _a === void 0 ? void 0 : _a.toDate) === "function"
            ? inv.expiresAt.toDate()
            : inv.expiresAt
                ? new Date(inv.expiresAt)
                : null;
        if (!expiresAt || !Number.isFinite(expiresAt.getTime()) || expiresAt < new Date()) {
            throw new functions.https.HttpsError("failed-precondition", "El código expiró");
        }
        const petName = (inv.petName || pet.name || "la mascota").toString();
        const coTutorUids = Array.isArray(pet.coTutorUids)
            ? pet.coTutorUids.filter((value) => typeof value === "string")
            : [];
        const existingCoTutors = Array.isArray(pet.coTutors)
            ? pet.coTutors.filter((value) => value && typeof value === "object")
            : [];
        const sharedAccessByUid = pet.sharedAccessByUid && typeof pet.sharedAccessByUid === "object"
            ? Object.assign({}, pet.sharedAccessByUid) : {};
        if (inv.used === true) {
            if ((inv.usedBy || "").toString() !== uid) {
                throw new functions.https.HttpsError("failed-precondition", "Este código ya fue utilizado");
            }
            return {
                petId: petRef.id,
                petName,
                accessRole,
            };
        }
        const nextCoTutorUids = coTutorUids.includes(uid) ? coTutorUids : [...coTutorUids, uid];
        const nextCoTutors = existingCoTutors.filter((value) => (value === null || value === void 0 ? void 0 : value.uid) !== uid);
        nextCoTutors.push({
            uid,
            email: authData.token.email || "",
            name: authData.token.name || authData.token.email || "",
            addedAt: typeof ((_b = inv.createdAt) === null || _b === void 0 ? void 0 : _b.toDate) === "function"
                ? inv.createdAt.toDate().toISOString()
                : typeof inv.createdAt === "string"
                    ? inv.createdAt
                    : new Date().toISOString(),
            role: accessRole,
        });
        tx.update(petRef, {
            coTutors: nextCoTutors,
            coTutorUids: nextCoTutorUids,
            sharedAccessByUid: Object.assign(Object.assign({}, sharedAccessByUid), { [uid]: accessRole }),
            lastJoinInviteCode: inviteCode,
        });
        tx.update(invRef, {
            used: true,
            usedBy: uid,
            usedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            petId: petRef.id,
            petName,
            accessRole,
        };
    });
});
// ---------------------------------------------------------------------------
// Approve waitlist access request — generates token + sends welcome email
// ---------------------------------------------------------------------------
exports.approveAccessRequest = functions
    .region("us-central1")
    .runWith({ secrets: ["RESEND_API_KEY"] })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Requiere sesión activa.");
    }
    if (!rateLimiter.perUser(context.auth.uid, 10, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests.");
    if (!rateLimiter.globalLimit("approveAccessRequest", 100, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Service is busy.");
    const callerEmail = (context.auth.token.email || "").toLowerCase();
    if (callerEmail !== "mauriciogoitia@gmail.com") {
        throw new functions.https.HttpsError("permission-denied", "Solo admin puede aprobar.");
    }
    const requestId = (data.requestId || "").trim();
    if (!requestId) {
        throw new functions.https.HttpsError("invalid-argument", "requestId requerido.");
    }
    const firestore = admin.firestore();
    const docRef = firestore.collection("access_requests").doc(requestId);
    const snap = await docRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Solicitud no encontrada.");
    }
    const reqData = snap.data();
    if (reqData.status !== "pending") {
        throw new functions.https.HttpsError("failed-precondition", "Solicitud ya procesada.");
    }
    // Generate 8-char access token
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let accessToken = "";
    for (let i = 0; i < 8; i++) {
        accessToken += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000);
    await docRef.update({
        status: "approved",
        approvedAt: now,
        approvedBy: context.auth.uid,
        accessToken,
        accessTokenExpiresAt: expiresAt,
    });
    // Send approval email via Resend
    const RESEND_API_KEY_SECRET = process.env.RESEND_API_KEY;
    if (RESEND_API_KEY_SECRET) {
        const resend = new resend_1.Resend(RESEND_API_KEY_SECRET);
        const inviteLink = `https://app.pessy.app/register-user?access=${accessToken}`;
        const safeName = (reqData.name || "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c] || c));
        await resend.emails.send({
            from: "PESSY <noreply@pessy.app>",
            to: reqData.email,
            subject: "Ya tenés acceso a Pessy",
            html: `
          <div style="font-family: 'Manrope', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
            <h1 style="color: #074738; font-size: 24px;">Hola ${safeName}</h1>
            <p style="color: #5e716b; font-size: 15px; line-height: 1.6;">
              Tu solicitud de acceso a Pessy fue aprobada. Tenés 24 horas para crear tu cuenta.
            </p>
            <a href="${inviteLink}" style="display: block; background: #074738; color: white; text-align: center; padding: 16px; border-radius: 999px; font-weight: bold; text-decoration: none; margin-top: 24px;">
              Crear mi cuenta
            </a>
            <p style="color: #9ca8a2; font-size: 12px; margin-top: 24px;">
              Este link expira en 24 horas. Si no lo pediste, ignorá este email.
            </p>
          </div>
        `,
        });
    }
    return { ok: true, accessToken };
});
//# sourceMappingURL=index.js.map