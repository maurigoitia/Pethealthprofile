// ============================================================================
// PESSY - Servicio de analisis documental
// Mock + implementacion real
// ============================================================================

import {
  ExtractedData,
  DocumentExtractionResponse,
  DocumentType,
  MedicationExtracted,
  Measurement,
} from "../types/medical";

// ============================================================================
// MOCK - Reemplazar con API real
// ============================================================================

export async function mockProcessDocument(
  file: File
): Promise<DocumentExtractionResponse> {
  // Simular delay de procesamiento
  await new Promise((resolve) => setTimeout(resolve, 2500));

  // Detectar tipo aproximado por nombre de archivo
  const fileName = file.name.toLowerCase();
  let documentType: DocumentType = "other";

  if (fileName.includes("vacun") || fileName.includes("vaccine")) {
    documentType = "vaccine";
  } else if (fileName.includes("lab") || fileName.includes("analisis")) {
    documentType = "lab_test";
  } else if (fileName.includes("radio") || fileName.includes("xray") || fileName.includes("rx")) {
    documentType = "xray";
  } else if (fileName.includes("eco") || fileName.includes("echo")) {
    documentType = "echocardiogram";
  } else if (fileName.includes("ecg") || fileName.includes("electro")) {
    documentType = "electrocardiogram";
  } else if (fileName.includes("cirug") || fileName.includes("surgery")) {
    documentType = "surgery";
  } else if (fileName.includes("receta") || fileName.includes("med")) {
    documentType = "medication";
  } else if (fileName.includes("control") || fileName.includes("consulta")) {
    documentType = "checkup";
  }

  // Mock data basado en el tipo detectado
  const mockResponses: Record<DocumentType, ExtractedData> = {
    vaccine: {
      documentType: "vaccine",
      documentTypeConfidence: "high",
      eventDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      eventDateConfidence: "high",
      provider: "Clínica Veterinaria del Parque",
      providerConfidence: "high",
      diagnosis: null,
      diagnosisConfidence: "not_detected",
      observations: "Aplicación de vacuna séxtuple. Mascota en buen estado general.",
      observationsConfidence: "high",
      medications: [],
      nextAppointmentDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "Refuerzo anual de vacuna séxtuple",
      nextAppointmentConfidence: "high",
      suggestedTitle: "Vacunación Séxtuple",
      aiGeneratedSummary:
        "Se aplicó la vacuna séxtuple de forma exitosa. La mascota respondió bien al procedimiento. Se recomienda refuerzo en un año.",
      measurements: [],
    },

    lab_test: {
      documentType: "lab_test",
      documentTypeConfidence: "high",
      eventDate: new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000).toISOString(),
      eventDateConfidence: "high",
      provider: "Laboratorio Veterinario Diagnóstica",
      providerConfidence: "medium",
      diagnosis: "Perfil bioquímico completo dentro de parámetros normales",
      diagnosisConfidence: "high",
      observations: "Todos los valores en rango de referencia. Función renal y hepática estables.",
      observationsConfidence: "high",
      medications: [],
      nextAppointmentDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "Control bioquímico semestral",
      nextAppointmentConfidence: "medium",
      suggestedTitle: "Análisis Bioquímico",
      aiGeneratedSummary:
        "Los resultados de laboratorio muestran que todos los valores están dentro de los rangos normales. La función renal y hepática están funcionando correctamente. Se recomienda repetir análisis en 6 meses como control preventivo.",
      measurements: [
        {
          name: "Glucosa",
          value: "92",
          unit: "mg/dL",
          referenceRange: "70-110",
          confidence: "high",
        },
        {
          name: "Creatinina",
          value: "1.1",
          unit: "mg/dL",
          referenceRange: "0.5-1.5",
          confidence: "high",
        },
        {
          name: "ALT",
          value: "45",
          unit: "U/L",
          referenceRange: "10-100",
          confidence: "high",
        },
      ],
    },

    xray: {
      documentType: "xray",
      documentTypeConfidence: "high",
      eventDate: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000).toISOString(),
      eventDateConfidence: "high",
      provider: "Centro de Diagnóstico Veterinario",
      providerConfidence: "high",
      diagnosis: "Displasia de cadera grado leve. Sin evidencia de fracturas.",
      diagnosisConfidence: "high",
      observations: "Remodelación articular mínima. Se recomienda manejo conservador con suplementación.",
      observationsConfidence: "high",
      medications: [
        {
          name: "Condroprotectores",
          dosage: "1 comprimido",
          frequency: "cada 24 horas",
          duration: "Crónico",
          confidence: "high",
        },
      ],
      nextAppointmentDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "Control radiográfico de seguimiento",
      nextAppointmentConfidence: "medium",
      suggestedTitle: "Radiografía de Cadera",
      aiGeneratedSummary:
        "La radiografía registra displasia de cadera leve según los parámetros documentados. Se sugiere considerar tratamiento preventivo con condroprotectores y control de peso según evaluación veterinaria profesional.",
      measurements: [],
    },

    echocardiogram: {
      documentType: "echocardiogram",
      documentTypeConfidence: "high",
      eventDate: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000).toISOString(),
      eventDateConfidence: "high",
      provider: "Servicio de Cardiología Veterinaria",
      providerConfidence: "high",
      diagnosis: "Cardiomiopatía dilatada en fase inicial",
      diagnosisConfidence: "high",
      observations: "Fracción de acortamiento 24%. Leve regurgitación mitral. Se inicia tratamiento con Pimobendan.",
      observationsConfidence: "high",
      medications: [
        {
          name: "Pimobendan",
          dosage: "5mg",
          frequency: "cada 12 horas",
          duration: "Crónico",
          confidence: "high",
        },
      ],
      nextAppointmentDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "Control ecocardiográfico de seguimiento",
      nextAppointmentConfidence: "high",
      suggestedTitle: "Ecocardiograma de Control",
      aiGeneratedSummary:
        "El ecocardiograma reveló una cardiomiopatía dilatada en etapa temprana. El corazón está trabajando con menor eficiencia de lo normal, pero el diagnóstico a tiempo permite un tratamiento efectivo. La medicación prescrita ayudará a mejorar la función cardíaca. Es importante el seguimiento cada 3 meses.",
      measurements: [
        {
          name: "Fracción de acortamiento",
          value: "24",
          unit: "%",
          referenceRange: "25-45",
          confidence: "high",
        },
      ],
    },

    electrocardiogram: {
      documentType: "electrocardiogram",
      documentTypeConfidence: "high",
      eventDate: new Date(Date.now() - Math.random() * 12 * 24 * 60 * 60 * 1000).toISOString(),
      eventDateConfidence: "high",
      provider: "Clínica Cardiológica Veterinaria",
      providerConfidence: "high",
      diagnosis: "Ritmo sinusal estable. Sin arritmias detectadas.",
      diagnosisConfidence: "high",
      observations: "Frecuencia cardíaca promedio 128 lpm. Intervalo PR 84ms. Complejo QRS 76ms.",
      observationsConfidence: "high",
      medications: [],
      nextAppointmentDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "ECG de control preventivo",
      nextAppointmentConfidence: "medium",
      suggestedTitle: "Electrocardiograma (ECG)",
      aiGeneratedSummary:
        "El electrocardiograma muestra un ritmo cardíaco normal y estable. No se detectaron irregularidades ni arritmias. El corazón está funcionando de manera adecuada desde el punto de vista eléctrico.",
      measurements: [
        {
          name: "Frecuencia cardíaca",
          value: "128",
          unit: "lpm",
          referenceRange: "70-160",
          confidence: "high",
        },
        {
          name: "Intervalo PR",
          value: "84",
          unit: "ms",
          referenceRange: "60-130",
          confidence: "high",
        },
      ],
    },

    surgery: {
      documentType: "surgery",
      documentTypeConfidence: "high",
      eventDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      eventDateConfidence: "high",
      provider: "Hospital Veterinario Quirúrgico",
      providerConfidence: "high",
      diagnosis: "Castración realizada exitosamente. Sin complicaciones.",
      diagnosisConfidence: "high",
      observations: "Procedimiento quirúrgico sin incidentes. Se retiran puntos en 10 días.",
      observationsConfidence: "high",
      medications: [
        {
          name: "Carprofeno",
          dosage: "50mg",
          frequency: "cada 12 horas",
          duration: "7 días",
          confidence: "high",
        },
        {
          name: "Cefalexina",
          dosage: "500mg",
          frequency: "cada 12 horas",
          duration: "10 días",
          confidence: "high",
        },
      ],
      nextAppointmentDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "Retiro de puntos",
      nextAppointmentConfidence: "high",
      suggestedTitle: "Cirugía de Castración",
      aiGeneratedSummary:
        "La cirugía de castración se realizó sin complicaciones. Se prescribió medicación antiinflamatoria y antibióticos para prevenir infecciones. Es importante mantener la zona limpia y evitar que la mascota se lama la herida. Los puntos se retiran en 10 días.",
      measurements: [],
    },

    medication: {
      documentType: "medication",
      documentTypeConfidence: "high",
      eventDate: new Date().toISOString(),
      eventDateConfidence: "high",
      provider: "Veterinaria del Centro",
      providerConfidence: "medium",
      diagnosis: null,
      diagnosisConfidence: "not_detected",
      observations: "Receta médica para tratamiento ambulatorio.",
      observationsConfidence: "medium",
      medications: [
        {
          name: "Amoxicilina + Ácido Clavulánico",
          dosage: "500mg",
          frequency: "cada 12 horas",
          duration: "14 días",
          confidence: "high",
        },
      ],
      nextAppointmentDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "Control post-tratamiento",
      nextAppointmentConfidence: "low",
      suggestedTitle: "Receta de Antibióticos",
      aiGeneratedSummary:
        "Se prescribió antibiótico para tratamiento de infección. Es importante completar el ciclo completo de medicación aunque los síntomas mejoren antes. No suspender el tratamiento sin consultar al veterinario.",
      measurements: [],
    },

    checkup: {
      documentType: "checkup",
      documentTypeConfidence: "high",
      eventDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      eventDateConfidence: "high",
      provider: "Clínica Veterinaria Salud Animal",
      providerConfidence: "high",
      diagnosis: "Parámetros observados dentro de rangos documentados.",
      diagnosisConfidence: "high",
      observations: "Peso documentado: 31.2kg. Dentadura revisada. Pelaje evaluado.",
      observationsConfidence: "high",
      medications: [],
      nextAppointmentDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "Control preventivo semestral",
      nextAppointmentConfidence: "medium",
      suggestedTitle: "Control de Rutina",
      aiGeneratedSummary:
        "La consulta de control registró los parámetros vitales habituales. No se documentaron hallazgos que requieran atención inmediata según el profesional actuante. Se sugiere próximo control en 6 meses.",
      measurements: [
        {
          name: "Peso",
          value: "31.2",
          unit: "kg",
          referenceRange: "28-32",
          confidence: "high",
        },
        {
          name: "Temperatura",
          value: "38.5",
          unit: "°C",
          referenceRange: "38-39.5",
          confidence: "high",
        },
      ],
    },

    other: {
      documentType: "other",
      documentTypeConfidence: "low",
      eventDate: new Date().toISOString(),
      eventDateConfidence: "medium",
      provider: null,
      providerConfidence: "not_detected",
      diagnosis: null,
      diagnosisConfidence: "not_detected",
      observations: "Documento cargado exitosamente. Información no categorizada automáticamente.",
      observationsConfidence: "low",
      medications: [],
      nextAppointmentDate: null,
      nextAppointmentReason: null,
      nextAppointmentConfidence: "not_detected",
      suggestedTitle: "Documento Adicional",
      aiGeneratedSummary:
        "Este documento fue procesado pero no se pudo identificar automáticamente su tipo. Puedes revisarlo manualmente o volver a cargarlo con mejor calidad de imagen.",
      measurements: [],
    },
  };

  const extractedData = mockResponses[documentType];

  return {
    extractedData,
    processingTimeMs: 2500,
    model: "servicio-analisis (mock)",
    tokensUsed: 1250,
  };
}

