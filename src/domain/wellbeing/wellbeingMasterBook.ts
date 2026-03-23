export const WELLBEING_MASTER_BOOK_VERSION = "wellbeing_master_book_v1";

export type WellbeingKnowledgeKind = "hard_fact" | "soft_trait" | "guardrail";
export type WellbeingGuardrailType = "block" | "alert" | "recommendation";

export type WellbeingSpeciesGroupId =
  | "dog.general"
  | "dog.brachycephalic"
  | "dog.active_working"
  | "dog.reactive"
  | "dog.companion"
  | "dog.puppy"
  | "cat.general"
  | "cat.brachycephalic";

export interface ThermalSafetyProfile {
  id: WellbeingSpeciesGroupId;
  label: string;
  appliesTo: string[];
  comfortableMinC: number | null;
  comfortableMaxC: number | null;
  avoidExerciseAboveC: number | null;
  severeRiskAboveC: number | null;
  collapseBodyTempC: number | null;
  humiditySensitive: boolean;
  earlySigns: string[];
  prevention: string[];
  kind: WellbeingKnowledgeKind;
  guardrailType: WellbeingGuardrailType;
}

export interface FoodSafetyItem {
  id: string;
  label: string;
  danger: string;
  appliesTo: Array<"dog" | "cat" | "general">;
  action: string;
  kind: WellbeingKnowledgeKind;
  guardrailType: WellbeingGuardrailType;
}

export interface SeparationAnxietyRule {
  id: string;
  label: string;
  detail: string;
  kind: WellbeingKnowledgeKind;
  guardrailType: WellbeingGuardrailType;
}

export interface PuppySocializationProfile {
  criticalWindowWeeks: { start: number; end: number };
  dailySessionMinutes: { min: number; max: number };
  safeExposure: string[];
  avoidBeforeVaccines: string[];
  ifFearAppears: string[];
}

export interface ImpulseControlCommand {
  id: "come" | "stay" | "watch_me" | "leave_it" | "wait_signal";
  label: string;
  goal: string;
  instruction: string;
  kind: WellbeingKnowledgeKind;
  guardrailType: WellbeingGuardrailType;
}

export interface TrainingFoundation {
  sessionMinutes: { min: number; max: number };
  reinforcementStyle: "positive_only";
  commandStyle: "short_and_consistent";
  aversiveToolsAllowed: false;
  principles: string[];
  disallowedMethods: string[];
}

export interface BreedBehaviorProfile {
  id: WellbeingSpeciesGroupId;
  label: string;
  exampleBreeds: string[];
  dailyNeeds: string[];
  primaryRisks: string[];
  grooming: string[];
  tutorFit: string[];
  motorUse: WellbeingKnowledgeKind[];
}

export interface DailySuggestion {
  id: string;
  groupId: WellbeingSpeciesGroupId;
  weatherCondition: "safe" | "caution" | "blocked" | "any";
  category: "outdoor" | "indoor" | "grooming" | "training" | "social";
  title: string;
  detail: string;
  duration: string;
  placeType?: "park" | "cafe" | "pet_store" | "none";
  gamificationPoints: number;
}

export interface RoutineSuggestion {
  groupId: WellbeingSpeciesGroupId;
  morningRoutine: string[];
  eveningRoutine: string[];
  weeklyTasks: string[];
  monthlyTasks: string[];
}

export interface WellbeingMasterBook {
  version: typeof WELLBEING_MASTER_BOOK_VERSION;
  thermal_safety: {
    groups: ThermalSafetyProfile[];
  };
  food_safety: {
    prohibited: FoodSafetyItem[];
  };
  separation_anxiety: {
    do_first: SeparationAnxietyRule[];
    never_do: SeparationAnxietyRule[];
  };
  puppy_socialization: PuppySocializationProfile;
  impulse_control: {
    commands: ImpulseControlCommand[];
    never_do: string[];
  };
  training_foundations: TrainingFoundation;
  breed_profiles: {
    groups: BreedBehaviorProfile[];
  };
  daily_suggestions: DailySuggestion[];
  routines: RoutineSuggestion[];
}

