/**
 * Data Export Service — Portabilidad de datos
 * 
 * GDPR Art. 20 — Derecho a la portabilidad de datos
 * LFPDPPP 2025 Art. 28 — Derecho de acceso
 * Ley 25.326 Art. 14 — Derecho de acceso
 * Chile Ley 21.719 Art. 8 — Portabilidad
 * Colombia Ley 1581 Art. 8 — Derecho a conocer datos
 * CCPA 1798.100 — Right to know
 * 
 * Exporta TODOS los datos del usuario en formato JSON legible por máquina.
 */

import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";

export interface ExportedUserData {
  exportMetadata: {
    exportedAt: string;
    exportVersion: string;
    requestedBy: string;
    format: "json";
    description: string;
  };
  userData: Record<string, unknown>;
  pets: Record<string, unknown>[];
  medicalEvents: Record<string, unknown>[];
  appointments: Record<string, unknown>[];
  medications: Record<string, unknown>[];
  reminders: Record<string, unknown>[];
  clinicalConditions: Record<string, unknown>[];
  clinicalAlerts: Record<string, unknown>[];
  pendingActions: Record<string, unknown>[];
  consent: Record<string, unknown> | null;
}
/**
 * Exporta todos los datos del usuario en formato JSON.
 * Incluye: perfil, mascotas, eventos médicos, citas, medicamentos, recordatorios, etc.
 */
export async function exportAllUserData(
  userId: string,
  userData: Record<string, unknown>,
  petIds: string[],
): Promise<ExportedUserData> {
  // Recolectar datos de todas las colecciones en paralelo
  const collectionsToExport = [
    { name: "medical_events", field: "petId" },
    { name: "appointments", field: "petId" },
    { name: "medications", field: "petId" },
    { name: "clinical_conditions", field: "petId" },
    { name: "clinical_alerts", field: "petId" },
    { name: "pending_actions", field: "petId" },
  ];

  const userCollections = [
    { name: "reminders", field: "userId" },
  ];

  // Query por cada mascota en cada colección
  const petDataPromises = collectionsToExport.map(async (col) => {
    const results: Record<string, unknown>[] = [];
    for (const petId of petIds) {
      const q = query(collection(db, col.name), where(col.field, "==", petId));
      const snap = await getDocs(q);
      snap.forEach((d) => results.push({ id: d.id, ...d.data() }));
    }
    return { collection: col.name, data: results };
  });

  // Query por userId
  const userDataPromises = userCollections.map(async (col) => {
    const q = query(collection(db, col.name), where(col.field, "==", userId));
    const snap = await getDocs(q);
    const results: Record<string, unknown>[] = [];
    snap.forEach((d) => results.push({ id: d.id, ...d.data() }));
    return { collection: col.name, data: results };
  });

  const [petResults, userResults] = await Promise.all([
    Promise.all(petDataPromises),
    Promise.all(userDataPromises),
  ]);

  // Organizar resultados
  const byCollection = new Map<string, Record<string, unknown>[]>();
  for (const r of [...petResults, ...userResults]) {
    byCollection.set(r.collection, r.data);
  }

  // Sanitizar userData (quitar campos internos de Firebase)
  const sanitizedUserData = { ...userData };
  delete sanitizedUserData.gmailSync;
  delete sanitizedUserData.gmailSyncInvitation;
  delete sanitizedUserData.gmailSyncReminder;

  return {
    exportMetadata: {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0.0",
      requestedBy: userId,
      format: "json",
      description: "Exportación completa de datos de usuario de Pessy. " +
        "Cumple con GDPR Art. 20 (portabilidad), LFPDPPP Art. 28 (acceso), " +
        "Ley 25.326 Art. 14 (acceso), Chile Ley 21.719 Art. 8 (portabilidad), " +
        "Colombia Ley 1581 Art. 8 (conocer datos), CCPA 1798.100 (right to know).",
    },
    userData: sanitizedUserData,
    pets: [], // Filled by caller with pet data
    medicalEvents: byCollection.get("medical_events") || [],
    appointments: byCollection.get("appointments") || [],
    medications: byCollection.get("medications") || [],
    reminders: byCollection.get("reminders") || [],
    clinicalConditions: byCollection.get("clinical_conditions") || [],
    clinicalAlerts: byCollection.get("clinical_alerts") || [],
    pendingActions: byCollection.get("pending_actions") || [],
    consent: (userData as Record<string, unknown>).consent as Record<string, unknown> | null || null,
  };
}
/**
 * Descarga los datos como archivo JSON.
 */
export function downloadAsJSON(data: ExportedUserData, fileName?: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || `pessy_data_export_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}