// ============================================================================
// IMPLEMENTACION REAL
// ============================================================================

export async function callAnalysisAPI(
  file: File
): Promise<DocumentExtractionResponse> {
  const startTime = Date.now();
  const analysisApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const analysisModel = import.meta.env.VITE_ANALYSIS_MODEL;

  if (!analysisApiKey || !analysisModel) {
    throw new Error("Servicio de analisis no configurado");
  }

  const optimizedFile = await prepareFileForAnalysis(file);
  const base64 = await fileToBase64(optimizedFile);

  const prompt = `Extrae datos veterinarios y responde SOLO JSON válido.
Schema exacto:
{
"documentType":"vaccine|lab_test|xray|echocardiogram|electrocardiogram|surgery|medication|checkup|other",
"documentTypeConfidence":"high|medium|low|not_detected",
"eventDate":"YYYY-MM-DD|null",
"eventDateConfidence":"high|medium|low|not_detected",
"provider":"string|null",
"providerConfidence":"high|medium|low|not_detected",
"diagnosis":"string|null",
"diagnosisConfidence":"high|medium|low|not_detected",
"observations":"string|null",
"observationsConfidence":"high|medium|low|not_detected",
"medications":[{"name":"string","dosage":"string|null","frequency":"string|null","duration":"string|null","confidence":"high|medium|low|not_detected"}],
"nextAppointmentDate":"YYYY-MM-DD|null",
"nextAppointmentReason":"string|null",
"nextAppointmentConfidence":"high|medium|low|not_detected",
"suggestedTitle":"string",
"aiGeneratedSummary":"2-3 oraciones claras para tutor",
"measurements":[{"name":"string","value":"string","unit":"string|null","referenceRange":"string|null","confidence":"high|medium|low|not_detected"}]
}
Reglas: sin markdown, sin texto extra, null si no detecta campo.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${analysisModel}:generateContent?key=${analysisApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: optimizedFile.type, data: base64 } },
          ],
        }],
        generationConfig: {
          temperature: 0,
          topK: 1,
          topP: 1,
          responseMimeType: "application/json",
          maxOutputTokens: 1200,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error del servicio de analisis (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Respuesta del servicio de analisis vacia o malformada");
  }

  // Limpiar markdown si el proveedor devuelve fences
  const stripped = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No se pudo interpretar la respuesta del servicio de analisis");
  }

  const extractedData: ExtractedData = JSON.parse(jsonMatch[0]);

  return {
    extractedData,
    processingTimeMs: Date.now() - startTime,
    model: "servicio-analisis-v1",
    tokensUsed: result.usageMetadata?.totalTokenCount ?? 0,
  };
}

export async function generateHealthSummary(prompt: string): Promise<string> {
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
  const analysisModel = (import.meta as any).env.VITE_ANALYSIS_MODEL;
  if (!apiKey || !analysisModel) throw new Error("Servicio de analisis no configurado");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${analysisModel}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 450,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error del servicio de analisis (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar el resumen.";
}

export const extractMedicalData = callAnalysisAPI;

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function prepareFileForAnalysis(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size < 450_000) return file;

  try {
    const image = await createImageBitmap(file);
    const maxSide = 1600;
    const largerSide = Math.max(image.width, image.height);
    const scale = largerSide > maxSide ? maxSide / largerSide : 1;
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      image.close();
      return file;
    }

    ctx.drawImage(image, 0, 0, width, height);
    image.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );

    if (!blob) return file;
    if (blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
      type: "image/jpeg",
    });
  } catch (error) {
    console.warn("No se pudo optimizar imagen para análisis, se usa original:", error);
    return file;
  }
}
