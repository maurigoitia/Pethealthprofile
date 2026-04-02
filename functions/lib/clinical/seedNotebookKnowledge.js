"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedBrainKnowledge = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const rateLimiter = require("../utils/rateLimiter");
const COLLECTION = "notebook_knowledge";
// ─── PESSY Brain Knowledge Sections ──────────────────────────────────────────
// Extracted & structured from the 9 NotebookLM notebook sources
const NOTEBOOK_SECTIONS = [
    // ══════════════════════════════════════════════════════════════════════════
    // 01 — VETERINARIA
    // ══════════════════════════════════════════════════════════════════════════
    {
        id: "vet_preventive_schedule",
        notebook: "veterinaria",
        title: "Calendario preventivo canino y felino",
        body: "Cachorro: vacunación core a las 6-8, 10-12, 14-16 semanas + rabia 12-16 sem. Adulto: refuerzo anual o trienal según vacuna. Felino core: FPV, FCV, FHV-1. Desparasitación interna cada 3 meses, externa mensual en zonas endémicas. Chequeo anual completo con hemograma + bioquímica a partir de 7 años canino / 10 años felino.",
        keywords: ["vacuna", "desparasitacion", "preventivo", "calendario", "cachorro", "gatito", "rabia", "core"],
        priority: 95,
    },
    {
        id: "vet_common_symptoms",
        notebook: "veterinaria",
        title: "Síntomas comunes y cuándo ir al veterinario",
        body: "Vómito aislado: observar 24h. Diarrea >48h o con sangre: veterinario urgente. Letargia + inapetencia >24h: consulta. Tos persistente >3 días: consulta. Dificultad respiratoria: emergencia. Convulsiones: emergencia. Ingestión de tóxico: emergencia inmediata. Herida abierta o sangrado activo: urgencia.",
        keywords: ["vomito", "diarrea", "letargia", "tos", "emergencia", "sintomas", "urgencia", "sangre"],
        priority: 92,
    },
    {
        id: "vet_senior_care",
        notebook: "veterinaria",
        title: "Cuidado geriátrico y detección temprana",
        body: "Perros >7 años y gatos >10 años: chequeo semestral. Incluir: hemograma, bioquímica, T4, urianálisis, presión arterial. Signos de deterioro cognitivo (DISHA): desorientación, alteración interacciones, sueño alterado, house-soiling, cambios actividad. Monitorear peso mensual, movilidad articular, salud dental.",
        keywords: ["senior", "geriatrico", "disha", "cognitivo", "artritis", "renal", "tiroides", "chequeo"],
        priority: 90,
    },
    {
        id: "vet_usa_regulations",
        notebook: "veterinaria",
        title: "Regulaciones veterinarias USA",
        body: "Rabia: obligatoria en todos los estados, frecuencia varía por estado (anual o trienal). Licencias de mascotas requeridas en la mayoría de municipios. USDA regula transporte interestatal de animales. CDC requiere certificado de salud para importación. Microchip ISO 15-digit recomendado para viajes internacionales. Reportar mordeduras es obligatorio en la mayoría de estados.",
        keywords: ["rabia", "usa", "regulacion", "licencia", "microchip", "cdc", "usda", "importacion"],
        priority: 88,
    },
    // ══════════════════════════════════════════════════════════════════════════
    // 02 — FARMACOLOGÍA
    // ══════════════════════════════════════════════════════════════════════════
    {
        id: "pharma_common_meds",
        notebook: "farmacologia",
        title: "Medicamentos veterinarios comunes",
        body: "Antiinflamatorios: meloxicam (perros y gatos), carprofeno (solo perros). Antibióticos: amoxicilina-clavulánico, cefalexina, metronidazol. Antiparasitarios: ivermectina, milbemicina, selamectina, fluralaner. Antieméticos: maropitant (Cerenia), ondansetrón. Gastroprotectores: omeprazol, sucralfato. NUNCA dar ibuprofeno o paracetamol a gatos.",
        keywords: ["medicamento", "antibiotico", "antiinflamatorio", "antiparasitario", "dosis", "carprofeno", "meloxicam"],
        priority: 90,
    },
    {
        id: "pharma_toxic_substances",
        notebook: "farmacologia",
        title: "Sustancias tóxicas para mascotas",
        body: "Chocolate (teobromina): tóxico perros, oscuro más peligroso. Xilitol: hipoglucemia severa en perros. Uvas/pasas: falla renal aguda. Cebolla/ajo: anemia hemolítica. Lirios: falla renal aguda en gatos. Paracetamol: metemoglobinemia en gatos. Ibuprofeno: úlcera gástrica y renal en ambas especies. ASPCA Animal Poison Control: (888) 426-4435.",
        keywords: ["toxico", "veneno", "chocolate", "xilitol", "cebolla", "lirio", "paracetamol", "aspca"],
        priority: 95,
    },
    {
        id: "pharma_fda_otc",
        notebook: "farmacologia",
        title: "Regulación FDA y productos OTC en USA",
        body: "FDA Center for Veterinary Medicine regula medicamentos veterinarios. Antibióticos requieren prescripción veterinaria desde 2023 (GFI #263). Flea/tick products OTC: Frontline, Advantage, Seresto. Rx required: Apoquel, Cytopoint, Simparica Trio. Suplementos no regulados como medicamentos. CBD para mascotas no aprobado por FDA.",
        keywords: ["fda", "otc", "prescripcion", "antibiotico", "regulacion", "usa", "cbd", "suplemento"],
        priority: 85,
    },
    // ══════════════════════════════════════════════════════════════════════════
    // 03 — COMPORTAMIENTO
    // ══════════════════════════════════════════════════════════════════════════
    {
        id: "behavior_anxiety",
        notebook: "comportamiento",
        title: "Ansiedad por separación y estrés",
        body: "Signos: destrucción, vocalización excesiva, eliminación inadecuada, salivación. Abordaje: desensibilización gradual a partidas, enriquecimiento ambiental, rutina predecible. Productos: Adaptil (perros), Feliway (gatos). Casos severos: consultar veterinario conductista. Medicación posible: fluoxetina, trazodona (solo con prescripción).",
        keywords: ["ansiedad", "separacion", "estres", "destruccion", "ladrido", "adaptil", "feliway", "conductista"],
        priority: 88,
    },
    {
        id: "behavior_socialization",
        notebook: "comportamiento",
        title: "Socialización y entrenamiento positivo",
        body: "Período crítico de socialización: 3-14 semanas en perros, 2-7 semanas en gatos. Exposición gradual a personas, animales, sonidos, superficies. Refuerzo positivo siempre > castigo. Nunca usar collar de castigo, shock, o dominancia alfa. Clases de puppy kindergarten recomendadas. Continuar socialización toda la vida.",
        keywords: ["socializacion", "entrenamiento", "refuerzo positivo", "cachorro", "puppy", "obediencia"],
        priority: 85,
    },
    {
        id: "behavior_aggression",
        notebook: "comportamiento",
        title: "Agresión y señales de calma",
        body: "Tipos: miedo, territorial, redirigida, por dolor, predatoria. Señales de calma caninas: lamido labios, bostezo, girar cabeza, sentarse. Señales felinas de estrés: cola baja, orejas aplanadas, dilatación pupilar, bufo. NUNCA castigar agresión — empeora. Referir a veterinario conductista certificado (DACVB o CAAB en USA).",
        keywords: ["agresion", "miedo", "territorial", "señales", "calma", "conductista", "dacvb"],
        priority: 82,
    },
    // ══════════════════════════════════════════════════════════════════════════
    // 04 — PRODUCTO (PESSY-specific)
    // ══════════════════════════════════════════════════════════════════════════
    {
        id: "product_triage_flow",
        notebook: "producto",
        title: "Flujo de triage conversacional Pessy",
        body: "Paso 1: Preguntar qué observa el usuario. Paso 2: Recopilar datos (desde cuándo, energía, apetito, cambios visibles). Paso 3: Interpretar sin diagnosticar — lenguaje condicional siempre. Paso 4: Clasificar riesgo interno (LOW/MEDIUM/HIGH). Paso 5: LOW→observar, MEDIUM→observar+vet si continúa, HIGH→recomendar vet. Paso 6: Ofrecer guardar datos y seguimiento.",
        keywords: ["triage", "flujo", "conversacion", "riesgo", "pessy", "consulta"],
        priority: 92,
    },
    {
        id: "product_disclaimer",
        notebook: "producto",
        title: "Disclaimer y tono Pessy",
        body: "Siempre mostrar: 'Pessy brinda orientación general. No reemplaza un veterinario.' Tono: calmo, empático, no-técnico, nunca alarmista. Usar siempre lenguaje condicional: 'Podría ser...', 'Es posible que...', 'Te recomendaría observar...'. NUNCA decir 'Tu mascota tiene X' o 'Debes darle Y'.",
        keywords: ["disclaimer", "tono", "legal", "orientacion", "condicional"],
        priority: 98,
    },
    // ══════════════════════════════════════════════════════════════════════════
    // 05 — NUTRICIÓN
    // ══════════════════════════════════════════════════════════════════════════
    {
        id: "nutrition_basics",
        notebook: "nutricion",
        title: "Nutrición canina y felina básica",
        body: "Perros: omnívoros flexibles. Gatos: carnívoros obligados, necesitan taurina y ácido araquidónico. BCS ideal: 4-5/9. Fórmula RER: 30 × kg + 70 kcal/día. Cachorro: 2-3× RER. Senior: 0.8-1× RER. Agua fresca siempre disponible. Transiciones alimentarias graduales en 7 días mínimo.",
        keywords: ["nutricion", "alimento", "bcs", "rer", "calorias", "peso", "dieta", "taurina"],
        priority: 88,
    },
    {
        id: "nutrition_usa_brands",
        notebook: "nutricion",
        title: "Marcas y regulación alimento USA",
        body: "AAFCO establece estándares nutricionales (no regula directamente). Buscar statement 'complete and balanced' en etiqueta. Marcas premium USA: Royal Canin, Hill's Science Diet, Purina Pro Plan, Eukanuba. Grain-free: FDA investigó correlación con DCM en perros (2018-2023). Raw diets: riesgo Salmonella/E.coli, no recomendadas por AVMA. WSAVA guidelines para selección de alimento.",
        keywords: ["aafco", "alimento", "marca", "grain-free", "dcm", "raw", "usa", "hills", "royal canin", "purina"],
        priority: 85,
    },
    {
        id: "nutrition_special_diets",
        notebook: "nutricion",
        title: "Dietas especiales y restricciones",
        body: "Renal: restricción proteica y fósforo (Hill's k/d, Royal Canin Renal). Hepatica: proteínas de alta digestibilidad, restricción cobre. Gastrointestinal: proteína hidrolizada o novel protein para dieta de eliminación 8 semanas. Diabético: alta fibra, bajo índice glucémico. Urinario: acidificantes o alcalinizantes según tipo de cristal. Siempre bajo supervisión veterinaria.",
        keywords: ["dieta", "renal", "hepatica", "gastrointestinal", "diabetico", "urinario", "hidrolizado", "eliminacion"],
        priority: 82,
    },
    // ══════════════════════════════════════════════════════════════════════════
    // 06 — EMERGENCIAS
    // ══════════════════════════════════════════════════════════════════════════
    {
        id: "emergency_triage",
        notebook: "emergencias",
        title: "Triage de emergencias y signos de alerta",
        body: "Emergencia inmediata: dificultad respiratoria, convulsiones, ingestión de tóxico, trauma grave, hinchazón abdominal súbita (GDV), no puede orinar >12h, sangrado activo profuso. Urgencia (mismas 24h): vómitos repetidos, diarrea sanguinolenta, cojera severa, ojo cerrado/inflamado, fiebre >40°C. Importante: Pessy NO da instrucciones de emergencia. Derivar siempre a veterinario/ER.",
        keywords: ["emergencia", "urgencia", "convulsion", "toxico", "trauma", "gdv", "torsion", "sangrado"],
        priority: 98,
    },
    {
        id: "emergency_usa_resources",
        notebook: "emergencias",
        title: "Recursos de emergencia veterinaria USA",
        body: "ASPCA Animal Poison Control: (888) 426-4435 ($95 fee). Pet Poison Helpline: (855) 764-7661 ($85 fee). Cadenas ER: VCA Emergency, BluePearl, MedVet, SAGE Veterinary Centers. Buscar 'emergency vet near me' para clínicas 24/7 locales. Tener número del ER más cercano guardado. Llevar empaque del tóxico ingerido al vet.",
        keywords: ["aspca", "poison", "emergencia", "er", "vca", "bluepearl", "medvet", "usa", "24/7"],
        priority: 95,
    },
    // ══════════════════════════════════════════════════════════════════════════
    // 07 — BIENESTAR
    // ══════════════════════════════════════════════════════════════════════════
    {
        id: "wellness_daily_routine",
        notebook: "bienestar",
        title: "Rutina diaria de bienestar",
        body: "Ejercicio: perros 30-60 min/día según raza y edad. Gatos: 15-20 min juego activo + enriquecimiento ambiental. Higiene dental: cepillado 2-3x/semana ideal, dental chews diarios. Cuidado de uñas: recorte cada 2-4 semanas. Limpieza oídos: semanal en razas propensas. Baño: cada 4-8 semanas perros, gatos raramente necesitan.",
        keywords: ["ejercicio", "dental", "uñas", "baño", "rutina", "higiene", "oidos", "cepillado"],
        priority: 85,
    },
    {
        id: "wellness_mental_health",
        notebook: "bienestar",
        title: "Salud mental y enriquecimiento ambiental",
        body: "Rutina predecible = menos ansiedad. Enriquecimiento: juguetes puzzle, Kong relleno, snuffle mat, window perch para gatos, rascadores verticales. Socialización continua (no solo cachorro). Señales de depresión: letargia, pérdida de interés, cambios de apetito, aislamiento. Tiempo de calidad > cantidad de juguetes.",
        keywords: ["mental", "enriquecimiento", "puzzle", "kong", "ansiedad", "depresion", "bienestar", "juego"],
        priority: 82,
    },
    {
        id: "wellness_seasonal_safety",
        notebook: "bienestar",
        title: "Seguridad estacional USA",
        body: "Verano: golpe de calor, nunca en auto, paseos temprano/tarde, protección de almohadillas en asfalto caliente. Invierno: anticongelante tóxico (etilenglicol), sal de deshielo irrita patas, hipotermia en razas pequeñas. Julio 4th: estrés por fuegos artificiales, mantener en interior. Halloween: chocolate, xilitol en dulces. Holidays: cuidado con plantas tóxicas (poinsettia, lirios, muérdago).",
        keywords: ["verano", "invierno", "calor", "frio", "estacional", "fuegos artificiales", "halloween", "navidad"],
        priority: 80,
    },
    // ══════════════════════════════════════════════════════════════════════════
    // 08 — COMUNIDAD
    // ══════════════════════════════════════════════════════════════════════════
    {
        id: "community_lost_pets",
        notebook: "comunidad",
        title: "Protocolo de mascotas perdidas",
        body: "Reporte inmediato: foto reciente, última ubicación, collar/microchip info. Alerta geolocalizada a usuarios cercanos (radio configurable). Avistamientos: foto + ubicación + distancia estimada al dueño. Notificación push al reportante. Expandir radio de búsqueda cada 24h si no hay avistamientos. Recomendar: contactar refugios locales, publicar en Nextdoor/Facebook groups, colocar carteles.",
        keywords: ["perdido", "extraviado", "busqueda", "avistamiento", "microchip", "refugio", "alerta"],
        priority: 90,
    },
    {
        id: "community_adoption",
        notebook: "comunidad",
        title: "Sistema de matching de adopción",
        body: "5 factores de compatibilidad: espacio vivienda (25%), experiencia previa (25%), otras mascotas (20%), nivel actividad (15%), horario disponible (15%). Scores: excelente >80%, bueno 60-80%, posible 40-60%, incompatible <40%. Seguimiento post-adopción: check-in a 7 días y 30 días. Recursos de adaptación según especie y edad. Contacto refugio para soporte.",
        keywords: ["adopcion", "matching", "compatibilidad", "refugio", "shelter", "rescue", "foster"],
        priority: 85,
    },
    {
        id: "community_usa_shelters",
        notebook: "comunidad",
        title: "Red de refugios y rescates USA",
        body: "Petfinder.com: base de datos nacional de animales adoptables. Adopt-a-Pet.com: alternativa popular. ASPCA: programas de adopción en NYC y nacional. Best Friends Animal Society: santuario en Utah + programas nacionales. Local humane societies y municipal shelters. Foster-based rescues: cada vez más populares. Costos adopción típicos: $50-$400 incluye esterilización, vacunas, microchip.",
        keywords: ["petfinder", "shelter", "rescue", "aspca", "adopcion", "foster", "humane society", "usa"],
        priority: 80,
    },
    // ══════════════════════════════════════════════════════════════════════════
    // 09 — LUGARES
    // ══════════════════════════════════════════════════════════════════════════
    {
        id: "places_pet_friendly",
        notebook: "lugares",
        title: "Scoring de lugares pet-friendly",
        body: "Categorías: veterinaria, emergencia 24/7, park, pet store, grooming, boarding, training, restaurant pet-friendly. Score basado en: reviews comunidad, verificación de datos, fotos, servicios reportados. Recomendaciones personalizadas según especie, tamaño, necesidades especiales. Filtros: distancia, rating, precio, horario, aceptan razas grandes.",
        keywords: ["lugar", "veterinaria", "park", "pet store", "grooming", "boarding", "pet-friendly", "restaurant"],
        priority: 82,
    },
    {
        id: "places_usa_chains",
        notebook: "lugares",
        title: "Cadenas pet-friendly USA",
        body: "Pet stores: PetSmart (grooming + Banfield vet), Petco (grooming + vet clinics). Veterinarias: Banfield, VCA Animal Hospitals, BluePearl (ER). Dog parks: BarkPark, Sniffspot (private yards). Pet-friendly retail: Home Depot, Lowe's, TJ Maxx, Nordstrom (policy varies by location). Airlines pet policy varía: consultar cada aerolínea.",
        keywords: ["petsmart", "petco", "banfield", "vca", "dog park", "cadena", "tienda", "usa"],
        priority: 78,
    },
    {
        id: "places_housing",
        notebook: "lugares",
        title: "Vivienda pet-friendly USA",
        body: "Fair Housing Act: emotional support animals permitidos sin pet deposit (con carta de profesional de salud mental). ADA service dogs: permitidos en todos los establecimientos públicos. Breed restrictions en housing: pit bull, rottweiler, doberman comúnmente restringidos. Pet rent típico: $25-$100/mes. Pet deposit: $200-$500. Apartments.com y Zillow tienen filtro pet-friendly.",
        keywords: ["vivienda", "housing", "apartment", "pet rent", "deposit", "breed restriction", "esa", "service dog"],
        priority: 75,
    },
];
exports.seedBrainKnowledge = functions
    .runWith({
    timeoutSeconds: 60,
    memory: "256MB",
})
    .region("us-central1")
    .https.onCall(async (_data, context) => {
    // Only authenticated users can seed (or use admin check)
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }
    if (!rateLimiter.perUser(context.auth.uid, 10, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests.");
    if (!rateLimiter.globalLimit("seedBrainKnowledge", 100, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Service is busy.");
    const db = admin.firestore();
    const now = new Date().toISOString();
    // Deactivate all existing notebook_knowledge docs
    const existing = await db
        .collection(COLLECTION)
        .where("active", "==", true)
        .get();
    const deactivateBatch = db.batch();
    for (const doc of existing.docs) {
        deactivateBatch.update(doc.ref, { active: false, deactivated_at: now });
    }
    if (!existing.empty) {
        await deactivateBatch.commit();
    }
    // Write all sections in batches of 500 (Firestore limit)
    const BATCH_SIZE = 450;
    const ids = [];
    let batch = db.batch();
    let batchCount = 0;
    for (const section of NOTEBOOK_SECTIONS) {
        const ref = db.collection(COLLECTION).doc(section.id);
        batch.set(ref, Object.assign(Object.assign({}, section), { active: true, sync_version: "seed_v1_2026-03-28", synced_at: now }));
        ids.push(section.id);
        batchCount++;
        if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }
    if (batchCount > 0) {
        await batch.commit();
    }
    return {
        ok: true,
        seeded: ids.length,
        notebooks: [...new Set(NOTEBOOK_SECTIONS.map((s) => s.notebook))],
        ids,
    };
});
//# sourceMappingURL=seedNotebookKnowledge.js.map