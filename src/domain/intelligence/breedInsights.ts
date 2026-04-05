/**
 * Breed Insights
 *
 * Banco de insights específicos por raza y edad.
 * Devuelve un insight accionable en formato conversacional (tutor, no médico).
 *
 * Regla: NUNCA lenguaje médico/clínico. Siempre lifestyle/consumer y accionable.
 */

export interface BreedInsight {
  id: string;
  breed: string; // o "all" para genérico
  ageMinMonths: number;
  ageMaxMonths: number;
  insight: string; // "Labradores de 3 años necesitan 60 min de actividad..."
  question: string; // "¿A dónde llevás a {petName} habitualmente?"
  category: "activity" | "health" | "nutrition" | "behavior" | "social";
  actionLabel?: string; // "Registrar paseo" | "Buscar vet" | "Ver rutinas"
  actionType?: "walk" | "vet" | "routines" | "community";
}

const BREED_INSIGHTS: BreedInsight[] = [
  // ────────────────────────────────────────────────────────────────────────
  // LABRADOR RETRIEVER
  // ────────────────────────────────────────────────────────────────────────
  {
    id: "labrador-puppy-activity",
    breed: "Labrador Retriever",
    ageMinMonths: 3,
    ageMaxMonths: 12,
    insight: "Los cachorros Labrador son máquinas de energía. Necesitan 15-20 min de juego suave, varias veces al día, pero evitá paseos largos hasta los 12 meses (las articulaciones aún se están formando).",
    question: "¿Qué tipo de juegos le gustan a {petName}?",
    category: "activity",
    actionLabel: "Registrar juego",
    actionType: "walk",
  },
  {
    id: "labrador-adult-exercise",
    breed: "Labrador Retriever",
    ageMinMonths: 12,
    ageMaxMonths: 60,
    insight: "Los Labradores adultos necesitan 60 minutos diarios de actividad. Aman el agua, así que si podés llevar a {petName} a una playa o pileta, será el mejor ejercicio.",
    question: "¿A dónde llevás a {petName} a quemar energía?",
    category: "activity",
    actionLabel: "Registrar paseo",
    actionType: "walk",
  },
  {
    id: "labrador-senior-health",
    breed: "Labrador Retriever",
    ageMinMonths: 60,
    ageMaxMonths: 200,
    insight: "A partir de los 5 años, los Labradores pueden desarrollar problemas articulares. Mantené la actividad suave, evitá saltos grandes, y disfrutá de paseos cortos y frecuentes con {petName}.",
    question: "¿Notás que {petName} cojea o le cuesta levantarse?",
    category: "health",
    actionLabel: "Conectar con vet",
    actionType: "vet",
  },

  // ────────────────────────────────────────────────────────────────────────
  // GOLDEN RETRIEVER
  // ────────────────────────────────────────────────────────────────────────
  {
    id: "golden-adult-routine",
    breed: "Golden Retriever",
    ageMinMonths: 12,
    ageMaxMonths: 72,
    insight: "{petName} es un Golden: nació para la actividad. 45-60 min de paseo diario es el mínimo. Además, los Goldens son sociales: otros perros, gente, playas... todo lo disfrutan.",
    question: "¿Cuántos minutos de paseo hace {petName} en promedio?",
    category: "activity",
    actionLabel: "Ver estadísticas",
    actionType: "walk",
  },
  {
    id: "golden-grooming",
    breed: "Golden Retriever",
    ageMinMonths: 12,
    ageMaxMonths: 200,
    insight: "El pelo de {petName} necesita cepillado 3-4 veces por semana para evitar nudos y muda excesiva. Baño cada 4-6 semanas, con un buen secado para proteger la piel.",
    question: "¿Cuándo fue la última vez que peinaste o bañaste a {petName}?",
    category: "nutrition",
    actionLabel: "Registrar grooming",
    actionType: "routines",
  },

  // ────────────────────────────────────────────────────────────────────────
  // BULLDOG FRANCÉS (Braquicéfalo)
  // ────────────────────────────────────────────────────────────────────────
  {
    id: "frenchie-heat-alert",
    breed: "Bulldog Francés",
    ageMinMonths: 6,
    ageMaxMonths: 200,
    insight: "{petName} es un Bulldog Francés: su hocico corto lo hace muy sensible al calor. Evitá paseos entre las 11:00 y 17:00 en días cálidos. Siempre agua fresca a mano.",
    question: "¿A qué hora paseas a {petName} cuando hace calor?",
    category: "health",
    actionLabel: "Ver recomendaciones de horario",
    actionType: "routines",
  },
  {
    id: "frenchie-exercise",
    breed: "Bulldog Francés",
    ageMinMonths: 6,
    ageMaxMonths: 200,
    insight: "Los Frenchies no necesitan horas de ejercicio, pero sí actividad diaria controlada. 20-30 min de paseo lento es perfecto. Evitá carreras o juegos bruscos que lo agiten demasiado.",
    question: "¿{petName} se cansa fácilmente o respira con dificultad después de jugar?",
    category: "activity",
    actionLabel: "Consultar vet",
    actionType: "vet",
  },

  // ────────────────────────────────────────────────────────────────────────
  // POODLE / CANICHE
  // ────────────────────────────────────────────────────────────────────────
  {
    id: "poodle-grooming",
    breed: "Poodle",
    ageMinMonths: 6,
    ageMaxMonths: 200,
    insight: "El pelaje de {petName} crece constantemente. Peluquería profesional cada 4-6 semanas es imprescindible. Entre peluquerías, cepillado 2-3 veces por semana para evitar nudos y enfermedades de piel.",
    question: "¿Cuándo visitó {petName} la peluquería por última vez?",
    category: "nutrition",
    actionLabel: "Agendar peluquería",
    actionType: "vet",
  },
  {
    id: "poodle-intelligence",
    breed: "Poodle",
    ageMinMonths: 6,
    ageMaxMonths: 200,
    insight: "{petName} es un Poodle: super inteligente y le encanta aprender. Entrenamiento, juegos de olfato, agility... estimulación mental lo hace feliz y cansado.",
    question: "¿Hacés actividades de entrenamiento o juegos mentales con {petName}?",
    category: "behavior",
    actionLabel: "Ver rutinas de entrenamiento",
    actionType: "routines",
  },

  // ────────────────────────────────────────────────────────────────────────
  // YORKSHIRE TERRIER
  // ────────────────────────────────────────────────────────────────────────
  {
    id: "yorkie-dental",
    breed: "Yorkshire Terrier",
    ageMinMonths: 12,
    ageMaxMonths: 200,
    insight: "Los Yorkshire tienen predisposición a problemas dentales. Cepillo de dientes 3-4 veces por semana, revisión dental anual, y juguetes que promuevan la limpieza.",
    question: "¿Cuándo fue la última revisión dental de {petName}?",
    category: "health",
    actionLabel: "Agendar limpieza dental",
    actionType: "vet",
  },
  {
    id: "yorkie-grooming",
    breed: "Yorkshire Terrier",
    ageMinMonths: 6,
    ageMaxMonths: 200,
    insight: "El pelo largo de {petName} necesita cepillado diario. Si preferís pelo corto, peluquería cada 4-6 semanas y cepillado 2 veces por semana.",
    question: "¿Cómo llevás el aseo del pelaje de {petName}?",
    category: "nutrition",
    actionLabel: "Ver tips de grooming",
    actionType: "routines",
  },

  // ────────────────────────────────────────────────────────────────────────
  // BEAGLE
  // ────────────────────────────────────────────────────────────────────────
  {
    id: "beagle-escape-risk",
    breed: "Beagle",
    ageMinMonths: 6,
    ageMaxMonths: 200,
    insight: "{petName} es un Beagle: tienen un olfato increíble y pueden escaparse siguiendo un olor. Paseos siempre con correa, y cercá bien el jardín si tiene acceso.",
    question: "¿{petName} alguna vez se escapó o se perdió?",
    category: "behavior",
    actionLabel: "Ver tips de seguridad",
    actionType: "routines",
  },
  {
    id: "beagle-activity",
    breed: "Beagle",
    ageMinMonths: 6,
    ageMaxMonths: 200,
    insight: "Los Beagles necesitan estimulación mental constante. Juegos de olfato, sniff games, y paseos explorativos mantienen a {petName} feliz y evitan aburrimiento destructivo.",
    question: "¿Hacés juegos de olfato con {petName}?",
    category: "activity",
    actionLabel: "Ver juegos de olfato",
    actionType: "routines",
  },

  // ────────────────────────────────────────────────────────────────────────
  // BOXER
  // ────────────────────────────────────────────────────────────────────────
  {
    id: "boxer-activity",
    breed: "Boxer",
    ageMinMonths: 12,
    ageMaxMonths: 72,
    insight: "Los Boxers son perros energéticos y atléticos. 60 min de ejercicio diario es ideal. Aman jugar, entrenamiento, y actividades de impacto (correr, saltar, agility).",
    question: "¿Cuánta actividad física hace {petName} diariamente?",
    category: "activity",
    actionLabel: "Registrar actividad",
    actionType: "walk",
  },
  {
    id: "boxer-checkup",
    breed: "Boxer",
    ageMinMonths: 60,
    ageMaxMonths: 200,
    insight: "A partir de los 5 años, es bueno hacer un chequeo anual con vet, incluyendo electrocardiograma. Los Boxers pueden tener predisposición a algunos problemas cardiacos.",
    question: "¿Cuándo fue el último chequeo completo de {petName}?",
    category: "health",
    actionLabel: "Agendar vet",
    actionType: "vet",
  },

  // ────────────────────────────────────────────────────────────────────────
  // DACHSHUND
  // ────────────────────────────────────────────────────────────────────────
  {
    id: "dachshund-back",
    breed: "Dachshund",
    ageMinMonths: 6,
    ageMaxMonths: 200,
    insight: "La columna de {petName} es larga y frágil. Evitá saltos desde sofás o camas, escaleras prolongadas, y movimientos bruscos. Juguetes a nivel del suelo, camas orthopédicas.",
    question: "¿{petName} salta mucho del sofá o cojea después?",
    category: "health",
    actionLabel: "Conectar con vet",
    actionType: "vet",
  },
  {
    id: "dachshund-weight",
    breed: "Dachshund",
    ageMinMonths: 6,
    ageMaxMonths: 200,
    insight: "El sobrepeso en {petName} aumenta el riesgo de problemas de columna. Mantené un peso saludable con control de porciones y paseos diarios regulares.",
    question: "¿Cuánto pesa {petName} según el vet?",
    category: "nutrition",
    actionLabel: "Ver plan de nutrición",
    actionType: "routines",
  },

  // ────────────────────────────────────────────────────────────────────────
  // BORDER COLLIE
  // ────────────────────────────────────────────────────────────────────────
  {
    id: "border-collie-mental",
    breed: "Border Collie",
    ageMinMonths: 6,
    ageMaxMonths: 200,
    insight: "{petName} es un Border Collie: la raza más inteligente. Necesita estimulación mental diaria: entrenamiento, agility, juegos complejos. Un Border aburrido es un Border destructivo.",
    question: "¿Hacés entrenamiento o actividades complejas con {petName}?",
    category: "behavior",
    actionLabel: "Ver programas de entrenamiento",
    actionType: "routines",
  },
  {
    id: "border-collie-exercise",
    breed: "Border Collie",
    ageMinMonths: 6,
    ageMaxMonths: 200,
    insight: "Además de lo mental, {petName} necesita 60-90 min de ejercicio físico intenso. Running, paseos largos, juego libre en espacios abiertos... es lo suyo.",
    question: "¿Cuántos minutos de actividad física hace {petName} diariamente?",
    category: "activity",
    actionLabel: "Ver estadísticas",
    actionType: "walk",
  },

  // ────────────────────────────────────────────────────────────────────────
  // PASTOR ALEMÁN
  // ────────────────────────────────────────────────────────────────────────
  {
    id: "pastor-activity",
    breed: "Pastor Alemán",
    ageMinMonths: 12,
    ageMaxMonths: 72,
    insight: "{petName} necesita 60-90 min de ejercicio diario. Ama el trabajo: entrenamiento, buscar, proteger. Sin estímulo suficiente, puede desarrollar comportamientos problemáticos.",
    question: "¿Qué actividades le gustan más a {petName}?",
    category: "activity",
    actionLabel: "Ver rutinas",
    actionType: "routines",
  },
  {
    id: "pastor-hip",
    breed: "Pastor Alemán",
    ageMinMonths: 60,
    ageMaxMonths: 200,
    insight: "Los Pastores Alemanes pueden tener predisposición a problemas articulares. Paseos regulares sin impacto excesivo, peso controlado, y chequeos anuales a partir de los 5 años.",
    question: "¿{petName} salta mucho o cojea después de actividad intensa?",
    category: "health",
    actionLabel: "Agendar vet",
    actionType: "vet",
  },

  // ────────────────────────────────────────────────────────────────────────
  // GATO (genérico)
  // ────────────────────────────────────────────────────────────────────────
  {
    id: "cat-enrichment",
    breed: "Gato",
    ageMinMonths: 6,
    ageMaxMonths: 200,
    insight: "{petName} necesita enriquecimiento ambiental: rascadores, juguetes interactivos, alturas para explorar. 15-20 min de juego diario es ideal.",
    question: "¿{petName} tiene acceso a rascadores, alturas y juguetes variados?",
    category: "behavior",
    actionLabel: "Ver ideas de enriquecimiento",
    actionType: "routines",
  },
  {
    id: "cat-litter",
    breed: "Gato",
    ageMinMonths: 6,
    ageMaxMonths: 200,
    insight: "{petName} necesita una caja de arena limpia (una por gato + 1 extra). Limpieza diaria previene comportamientos de stress y problemas.",
    question: "¿Limpias la caja de arena de {petName} regularmente?",
    category: "health",
    actionLabel: "Ver rutina de limpieza",
    actionType: "routines",
  },

  // ────────────────────────────────────────────────────────────────────────
  // FALLBACK: Razas genéricas o no listadas
  // ────────────────────────────────────────────────────────────────────────
  {
    id: "all-exercise",
    breed: "all",
    ageMinMonths: 6,
    ageMaxMonths: 200,
    insight: "{petName} necesita ejercicio regular adaptado a su edad y tamaño. Observá su energía: si está ansioso o destructivo, probablemente necesita más actividad.",
    question: "¿Cuántos minutos de paseo hace {petName} diariamente?",
    category: "activity",
    actionLabel: "Registrar actividad",
    actionType: "walk",
  },
  {
    id: "all-health",
    breed: "all",
    ageMinMonths: 12,
    ageMaxMonths: 200,
    insight: "Chequeo vet anual es imprescindible para {petName}. A partir de los 7 años, conviene revisar más frecuentemente.",
    question: "¿Cuándo fue el último chequeo veterinario de {petName}?",
    category: "health",
    actionLabel: "Agendar vet",
    actionType: "vet",
  },
];

/**
 * Obtiene un insight relevante para una mascota dado su raza y edad.
 * Devuelve el primer insight que coincida, o null si no hay coincidencia.
 */
export function getBreedInsight(breed: string, ageMonths: number, petName: string): BreedInsight | null {
  // Buscar insight específico para la raza
  const specificInsight = BREED_INSIGHTS.find(
    (insight) =>
      insight.breed.toLowerCase() === breed.toLowerCase() &&
      ageMonths >= insight.ageMinMonths &&
      ageMonths <= insight.ageMaxMonths
  );

  if (specificInsight) {
    return {
      ...specificInsight,
      insight: specificInsight.insight.replace(/{petName}/g, petName),
      question: specificInsight.question.replace(/{petName}/g, petName),
    };
  }

  // Fallback: buscar insight genérico (breed: "all")
  const genericInsight = BREED_INSIGHTS.find(
    (insight) =>
      insight.breed === "all" &&
      ageMonths >= insight.ageMinMonths &&
      ageMonths <= insight.ageMaxMonths
  );

  if (genericInsight) {
    return {
      ...genericInsight,
      insight: genericInsight.insight.replace(/{petName}/g, petName),
      question: genericInsight.question.replace(/{petName}/g, petName),
    };
  }

  return null;
}
