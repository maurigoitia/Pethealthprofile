// Report verification utility - Nivel 1 implementation
// Generates cryptographic hash for health reports

export interface ReportData {
  petName: string;
  petBreed: string;
  petAge: string;
  petSex: string;
  petMicrochip: string;
  reportId: string;
  reportDate: string;
  reportHash: string;
  reportShortHash: string;
  weightData: Array<{ month: string; weight: number }>;
  medications: Array<{ name: string; dose: string; type: string; duration: string }>;
  vaccines: Array<{ name: string; date: string; status: string; next: string }>;
  medicalHistory: Array<{ date: string; category: string; event: string; details: string; doctor: string }>;
}

/**
 * Generates a simple hash from pet name + timestamp
 * In production, this would hash the entire report content and be done server-side
 */
export function generateReportHash(petName: string): string {
  const timestamp = new Date().getTime();
  const data = `${petName}-${timestamp}`;
  
  // Simple hash for demo - in production use crypto.subtle.digest
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const hashHex = Math.abs(hash).toString(16).padStart(16, '0');
  // Add more random hex for realistic length
  const randomHex = Math.random().toString(16).slice(2).padStart(16, '0');
  return `${hashHex}${randomHex}${hashHex}${randomHex}`;
}

/**
 * Generates unique report ID
 * Format: PSY-YYYY-PETNAME-HASH
 */
export function generateReportId(petName: string): string {
  const year = new Date().getFullYear();
  const petNameClean = petName.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 10);
  const randomId = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `PSY-${year}-${petNameClean}-${randomId}`;
}

/**
 * Formats timestamp for display
 */
export function formatReportDate(date: Date): string {
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];

  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName}, ${day} ${month} ${year}`;
}

/**
 * Gets short hash for display (first 8 chars)
 */
export function getShortHash(petName: string): string {
  return generateReportHash(petName).slice(0, 8).toUpperCase();
}