export const WELLBEING_MASTER_BOOK: WellbeingMasterBook = {
  version: WELLBEING_MASTER_BOOK_VERSION,
  thermal_safety: {
    groups: [
      {
        id: "dog.brachycephalic",
        label: "Perros brachycephalicos",
        appliesTo: [
          "Bulldog frances",
          "Bulldog ingles",
          "Pug",
          "Boxer",
          "Boston Terrier",
          "Shih Tzu",
        ],
        comfortableMinC: 7,
        comfortableMaxC: 21,
        avoidExerciseAboveC: 27,
        severeRiskAboveC: 28,
        collapseBodyTempC: 41,
        humiditySensitive: false,
        earlySigns: [
          "Jadeo intenso y desesperado",
          "Lengua en forma de pala o corazon con saliva espesa",
          "Desorientacion, tambaleo o colapso",
        ],
        prevention: [
          "Evitar actividad fisica por encima de 27 C",
          "Priorizar sombra, interior y ventilacion",
          "Reprogramar paseo a primera hora o tarde-noche",
        ],
        kind: "guardrail",
        guardrailType: "block",
      },
      {
        id: "dog.general",
        label: "Perros en general",
        appliesTo: ["Perros no brachycephalicos"],
        comfortableMinC: 7,
        comfortableMaxC: 24,
        avoidExerciseAboveC: 32,
        severeRiskAboveC: 32,
        collapseBodyTempC: 41,
        humiditySensitive: false,
        earlySigns: [
          "Jadeo intenso y ruidoso",
          "Encias rojas con sed o saliva espesa",
          "Desorientacion o perdida de equilibrio",
        ],
        prevention: [
          "Evitar asfalto caliente",
          "Bajar intensidad cuando sube la temperatura",
          "Revisar hidratacion antes y despues de salir",
        ],
        kind: "hard_fact",
        guardrailType: "alert",
      },
      {
        id: "cat.general",
        label: "Gatos en general",
        appliesTo: ["Gatos domesticos"],
        comfortableMinC: null,
        comfortableMaxC: 30,
        avoidExerciseAboveC: 30,
        severeRiskAboveC: 30,
        collapseBodyTempC: null,
        humiditySensitive: true,
        earlySigns: [
          "Jadeo excesivo o respiracion acelerada",
          "Debilidad o desorientacion",
          "Vomitos, salivacion abundante o encias muy rojas",
        ],
        prevention: [
          "Mantener al gato en interior con buena ventilacion",
          "Usar fuentes de agua y esterillas frias",
          "Cepillar para quitar pelo muerto en vez de rapar",
        ],
        kind: "hard_fact",
        guardrailType: "alert",
      },
      {
        id: "cat.brachycephalic",
        label: "Gatos brachycephalicos",
        appliesTo: ["Persa"],
        comfortableMinC: null,
        comfortableMaxC: 30,
        avoidExerciseAboveC: 30,
        severeRiskAboveC: 30,
        collapseBodyTempC: null,
        humiditySensitive: true,
        earlySigns: [
          "Jadeo excesivo o respiracion acelerada",
          "Debilidad o dificultad para moverse",
          "Progresion rapida a colapso o convulsiones",
        ],
        prevention: [
          "Acceso constante a la zona mas fresca de la casa",
          "Vigilancia estricta en dias calidos",
          "No exponer a calor ambiental sostenido",
        ],
        kind: "guardrail",
        guardrailType: "alert",
      },
    ],
  },
  food_safety: {
    prohibited: [
      {
        id: "chocolate",
        label: "Chocolate",
        danger: "Ingestion toxica documentada en las fuentes",
        appliesTo: ["dog"],
        action: "Trigger de alerta y chequeo clinico si hay ingestion",
        kind: "hard_fact",
        guardrailType: "alert",
      },
      {
        id: "poultry_bones",
        label: "Huesos de aves",
        danger: "Riesgo fisico por lesion y complicacion digestiva",
        appliesTo: ["dog"],
        action: "No ofrecer y vigilar acceso a restos",
        kind: "hard_fact",
        guardrailType: "block",
      },
      {
        id: "pork_bones",
        label: "Huesos de cerdo",
        danger: "Riesgo fisico por lesion y complicacion digestiva",
        appliesTo: ["dog"],
        action: "No ofrecer y vigilar acceso a restos",
        kind: "hard_fact",
        guardrailType: "block",
      },
      {
        id: "spoiled_food",
        label: "Comida en mal estado o basura",
        danger: "Riesgo severo por ingestiones no seguras",
        appliesTo: ["dog", "general"],
        action: "Revisar basura y cocina; si hubo ingestion, abrir chequeo clinico",
        kind: "guardrail",
        guardrailType: "alert",
      },
      {
        id: "xylitol",
        label: "Xilitol (chicles, caramelos sin azucar, pasta de dientes)",
        danger: "Hipoglucemia severa y falla hepatica incluso en dosis minimas",
        appliesTo: ["dog"],
        action: "Emergencia veterinaria inmediata. No inducir vomito sin indicacion profesional",
        kind: "hard_fact",
        guardrailType: "block",
      },
      {
        id: "grapes_raisins",
        label: "Uvas y pasas de uva",
        danger: "Insuficiencia renal aguda. Toxina exacta desconocida, cualquier cantidad es riesgosa",
        appliesTo: ["dog"],
        action: "Emergencia veterinaria inmediata si hubo ingestion",
        kind: "hard_fact",
        guardrailType: "block",
      },
      {
        id: "onion_garlic",
        label: "Cebolla, ajo y puerro (familia Allium)",
        danger: "Anemia hemolitica por dano oxidativo a globulos rojos",
        appliesTo: ["dog", "cat"],
        action: "Vigilar letargia, encias palidas y orina oscura. Consulta veterinaria",
        kind: "hard_fact",
        guardrailType: "alert",
      },
      {
        id: "macadamia_nuts",
        label: "Nueces de macadamia",
        danger: "Temblores musculares, hipertermia, debilidad en patas traseras",
        appliesTo: ["dog"],
        action: "Monitorear 12-48 horas. Veterinario si hay temblores o fiebre",
        kind: "hard_fact",
        guardrailType: "alert",
      },
      {
        id: "lilies",
        label: "Lirios (Lilium, Hemerocallis)",
        danger: "Insuficiencia renal aguda letal en gatos. Todas las partes de la planta son toxicas",
        appliesTo: ["cat"],
        action: "Emergencia veterinaria inmediata. Remover la planta del hogar",
        kind: "hard_fact",
        guardrailType: "block",
      },
      {
        id: "caffeine",
        label: "Cafe, te y bebidas energizantes",
        danger: "Arritmias cardiacas, hiperactividad, convulsiones",
        appliesTo: ["dog", "cat"],
        action: "Veterinario si hubo ingestion significativa. Vigilar frecuencia cardiaca",
        kind: "hard_fact",
        guardrailType: "alert",
      },
      {
        id: "alcohol",
        label: "Alcohol (bebidas, masa cruda con levadura)",
        danger: "Depresion del sistema nervioso central, acidosis metabolica, coma",
        appliesTo: ["dog", "cat"],
        action: "Emergencia veterinaria. Masa cruda con levadura fermenta en el estomago",
        kind: "hard_fact",
        guardrailType: "block",
      },
      {
        id: "avocado",
        label: "Palta (aguacate)",
        danger: "Persina causa vomitos y diarrea. Carozo puede obstruir via digestiva",
        appliesTo: ["dog"],
        action: "Monitorear sintomas digestivos. Veterinario si hay obstruccion",
        kind: "hard_fact",
        guardrailType: "alert",
      },
      {
        id: "essential_oils",
        label: "Aceites esenciales (tea tree, eucalipto, citricos)",
        danger: "Hepatotoxicidad y depresion del sistema nervioso en gatos. Absorcion cutanea rapida",
        appliesTo: ["cat"],
        action: "Retirar difusores del entorno del gato. Veterinario si hay contacto directo",
        kind: "hard_fact",
        guardrailType: "block",
      },
      {
        id: "permethrin",
        label: "Permetrina (antipulgas para perros aplicado a gatos)",
        danger: "Neurotoxicidad severa en gatos. Convulsiones, temblores, muerte",
        appliesTo: ["cat"],
        action: "NUNCA usar productos caninos en gatos. Emergencia veterinaria inmediata",
        kind: "guardrail",
        guardrailType: "block",
      },
      {
        id: "nsaids_human",
        label: "Ibuprofeno, paracetamol y aspirina (humanos)",
        danger: "Ulceracion gastrica, insuficiencia renal (perros). Hepatotoxicidad letal (gatos con paracetamol)",
        appliesTo: ["dog", "cat"],
        action: "NUNCA automedicar. Emergencia veterinaria si hubo ingestion accidental",
        kind: "guardrail",
        guardrailType: "block",
      },
    ],
  },
  separation_anxiety: {
    do_first: [
      {
        id: "departure_routine",
        label: "Rutina de salida predecible",
        detail: "Mantener las senales de salida previsibles y sin despedidas efusivas.",
        kind: "hard_fact",
        guardrailType: "recommendation",
      },
      {
        id: "fake_departures",
        label: "Salidas falsas progresivas",
        detail: "Salir y volver de forma gradual para desensibilizar la ausencia.",
        kind: "hard_fact",
        guardrailType: "recommendation",
      },
      {
        id: "special_toy",
        label: "Juguete especial al salir",
        detail: "Entregar Kong o juguete interactivo solo en el momento de marcharte.",
        kind: "hard_fact",
        guardrailType: "recommendation",
      },
      {
        id: "camera_monitoring",
        label: "Monitoreo con camara",
        detail: "Usar camara para validar si la mascota entra en panico o logra regularse.",
        kind: "soft_trait",
        guardrailType: "recommendation",
      },
    ],
    never_do: [
      {
        id: "no_punishment",
        label: "No castigar",
        detail: "El castigo empeora miedo, estres y dependencia emocional.",
        kind: "guardrail",
        guardrailType: "block",
      },
      {
        id: "no_companion_dog_fix",
        label: "No sumar otro perro como solucion",
        detail: "La ansiedad por separacion es con la figura de referencia, no con la soledad simple.",
        kind: "guardrail",
        guardrailType: "block",
      },
      {
        id: "no_crate_if_panic",
        label: "No encierres si hay panico",
        detail: "Jaulas o transportines pueden agravar el cuadro y provocar autolesiones.",
        kind: "guardrail",
        guardrailType: "block",
      },
    ],
  },
  puppy_socialization: {
    criticalWindowWeeks: { start: 3, end: 14 },
    dailySessionMinutes: { min: 10, max: 15 },
    safeExposure: [
      "Personas diversas y entornos tranquilos",
      "Viajes cortos en coche",
      "Ruidos, texturas y manipulacion fisica gradual",
      "Perros vacunados y amistosos en entorno controlado",
    ],
    avoidBeforeVaccines: [
      "Suelo publico con perros desconocidos",
      "Rios, lagos o zonas de contagio",
      "Forzar al cachorro si se asusta",
    ],
    ifFearAppears: [
      "Retirarlo a un lugar mas tranquilo",
      "No forzar la exposicion",
      "Reintentar mas tarde con menor intensidad",
    ],
  },
  impulse_control: {
    commands: [
      {
        id: "come",
        label: "Ven",
        goal: "Llamada segura y positiva",
        instruction: "Practicar primero en interior; nunca llamar para retar.",
        kind: "hard_fact",
        guardrailType: "recommendation",
      },
      {
        id: "stay",
        label: "Quieto",
        goal: "Permanencia y autocontrol",
        instruction: "Aumentar distancia y tiempo de forma progresiva.",
        kind: "hard_fact",
        guardrailType: "recommendation",
      },
      {
        id: "watch_me",
        label: "Mirame",
        goal: "Atencion sobre el tutor",
        instruction: "Usar premio, gesto y senal breve para captar foco.",
        kind: "soft_trait",
        guardrailType: "recommendation",
      },
      {
        id: "leave_it",
        label: "Dejalo",
        goal: "Seguridad ante objetos o comida peligrosa",
        instruction: "Premiar autocontrol y contencion antes de tomar el objeto.",
        kind: "hard_fact",
        guardrailType: "recommendation",
      },
      {
        id: "wait_signal",
        label: "Espera la senal",
        goal: "Frenar impulsividad en puerta, auto y comida",
        instruction: "No avanzar hasta recibir senal clara del tutor.",
        kind: "hard_fact",
        guardrailType: "recommendation",
      },
    ],
    never_do: [
      "No repetir el comando de forma compulsiva",
      "No usar la llamada para reganar",
      "No reemplazar consistencia por tirones de correa o castigo",
    ],
  },
  training_foundations: {
    sessionMinutes: { min: 10, max: 15 },
    reinforcementStyle: "positive_only",
    commandStyle: "short_and_consistent",
    aversiveToolsAllowed: false,
    principles: [
      "Sesiones cortas y diarias",
      "Refuerzo positivo con comida, juego o voz",
      "Comandos cortos, visibles y consistentes",
      "Todos los tutores usan la misma palabra",
    ],
    disallowedMethods: [
      "Castigo",
      "Violencia",
      "Collares de ahorque",
      "Collares de puas",
    ],
  },
  breed_profiles: {
    groups: [
      {
        id: "dog.active_working",
        label: "Perros activos y de trabajo",
        exampleBreeds: ["Border Collie", "Pastor Aleman", "Malinois", "Husky"],
        dailyNeeds: [
          "Ejercicio largo y estructurado",
          "Estimulo mental alto",
          "Autocontrol y precision",
        ],
        primaryRisks: [
          "Ansiedad por falta de estimulo",
          "Conducta destructiva",
          "Desborde de impulsos",
        ],
        grooming: ["No especificado en esta fuente"],
        tutorFit: ["Tutor constante con tiempo y rutina activa"],
        motorUse: ["soft_trait", "guardrail"],
      },
      {
        id: "dog.puppy",
        label: "Cachorros",
        exampleBreeds: ["Teckel como ejemplo"],
        dailyNeeds: [
          "Socializacion temprana",
          "Juego estructurado",
          "Entrenamiento breve y diario",
        ],
        primaryRisks: [
          "Miedo por castigo",
          "Mala asociacion social",
          "Problemas de conducta futuros",
        ],
        grooming: ["No especificado"],
        tutorFit: ["Tutor paciente y consistente"],
        motorUse: ["hard_fact", "guardrail"],
      },
      {
        id: "dog.reactive",
        label: "Perros reactivos o con traumas",
        exampleBreeds: ["Mestizos adoptados con antecedentes"],
        dailyNeeds: [
          "Desensibilizacion",
          "Contracondicionamiento",
          "Manejo amable de correa",
        ],
        primaryRisks: [
          "Reactividad",
          "Agresividad por dolor o estres",
          "Fobias",
        ],
        grooming: ["No especificado"],
        tutorFit: ["Tutor calmo, paciente y dispuesto a sostener terapia"],
        motorUse: ["guardrail", "soft_trait"],
      },
      {
        id: "dog.companion",
        label: "Perros de compania general",
        exampleBreeds: ["Labrador", "Golden Retriever", "Beagle", "Schnauzer"],
        dailyNeeds: [
          "Refugio y alimentacion",
          "Diversion",
          "Educacion fisica",
          "Educacion cognitiva",
        ],
        primaryRisks: [
          "Aburrimiento",
          "Destrozos",
          "Ladridos excesivos",
        ],
        grooming: ["Aseo basico"],
        tutorFit: ["Tutor disciplinado con tiempo diario"],
        motorUse: ["hard_fact", "soft_trait"],
      },
      {
        id: "cat.general",
        label: "Gatos en general",
        exampleBreeds: ["Domesticos"],
        dailyNeeds: [
          "Interior fresco y agua disponible",
          "Zonas altas y ventiladas",
          "Cepillado y observacion ambiental",
        ],
        primaryRisks: [
          "Calor extremo",
          "Deshidratacion",
          "Estres ambiental",
        ],
        grooming: ["Cepillado frecuente segun manto"],
        tutorFit: ["Tutor que mantenga hogar seguro y previsible"],
        motorUse: ["hard_fact", "soft_trait"],
      },
      {
        id: "cat.brachycephalic",
        label: "Gatos brachycephalicos",
        exampleBreeds: ["Persa"],
        dailyNeeds: [
          "Entorno fresco",
          "Vigilancia respiratoria",
          "Mantenimiento ocular y de manto",
        ],
        primaryRisks: [
          "Golpe de calor",
          "Colapso mas rapido en calor",
          "Mantenimiento alto",
        ],
        grooming: ["Cepillado diario", "Cuidado ocular frecuente"],
        tutorFit: ["Tutor con alta disponibilidad y rutina de mantenimiento"],
        motorUse: ["guardrail", "soft_trait"],
      },
    ],
  },

  daily_suggestions: [
    // ─── Activos / Trabajo ───────────────────────────────────────────────────
    { id: "active_outdoor_safe", groupId: "dog.active_working", weatherCondition: "safe", category: "outdoor", title: "Sesion de entrenamiento al aire libre", detail: "30 min de trabajo estructurado: obediencia, obstaculos o busqueda. Ideal para gastar energia mental y fisica.", duration: "30 min", placeType: "park", gamificationPoints: 15 },
    { id: "active_indoor_blocked", groupId: "dog.active_working", weatherCondition: "blocked", category: "indoor", title: "Juego de olfato en casa", detail: "Esconde premios en distintas habitaciones. Activa el cerebro tanto como una caminata larga.", duration: "20 min", placeType: "none", gamificationPoints: 10 },
    { id: "active_training_any", groupId: "dog.active_working", weatherCondition: "any", category: "training", title: "Practica de autocontrol", detail: "5 repeticiones de 'espera' antes de comer y antes de salir. Reduce impulsividad.", duration: "10 min", placeType: "none", gamificationPoints: 8 },

    // ─── Compania / General ──────────────────────────────────────────────────
    { id: "companion_walk_safe", groupId: "dog.companion", weatherCondition: "safe", category: "outdoor", title: "Paseo exploratorio sin prisa", detail: "Dejalo oler todo lo que quiera. El olfato cansa mas que correr.", duration: "20-40 min", placeType: "park", gamificationPoints: 12 },
    { id: "companion_social_safe", groupId: "dog.companion", weatherCondition: "safe", category: "social", title: "Tarde en un cafe pet-friendly", detail: "Socializacion urbana. Perfecto para perros de compania que disfrutan del ambiente.", duration: "1 hora", placeType: "cafe", gamificationPoints: 15 },
    { id: "companion_grooming_any", groupId: "dog.companion", weatherCondition: "any", category: "grooming", title: "Revision semanal de rutina", detail: "Revisa orejas, encias, uas y manto. 10 minutos que previenen problemas grandes.", duration: "10 min", placeType: "none", gamificationPoints: 10 },
    { id: "companion_indoor_blocked", groupId: "dog.companion", weatherCondition: "blocked", category: "indoor", title: "Kong o juguete rellenable", detail: "Congela comida dentro de un Kong. Lo mantiene ocupado 20-30 minutos.", duration: "20-30 min", placeType: "none", gamificationPoints: 8 },

    // ─── Brachycephalicos ────────────────────────────────────────────────────
    { id: "brachy_indoor_blocked", groupId: "dog.brachycephalic", weatherCondition: "blocked", category: "indoor", title: "Actividad mental en interior", detail: "Juegos de olfato suaves, sin esfuerzo fisico. Evitar cualquier jadeo intenso.", duration: "15 min", placeType: "none", gamificationPoints: 10 },
    { id: "brachy_walk_safe", groupId: "dog.brachycephalic", weatherCondition: "safe", category: "outdoor", title: "Paseo corto y tempranero", detail: "Maximo 15 minutos antes de las 9am o despues de las 7pm. Siempre con agua.", duration: "15 min", placeType: "park", gamificationPoints: 10 },
    { id: "brachy_grooming_any", groupId: "dog.brachycephalic", weatherCondition: "any", category: "grooming", title: "Limpieza de pliegues faciales", detail: "Con gasa humeda, limpia los pliegues alrededor del hocico. Previene dermatitis.", duration: "5 min", placeType: "none", gamificationPoints: 12 },

    // ─── Reactivos ───────────────────────────────────────────────────────────
    { id: "reactive_calm_walk", groupId: "dog.reactive", weatherCondition: "safe", category: "outdoor", title: "Paseo de descompresion", detail: "Sin personas ni perros cerca. Dejalo explorar a su ritmo. No corrijas, solo acompana.", duration: "20 min", placeType: "park", gamificationPoints: 12 },
    { id: "reactive_indoor_any", groupId: "dog.reactive", weatherCondition: "any", category: "training", title: "Sesion de calma activa", detail: "Ensenale a tirarse y relajarse con premio. 5 repeticiones en un lugar tranquilo.", duration: "10 min", placeType: "none", gamificationPoints: 10 },

    // ─── Cachorros ───────────────────────────────────────────────────────────
    { id: "puppy_social_safe", groupId: "dog.puppy", weatherCondition: "safe", category: "social", title: "Exposicion controlada al entorno", detail: "Sacalo a ver personas, ruidos y texturas distintas. Ventana de socializacion critica.", duration: "15 min", placeType: "park", gamificationPoints: 15 },
    { id: "puppy_training_any", groupId: "dog.puppy", weatherCondition: "any", category: "training", title: "Sesion de nombre y mirada", detail: "Di su nombre, cuando te mire, premio. 10 repeticiones. Base de toda la educacion futura.", duration: "5 min", placeType: "none", gamificationPoints: 10 },

    // ─── Gatos ───────────────────────────────────────────────────────────────
    { id: "cat_enrichment_any", groupId: "cat.general", weatherCondition: "any", category: "indoor", title: "Enriquecimiento ambiental", detail: "Esconde comida en distintos lugares o usa un comedero interactivo. Activa el instinto cazador.", duration: "15 min", placeType: "none", gamificationPoints: 10 },
    { id: "cat_grooming_any", groupId: "cat.general", weatherCondition: "any", category: "grooming", title: "Cepillado y revision de manto", detail: "Cepilla suavemente y revisa si hay cambios en la piel o el pelo. Momento de conexion.", duration: "10 min", placeType: "none", gamificationPoints: 8 },
  ],

  routines: [
    {
      groupId: "dog.active_working",
      morningRoutine: ["Paseo estructurado 30-45 min", "Sesion de obediencia 10 min", "Comida post-actividad"],
      eveningRoutine: ["Segunda sesion de ejercicio 20-30 min", "Juego mental 15 min", "Rutina de calma antes de dormir"],
      weeklyTasks: ["Revision de orejas y uas", "Cepillado segun raza", "Sesion de socializacion controlada"],
      monthlyTasks: ["Revision veterinaria si hay cambios de comportamiento", "Actualizacion de pipeta/antiparasitario"],
    },
    {
      groupId: "dog.companion",
      morningRoutine: ["Paseo 20-30 min", "Comida con puzzle feeder o comedero lento"],
      eveningRoutine: ["Paseo 20 min", "Juego interactivo 10 min", "Momento de contacto y calma"],
      weeklyTasks: ["Revision basica de manto y orejas", "Pesada si es adulto mayor"],
      monthlyTasks: ["Cepillado profundo o grooming profesional", "Control de peso"],
    },
    {
      groupId: "dog.brachycephalic",
      morningRoutine: ["Paseo corto antes de las 9am maximo 15 min", "Agua fresca siempre disponible"],
      eveningRoutine: ["Paseo corto despues de las 19hs", "Juego tranquilo en interior"],
      weeklyTasks: ["Limpieza de pliegues faciales", "Revision de respiracion en reposo"],
      monthlyTasks: ["Visita veterinaria preventiva", "Revision ocular"],
    },
    {
      groupId: "dog.reactive",
      morningRoutine: ["Paseo en horario de baja concurrencia", "Sin interaccion forzada con otros perros"],
      eveningRoutine: ["Rutina predecible y calma", "Ejercicio suave sin estimulos estresantes"],
      weeklyTasks: ["Registro de episodios reactivos", "Sesion de desensibilizacion gradual"],
      monthlyTasks: ["Evaluacion con profesional si hay regresion"],
    },
    {
      groupId: "dog.puppy",
      morningRoutine: ["Salida a hacer necesidades", "Juego breve 10 min", "Sesion de entrenamiento 5 min"],
      eveningRoutine: ["Socializacion controlada", "Rutina de calma para dormir"],
      weeklyTasks: ["Exposicion a nuevos sonidos y texturas", "Refuerzo de nombre y mirada"],
      monthlyTasks: ["Control vacunal con veterinario", "Pesada y revision de crecimiento"],
    },
    {
      groupId: "cat.general",
      morningRoutine: ["Comida fresca", "Limpieza de bandeja sanitaria", "Revision de agua"],
      eveningRoutine: ["Juego interactivo 10-15 min", "Cepillado si tiene pelo largo"],
      weeklyTasks: ["Limpieza profunda de bandeja", "Revision de orejas y uas"],
      monthlyTasks: ["Control de peso", "Revision veterinaria anual o ante cambios"],
    },
  ],
};
