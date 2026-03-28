"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSenderDomain = extractSenderDomain;
exports.isVetDomain = isVetDomain;
exports.isMassMarketingDomain = isMassMarketingDomain;
exports.isTrustedClinicalSender = isTrustedClinicalSender;
exports.isBlockedClinicalDomain = isBlockedClinicalDomain;
exports.speciesAliases = speciesAliases;
exports.canonicalSpeciesKey = canonicalSpeciesKey;
exports.inferSpeciesSignalsFromCorpus = inferSpeciesSignalsFromCorpus;
exports.petMatchesByName = petMatchesByName;
exports.petMatchesByBreed = petMatchesByBreed;
exports.petMatchesBySpeciesSignal = petMatchesBySpeciesSignal;
exports.detectPetIdentityConflict = detectPetIdentityConflict;
exports.resolvePetConditionHints = resolvePetConditionHints;
exports.scorePetCandidate = scorePetCandidate;
exports.choosePetByHints = choosePetByHints;
exports.attachmentNamesContainClinicalSignal = attachmentNamesContainClinicalSignal;
exports.hasStrongHumanHealthcareSignal = hasStrongHumanHealthcareSignal;
exports.hasStrongVeterinaryEvidence = hasStrongVeterinaryEvidence;
exports.hasStrongNonClinicalSignal = hasStrongNonClinicalSignal;
exports.isCandidateClinicalEmail = isCandidateClinicalEmail;
const admin = require("firebase-admin");
const types_1 = require("./types");
const utils_1 = require("./utils");
// ─── Sender domain classification ───────────────────────────────
function extractSenderDomain(email) {
    const match = email.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
    return (match === null || match === void 0 ? void 0 : match[1]) || "";
}
function isVetDomain(email) {
    const normalized = email.toLowerCase();
    return (normalized.includes("vet") ||
        normalized.includes("veterin") ||
        normalized.includes("clinic") ||
        normalized.includes("clinica") ||
        normalized.includes("hospital"));
}
function isMassMarketingDomain(email) {
    const domain = extractSenderDomain(email);
    if (!domain)
        return false;
    const knownMassDomains = [
        "linkedin.com", "mailchimp.com", "sendgrid.net", "hubspotemail.net",
        "amazon.com", "mercadolibre.com", "mercadopago.com", "facebookmail.com",
        "instagram.com", "tiktok.com", "x.com", "twitter.com", "news.", "newsletter.",
    ];
    return knownMassDomains.some((pattern) => domain.includes(pattern));
}
function isTrustedClinicalDomain(email) {
    const domain = extractSenderDomain(email);
    if (!domain)
        return false;
    const allowlist = (0, utils_1.parseDomainListEnv)("GMAIL_TRUSTED_SENDER_DOMAINS");
    if (allowlist.length === 0)
        return false;
    return allowlist.some((item) => (0, utils_1.domainMatches)(domain, item));
}
function isTrustedClinicalSenderName(emailHeader) {
    const normalized = (0, utils_1.normalizeTextForMatch)(emailHeader);
    if (!normalized)
        return false;
    const knownTrustedNames = [
        "veterinaria panda", "panda clinica veterinaria", "panda - clinica veterinaria",
        "ecoform", "silvana formoso", "instituto de gastroenterologia veterinaria", "igv",
    ];
    return knownTrustedNames.some((item) => normalized.includes(item));
}
function isTrustedClinicalSender(emailHeader) {
    return isTrustedClinicalDomain(emailHeader) || isTrustedClinicalSenderName(emailHeader);
}
function isBlockedClinicalDomain(email) {
    const domain = extractSenderDomain(email);
    if (!domain)
        return false;
    const blocklist = (0, utils_1.uniqueNonEmpty)([
        ...types_1.DEFAULT_HUMAN_BLOCKED_SENDER_DOMAINS,
        ...(0, utils_1.parseDomainListEnv)("GMAIL_BLOCKED_SENDER_DOMAINS"),
    ]);
    if (blocklist.length === 0)
        return false;
    return blocklist.some((item) => (0, utils_1.domainMatches)(domain, item));
}
// ─── Species & identity helpers ──────────────────────────────────
function speciesAliases(species) {
    const normalized = (0, utils_1.normalizeTextForMatch)(species);
    if (!normalized)
        return [];
    if (normalized === "dog" || normalized === "perro" || normalized === "canine" || normalized === "canino") {
        return ["dog", "perro", "canino", "canine"];
    }
    if (normalized === "cat" || normalized === "gato" || normalized === "feline" || normalized === "felino") {
        return ["cat", "gato", "felino", "feline"];
    }
    return [normalized];
}
function canonicalSpeciesKey(species) {
    const aliases = speciesAliases(species);
    if (aliases.includes("dog"))
        return "dog";
    if (aliases.includes("cat"))
        return "cat";
    const normalized = (0, utils_1.normalizeTextForMatch)(species);
    return normalized || null;
}
function inferSpeciesSignalsFromCorpus(corpus) {
    const normalized = (0, utils_1.normalizeTextForMatch)(corpus);
    if (!normalized)
        return [];
    const signals = new Set();
    const signalMap = [
        { key: "dog", patterns: ["dog", "perro", "canino", "canine", "vacuna canina", "sextuple canina", "parvovirus", "moquillo"] },
        { key: "cat", patterns: ["cat", "gato", "felino", "feline", "triple felina", "leucemia felina", "felv", "vif"] },
    ];
    for (const entry of signalMap) {
        if (entry.patterns.some((pattern) => normalized.includes((0, utils_1.normalizeTextForMatch)(pattern)))) {
            signals.add(entry.key);
        }
    }
    return [...signals];
}
// ─── Pet matching by signals ─────────────────────────────────────
function petMatchesByName(corpus, pet) {
    const normalizedCorpus = (0, utils_1.normalizeTextForMatch)(corpus);
    if (!normalizedCorpus)
        return false;
    const normalizedName = (0, utils_1.normalizeTextForMatch)(pet.name);
    if (normalizedName && (0, utils_1.hasExactPhrase)(normalizedCorpus, normalizedName))
        return true;
    const nameTokens = (0, utils_1.tokenizeIdentity)(pet.name);
    return nameTokens.length > 0 && (0, utils_1.hasAnyIdentityToken)(normalizedCorpus, nameTokens);
}
function petMatchesByBreed(corpus, pet) {
    const normalizedCorpus = (0, utils_1.normalizeTextForMatch)(corpus);
    if (!normalizedCorpus)
        return false;
    const normalizedBreed = (0, utils_1.normalizeTextForMatch)(pet.breed);
    if (normalizedBreed && (0, utils_1.hasExactPhrase)(normalizedCorpus, normalizedBreed))
        return true;
    const breedTokens = (0, utils_1.tokenizeIdentity)(pet.breed);
    return breedTokens.length > 0 && (0, utils_1.hasAnyIdentityToken)(normalizedCorpus, breedTokens);
}
function petMatchesBySpeciesSignal(speciesSignals, pet) {
    const canonicalSpecies = canonicalSpeciesKey(pet.species);
    if (!canonicalSpecies)
        return false;
    return speciesSignals.includes(canonicalSpecies);
}
// ─── Identity conflict detection ─────────────────────────────────
function detectPetIdentityConflict(args) {
    const subjectCorpus = (0, utils_1.normalizeTextForMatch)((0, utils_1.asString)(args.subjectText));
    const bodyCorpus = (0, utils_1.normalizeTextForMatch)((0, utils_1.asString)(args.bodyText));
    const fullCorpus = `${subjectCorpus}\n${bodyCorpus}`.trim();
    if (!fullCorpus) {
        return { hasConflict: false, label: null, reasons: [], speciesSignals: [], mentionedPetNames: [] };
    }
    const reasons = [];
    const speciesSignals = inferSpeciesSignalsFromCorpus(fullCorpus);
    const mentionedPets = args.pets.filter((pet) => petMatchesByName(fullCorpus, pet));
    const mentionedPetNames = (0, utils_1.uniqueNonEmpty)(mentionedPets.map((pet) => pet.name));
    const chosenSpecies = canonicalSpeciesKey(args.chosenPet.species);
    if (mentionedPets.some((pet) => pet.id !== args.chosenPet.id)) {
        const otherNames = (0, utils_1.uniqueNonEmpty)(mentionedPets.filter((pet) => pet.id !== args.chosenPet.id).map((pet) => pet.name));
        reasons.push(`other_pet_name_mentioned:${otherNames.join("|")}`);
    }
    if (speciesSignals.length > 0 && chosenSpecies && !speciesSignals.includes(chosenSpecies)) {
        reasons.push(`species_conflict:${chosenSpecies}->${speciesSignals.join("|")}`);
    }
    const uniqueSpeciesMatch = speciesSignals.length > 0 ? args.pets.filter((pet) => petMatchesBySpeciesSignal(speciesSignals, pet)) : [];
    if (uniqueSpeciesMatch.length === 1 && uniqueSpeciesMatch[0].id !== args.chosenPet.id) {
        reasons.push(`species_points_to_other_pet:${uniqueSpeciesMatch[0].name}`);
    }
    return {
        hasConflict: reasons.length > 0,
        label: reasons.length > 0 ? "IDENTITY_CONFLICT" : null,
        reasons,
        speciesSignals,
        mentionedPetNames,
    };
}
// ─── Pet condition hints from Firestore ──────────────────────────
async function resolvePetConditionHints(petId, petData) {
    const direct = (0, utils_1.uniqueNonEmpty)([
        ...(0, utils_1.listStringValues)(petData.knownConditions),
        ...(0, utils_1.listStringValues)(petData.known_conditions),
        ...(0, utils_1.listStringValues)(petData.chronic_conditions),
    ]);
    if (direct.length > 0)
        return direct.slice(0, 8);
    try {
        const snap = await admin.firestore().collection("clinical_conditions").where("petId", "==", petId).limit(8).get();
        const fromConditions = snap.docs
            .map((doc) => {
            const row = (0, utils_1.asRecord)(doc.data());
            return (0, utils_1.asString)(row.normalizedName) || (0, utils_1.asString)(row.name) || (0, utils_1.asString)(row.title);
        })
            .filter(Boolean);
        return (0, utils_1.uniqueNonEmpty)(fromConditions).slice(0, 8);
    }
    catch (_a) {
        return [];
    }
}
// ─── Scoring engine ──────────────────────────────────────────────
function scorePetCandidate(args) {
    const { subjectCorpus, bodyCorpus, pet } = args;
    const fullCorpus = `${subjectCorpus}\n${bodyCorpus}`.trim();
    let score = 0;
    let anchors = 0;
    const reasons = [];
    const add = (value, reason, anchor = false) => {
        score += value;
        if (anchor)
            anchors += 1;
        reasons.push(reason);
    };
    const name = (0, utils_1.normalizeTextForMatch)(pet.name);
    const breed = (0, utils_1.normalizeTextForMatch)(pet.breed);
    const conditionHints = pet.knownConditions.map((entry) => (0, utils_1.normalizeTextForMatch)(entry)).filter(Boolean);
    const nameTokens = (0, utils_1.tokenizeIdentity)(pet.name);
    const breedTokens = (0, utils_1.tokenizeIdentity)(pet.breed);
    const speciesHints = speciesAliases(pet.species);
    const corpusSpeciesSignals = inferSpeciesSignalsFromCorpus(fullCorpus);
    const canonicalPetSpecies = canonicalSpeciesKey(pet.species);
    if (name && (0, utils_1.hasExactPhrase)(subjectCorpus, name))
        add(140, `name_subject:${name}`, true);
    else if (name && (0, utils_1.hasExactPhrase)(bodyCorpus, name))
        add(110, `name_body:${name}`, true);
    else if (nameTokens.length > 0 && (0, utils_1.hasAnyIdentityToken)(subjectCorpus, nameTokens))
        add(90, `name_token_subject:${nameTokens[0]}`, true);
    else if (nameTokens.length > 0 && (0, utils_1.hasAnyIdentityToken)(bodyCorpus, nameTokens))
        add(65, `name_token_body:${nameTokens[0]}`, true);
    if (breed && (0, utils_1.hasExactPhrase)(subjectCorpus, breed))
        add(50, `breed_subject:${breed}`, true);
    else if (breed && (0, utils_1.hasExactPhrase)(bodyCorpus, breed))
        add(35, `breed_body:${breed}`, true);
    else if (breedTokens.length > 0 && (0, utils_1.hasAnyIdentityToken)(bodyCorpus, breedTokens))
        add(18, `breed_token:${breedTokens[0]}`);
    if (speciesHints.some((alias) => (0, utils_1.hasExactPhrase)(subjectCorpus, alias)))
        add(22, `species_subject:${pet.species}`);
    else if (speciesHints.some((alias) => (0, utils_1.hasExactPhrase)(bodyCorpus, alias)))
        add(12, `species_body:${pet.species}`);
    if (corpusSpeciesSignals.length > 0 && canonicalPetSpecies && !corpusSpeciesSignals.includes(canonicalPetSpecies)) {
        add(-55, `species_exclusion:${canonicalPetSpecies}->${corpusSpeciesSignals.join("|")}`);
    }
    for (const condition of conditionHints.slice(0, 3)) {
        if (condition.length < 4)
            continue;
        if ((0, utils_1.hasExactPhrase)(subjectCorpus, condition)) {
            add(48, `condition_subject:${condition}`, true);
            continue;
        }
        if ((0, utils_1.hasExactPhrase)(bodyCorpus, condition)) {
            add(34, `condition_body:${condition}`, true);
        }
    }
    return { pet, score, anchors, reasons };
}
// ─── Main resolution: choose best pet ────────────────────────────
function choosePetByHints(args) {
    var _a, _b;
    const subjectCorpus = (0, utils_1.normalizeTextForMatch)((0, utils_1.asString)((_a = args.hints) === null || _a === void 0 ? void 0 : _a.subjectText));
    const bodyCorpus = (0, utils_1.normalizeTextForMatch)((0, utils_1.asString)((_b = args.hints) === null || _b === void 0 ? void 0 : _b.bodyText));
    const fullCorpus = `${subjectCorpus}\n${bodyCorpus}`.trim();
    if (!subjectCorpus && !bodyCorpus)
        return null;
    const namedMatches = args.pets.filter((pet) => petMatchesByName(fullCorpus, pet));
    if (namedMatches.length === 1) {
        const forced = scorePetCandidate({ subjectCorpus, bodyCorpus, pet: namedMatches[0] });
        return Object.assign(Object.assign({}, forced), { score: Math.max(forced.score, 120), anchors: Math.max(forced.anchors, 1), reasons: (0, utils_1.uniqueNonEmpty)([...forced.reasons, `unique_name_match:${namedMatches[0].name}`]).slice(0, 8) });
    }
    const breedMatches = args.pets.filter((pet) => petMatchesByBreed(fullCorpus, pet));
    if (namedMatches.length === 0 && breedMatches.length === 1) {
        const forced = scorePetCandidate({ subjectCorpus, bodyCorpus, pet: breedMatches[0] });
        return Object.assign(Object.assign({}, forced), { score: Math.max(forced.score, 88), anchors: Math.max(forced.anchors, 1), reasons: (0, utils_1.uniqueNonEmpty)([...forced.reasons, `unique_breed_match:${breedMatches[0].breed}`]).slice(0, 8) });
    }
    const speciesSignals = inferSpeciesSignalsFromCorpus(fullCorpus);
    const speciesMatches = speciesSignals.length > 0
        ? args.pets.filter((pet) => petMatchesBySpeciesSignal(speciesSignals, pet))
        : [];
    if (namedMatches.length === 0 && breedMatches.length === 0 && speciesMatches.length === 1) {
        const forced = scorePetCandidate({ subjectCorpus, bodyCorpus, pet: speciesMatches[0] });
        return Object.assign(Object.assign({}, forced), { score: Math.max(forced.score, 72), anchors: Math.max(forced.anchors, 1), reasons: (0, utils_1.uniqueNonEmpty)([...forced.reasons, `unique_species_match:${speciesMatches[0].species}`]).slice(0, 8) });
    }
    const ranked = args.pets
        .map((pet) => scorePetCandidate({ subjectCorpus, bodyCorpus, pet }))
        .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const second = ranked[1];
    if (!best || best.score < 60 || best.anchors === 0)
        return null;
    if (second && second.score > 0 && best.score - second.score < 25)
        return null;
    if (best.anchors < 2 && best.score < 95)
        return null;
    return best;
}
// ─── Clinical signal detection ───────────────────────────────────
function attachmentNamesContainClinicalSignal(metadata) {
    const joined = (0, utils_1.normalizeTextForMatch)(metadata.map((row) => row.filename).join(" "));
    if (!joined)
        return false;
    return (joined.includes("receta") || joined.includes("prescrip") || joined.includes("estudio") ||
        joined.includes("analisis") || joined.includes("informe") || joined.includes("laboratorio") ||
        joined.includes("radiografia") || joined.includes("ecografia") || joined.includes("ultrasound") ||
        joined.includes("ecg"));
}
function hasStrongHumanHealthcareSignal(text) {
    const normalized = (0, utils_1.normalizeTextForMatch)(text);
    if (!normalized)
        return false;
    const pattern = /\b(huesped|vih|hiv|infectologia|infectolog|obra social|prep|hepati(?:tis)?|paciente humano|paciente adulto|adulto mayor|turno medico|turno médico|medicina humana|clinica humana|clínica humana|oncologia humana|ginecolog|urolog|mastograf|mamograf|papanicolau|pap smear|colonoscop|endoscop|resonancia de cerebro|tomografia de torax humano|tomografía de tórax humano|hospital italiano|hospital aleman|hospital alemán|sanatorio|osde|swiss medical|medicus|galeno|omint)\b/;
    return pattern.test(normalized);
}
function hasStrongVeterinaryEvidence(args) {
    const haystack = (0, utils_1.normalizeTextForMatch)([
        (0, utils_1.asString)(args.subject), (0, utils_1.asString)(args.fromEmail), (0, utils_1.asString)(args.bodyText),
        ...(args.attachmentMetadata || []).flatMap((row) => [row.filename, row.mimetype, row.normalized_mimetype || ""]),
    ].join(" "));
    if (!haystack)
        return false;
    if (attachmentNamesContainClinicalSignal(args.attachmentMetadata || []))
        return true;
    if (isTrustedClinicalSender((0, utils_1.asString)(args.fromEmail)) || isVetDomain((0, utils_1.asString)(args.fromEmail)))
        return true;
    return /\b(veterinari|vet\b|canino|canina|felino|felina|mascota|thor|loki|perro|gato|ecografia veterinaria|radiografia veterinaria|vacuna canina|vacuna felina|placa de torax|placa de tórax|ecocard|electrocard|rx)\b/.test(haystack);
}
function hasStrongNonClinicalSignal(text) {
    const normalized = (0, utils_1.normalizeTextForMatch)(text);
    if (!normalized)
        return false;
    const pattern = /\b(delivery status notification|mail delivery subsystem|newsletter|unsubscribe|linkedin|mercadopago|mercado pago|supervielle|banco|tarjeta|factura|invoice|pedido|shipping|envio|orden de compra|webinar|meeting invite|zoom|promocion|promoción|promo|oferta|descuento|alimento|balanceado|petshop|pet shop|accesorios)\b/;
    return pattern.test(normalized);
}
// ─── Candidate email classifier ─────────────────────────────────
function isCandidateClinicalEmail(args) {
    const corpus = `${args.subject}\n${args.bodyText}`;
    const normalizedCorpus = (0, utils_1.normalizeTextForMatch)(corpus);
    const normalizedFrom = (0, utils_1.normalizeTextForMatch)(args.fromEmail);
    const attachmentNames = (0, utils_1.normalizeTextForMatch)(args.attachmentMetadata.map((row) => row.filename).join(" "));
    const fullSearchCorpus = `${normalizedCorpus}\n${normalizedFrom}\n${attachmentNames}`;
    const keywordPattern = /\b(appointment|turno|diagnosis|diagnostico|vaccine|vacuna|lab|laboratorio|rx|receta|veterinary|veterinaria|veterinario|radiograf|electrocardiograma|ultrasound|ecografia|tratamiento|medicacion|consulta|hospital)\b/;
    const hasClinicalKeywords = keywordPattern.test(fullSearchCorpus);
    const hasVetSender = isVetDomain(args.fromEmail);
    const hasTrustedSender = isTrustedClinicalSender(args.fromEmail);
    const hasBlockedSender = isBlockedClinicalDomain(args.fromEmail);
    const hasAttachment = args.attachmentCount > 0;
    const hasClinicalAttachment = attachmentNamesContainClinicalSignal(args.attachmentMetadata);
    const MIN_LIGHTWEIGHT_BODY_LENGTH = 80;
    const hasLongBody = (0, utils_1.normalizeTextForMatch)(args.bodyText).length >= MIN_LIGHTWEIGHT_BODY_LENGTH;
    const notMassMarketingSender = !isMassMarketingDomain(args.fromEmail);
    const hasNonClinicalNoise = hasStrongNonClinicalSignal(`${args.subject}\n${args.fromEmail}\n${args.bodyText}`);
    const hasHumanHealthcareNoise = hasStrongHumanHealthcareSignal(`${args.subject}\n${args.fromEmail}\n${args.bodyText}`);
    const hasPromoSignal = /\b(promocion|promoción|promo|oferta|descuento|alimento|balanceado|accesorios)\b/.test(fullSearchCorpus);
    const hasAdministrativeOnlySignal = /\b(comprobante|factura|invoice|payment|pago|recibo)\b/.test(fullSearchCorpus);
    const hasVeterinaryEvidence = hasStrongVeterinaryEvidence({
        subject: args.subject, fromEmail: args.fromEmail, bodyText: args.bodyText, attachmentMetadata: args.attachmentMetadata,
    });
    const petTokens = [...(0, utils_1.tokenizeIdentity)(args.petName), ...(0, utils_1.tokenizeIdentity)(args.petId)];
    const hasPetMention = petTokens.length > 0 && (0, utils_1.hasAnyIdentityToken)(fullSearchCorpus, petTokens);
    let score = 0;
    if (hasVetSender)
        score += 3;
    if (hasTrustedSender)
        score += 4;
    if (hasClinicalKeywords)
        score += 3;
    if (hasClinicalAttachment)
        score += 3;
    if (hasPetMention)
        score += 2;
    if (hasAttachment)
        score += 1;
    if (hasLongBody && hasPetMention)
        score += 1;
    if (hasBlockedSender)
        score -= 6;
    if (!notMassMarketingSender)
        score -= 4;
    if (hasNonClinicalNoise)
        score -= 3;
    if (hasHumanHealthcareNoise)
        score -= 5;
    const hasClinicalAnchor = hasClinicalKeywords || hasClinicalAttachment || hasVetSender || hasTrustedSender;
    if (hasBlockedSender && !hasClinicalAttachment && !hasPetMention)
        return false;
    if (hasHumanHealthcareNoise && !hasVeterinaryEvidence && !hasPetMention)
        return false;
    if (hasNonClinicalNoise && !hasClinicalAttachment && !hasVetSender && !hasTrustedSender)
        return false;
    if (hasPromoSignal && !hasClinicalAttachment && !hasTrustedSender)
        return false;
    if (hasAdministrativeOnlySignal && !hasClinicalAttachment && !hasClinicalKeywords)
        return false;
    if (hasTrustedSender && hasClinicalAttachment)
        return true;
    if (score >= 4 && (hasClinicalAnchor || (hasPetMention && hasAttachment)))
        return true;
    return false;
}
//# sourceMappingURL=petMatching.js.map