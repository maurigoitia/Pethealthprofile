import * as admin from "firebase-admin";
import {
  PetCandidateProfile,
  PetCandidateScore,
  PetResolutionHints,
  AttachmentMetadata,
  DEFAULT_HUMAN_BLOCKED_SENDER_DOMAINS,
} from "./types";
import {
  asString,
  asRecord,
  normalizeTextForMatch,
  tokenizeIdentity,
  hasExactPhrase,
  hasAnyIdentityToken,
  uniqueNonEmpty,
  listStringValues,
  domainMatches,
  parseDomainListEnv,
} from "./utils";

// ─── Sender domain classification ───────────────────────────────

export function extractSenderDomain(email: string): string {
  const match = email.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
  return match?.[1] || "";
}

export function isVetDomain(email: string): boolean {
  const normalized = email.toLowerCase();
  return (
    normalized.includes("vet") ||
    normalized.includes("veterin") ||
    normalized.includes("clinic") ||
    normalized.includes("clinica") ||
    normalized.includes("hospital")
  );
}

export function isMassMarketingDomain(email: string): boolean {
  const domain = extractSenderDomain(email);
  if (!domain) return false;
  const knownMassDomains = [
    "linkedin.com", "mailchimp.com", "sendgrid.net", "hubspotemail.net",
    "amazon.com", "mercadolibre.com", "mercadopago.com", "facebookmail.com",
    "instagram.com", "tiktok.com", "x.com", "twitter.com", "news.", "newsletter.",
  ];
  return knownMassDomains.some((pattern) => domain.includes(pattern));
}

function isTrustedClinicalDomain(email: string): boolean {
  const domain = extractSenderDomain(email);
  if (!domain) return false;
  const allowlist = parseDomainListEnv("GMAIL_TRUSTED_SENDER_DOMAINS");
  if (allowlist.length === 0) return false;
  return allowlist.some((item) => domainMatches(domain, item));
}

function isTrustedClinicalSenderName(emailHeader: string): boolean {
  const normalized = normalizeTextForMatch(emailHeader);
  if (!normalized) return false;
  const knownTrustedNames = [
    "veterinaria panda", "panda clinica veterinaria", "panda - clinica veterinaria",
    "ecoform", "silvana formoso", "instituto de gastroenterologia veterinaria", "igv",
    "myvete", "lvdiazz",
  ];
  return knownTrustedNames.some((item) => normalized.includes(item));
}

export function isTrustedClinicalSender(emailHeader: string): boolean {
  return isTrustedClinicalDomain(emailHeader) || isTrustedClinicalSenderName(emailHeader);
}

export function isSelfGeneratedPessyEmail(args: {
  subject?: string;
  fromEmail?: string;
  bodyText?: string;
}): boolean {
  const fromEmail = asString(args.fromEmail).toLowerCase();
  const senderDomain = extractSenderDomain(fromEmail);
  const normalizedSubject = normalizeTextForMatch(asString(args.subject));
  const normalizedBody = normalizeTextForMatch(asString(args.bodyText));
  if (senderDomain !== "pessy.app" && senderDomain !== "mail.pessy.app") return false;

  return (
    fromEmail.includes("noreply@pessy.app") ||
    normalizedSubject.includes("pessy") ||
    normalizedBody.includes("abrir pessy") ||
    normalizedBody.includes("equipo pessy") ||
    normalizedBody.includes("ya tenes acceso a pessy") ||
    normalizedBody.includes("ya tenés acceso a pessy")
  );
}

export function isBlockedClinicalDomain(email: string): boolean {
  const domain = extractSenderDomain(email);
  if (!domain) return false;
  const blocklist = uniqueNonEmpty([
    ...DEFAULT_HUMAN_BLOCKED_SENDER_DOMAINS,
    ...parseDomainListEnv("GMAIL_BLOCKED_SENDER_DOMAINS"),
  ]);
  if (blocklist.length === 0) return false;
  return blocklist.some((item) => domainMatches(domain, item));
}

// ─── Species & identity helpers ──────────────────────────────────

export function speciesAliases(species: string): string[] {
  const normalized = normalizeTextForMatch(species);
  if (!normalized) return [];
  if (normalized === "dog" || normalized === "perro" || normalized === "canine" || normalized === "canino") {
    return ["dog", "perro", "canino", "canine"];
  }
  if (normalized === "cat" || normalized === "gato" || normalized === "feline" || normalized === "felino") {
    return ["cat", "gato", "felino", "feline"];
  }
  return [normalized];
}

export function canonicalSpeciesKey(species: string): string | null {
  const aliases = speciesAliases(species);
  if (aliases.includes("dog")) return "dog";
  if (aliases.includes("cat")) return "cat";
  const normalized = normalizeTextForMatch(species);
  return normalized || null;
}

export function inferSpeciesSignalsFromCorpus(corpus: string): string[] {
  const normalized = normalizeTextForMatch(corpus);
  if (!normalized) return [];

  const signals = new Set<string>();
  const signalMap: Array<{ key: string; patterns: string[] }> = [
    { key: "dog", patterns: ["dog", "perro", "canino", "canine", "vacuna canina", "sextuple canina", "parvovirus", "moquillo"] },
    { key: "cat", patterns: ["cat", "gato", "felino", "feline", "triple felina", "leucemia felina", "felv", "vif"] },
  ];

  for (const entry of signalMap) {
    if (entry.patterns.some((pattern) => normalized.includes(normalizeTextForMatch(pattern)))) {
      signals.add(entry.key);
    }
  }

  return [...signals];
}

// ─── Pet matching by signals ─────────────────────────────────────

export function petMatchesByName(corpus: string, pet: Pick<PetCandidateProfile, "name">): boolean {
  const normalizedCorpus = normalizeTextForMatch(corpus);
  if (!normalizedCorpus) return false;
  const normalizedName = normalizeTextForMatch(pet.name);
  if (normalizedName && hasExactPhrase(normalizedCorpus, normalizedName)) return true;
  const nameTokens = tokenizeIdentity(pet.name);
  return nameTokens.length > 0 && hasAnyIdentityToken(normalizedCorpus, nameTokens);
}

export function petMatchesByBreed(corpus: string, pet: Pick<PetCandidateProfile, "breed">): boolean {
  const normalizedCorpus = normalizeTextForMatch(corpus);
  if (!normalizedCorpus) return false;
  const normalizedBreed = normalizeTextForMatch(pet.breed);
  if (normalizedBreed && hasExactPhrase(normalizedCorpus, normalizedBreed)) return true;
  const breedTokens = tokenizeIdentity(pet.breed);
  return breedTokens.length > 0 && hasAnyIdentityToken(normalizedCorpus, breedTokens);
}

export function petMatchesBySpeciesSignal(speciesSignals: string[], pet: Pick<PetCandidateProfile, "species">): boolean {
  const canonicalSpecies = canonicalSpeciesKey(pet.species);
  if (!canonicalSpecies) return false;
  return speciesSignals.includes(canonicalSpecies);
}

// ─── Identity conflict detection ─────────────────────────────────

export function detectPetIdentityConflict(args: {
  pets: PetCandidateProfile[];
  chosenPet: PetCandidateProfile;
  subjectText?: string;
  bodyText?: string;
}): {
  hasConflict: boolean;
  label: "IDENTITY_CONFLICT" | null;
  reasons: string[];
  speciesSignals: string[];
  mentionedPetNames: string[];
} {
  const subjectCorpus = normalizeTextForMatch(asString(args.subjectText));
  const bodyCorpus = normalizeTextForMatch(asString(args.bodyText));
  const fullCorpus = `${subjectCorpus}\n${bodyCorpus}`.trim();
  if (!fullCorpus) {
    return { hasConflict: false, label: null, reasons: [], speciesSignals: [], mentionedPetNames: [] };
  }

  const reasons: string[] = [];
  const speciesSignals = inferSpeciesSignalsFromCorpus(fullCorpus);
  const mentionedPets = args.pets.filter((pet) => petMatchesByName(fullCorpus, pet));
  const mentionedPetNames = uniqueNonEmpty(mentionedPets.map((pet) => pet.name));
  const chosenSpecies = canonicalSpeciesKey(args.chosenPet.species);

  if (mentionedPets.some((pet) => pet.id !== args.chosenPet.id)) {
    const otherNames = uniqueNonEmpty(mentionedPets.filter((pet) => pet.id !== args.chosenPet.id).map((pet) => pet.name));
    reasons.push(`other_pet_name_mentioned:${otherNames.join("|")}`);
  }

  if (speciesSignals.length > 0 && chosenSpecies && !speciesSignals.includes(chosenSpecies)) {
    reasons.push(`species_conflict:${chosenSpecies}->${speciesSignals.join("|")}`);
  }

  const uniqueSpeciesMatch =
    speciesSignals.length > 0 ? args.pets.filter((pet) => petMatchesBySpeciesSignal(speciesSignals, pet)) : [];
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

export async function resolvePetConditionHints(petId: string, petData: Record<string, unknown>): Promise<string[]> {
  const direct = uniqueNonEmpty([
    ...listStringValues(petData.knownConditions),
    ...listStringValues(petData.known_conditions),
    ...listStringValues(petData.chronic_conditions),
  ]);
  if (direct.length > 0) return direct.slice(0, 8);

  try {
    const snap = await admin.firestore().collection("clinical_conditions").where("petId", "==", petId).limit(8).get();
    const fromConditions = snap.docs
      .map((doc) => {
        const row = asRecord(doc.data());
        return asString(row.normalizedName) || asString(row.name) || asString(row.title);
      })
      .filter(Boolean);
    return uniqueNonEmpty(fromConditions).slice(0, 8);
  } catch {
    return [];
  }
}

// ─── Scoring engine ──────────────────────────────────────────────

export function scorePetCandidate(args: {
  subjectCorpus: string;
  bodyCorpus: string;
  pet: PetCandidateProfile;
}): PetCandidateScore {
  const { subjectCorpus, bodyCorpus, pet } = args;
  const fullCorpus = `${subjectCorpus}\n${bodyCorpus}`.trim();
  let score = 0;
  let anchors = 0;
  const reasons: string[] = [];

  const add = (value: number, reason: string, anchor = false) => {
    score += value;
    if (anchor) anchors += 1;
    reasons.push(reason);
  };

  const name = normalizeTextForMatch(pet.name);
  const breed = normalizeTextForMatch(pet.breed);
  const conditionHints = pet.knownConditions.map((entry) => normalizeTextForMatch(entry)).filter(Boolean);
  const nameTokens = tokenizeIdentity(pet.name);
  const breedTokens = tokenizeIdentity(pet.breed);
  const speciesHints = speciesAliases(pet.species);
  const corpusSpeciesSignals = inferSpeciesSignalsFromCorpus(fullCorpus);
  const canonicalPetSpecies = canonicalSpeciesKey(pet.species);

  if (name && hasExactPhrase(subjectCorpus, name)) add(140, `name_subject:${name}`, true);
  else if (name && hasExactPhrase(bodyCorpus, name)) add(110, `name_body:${name}`, true);
  else if (nameTokens.length > 0 && hasAnyIdentityToken(subjectCorpus, nameTokens)) add(90, `name_token_subject:${nameTokens[0]}`, true);
  else if (nameTokens.length > 0 && hasAnyIdentityToken(bodyCorpus, nameTokens)) add(65, `name_token_body:${nameTokens[0]}`, true);

  if (breed && hasExactPhrase(subjectCorpus, breed)) add(50, `breed_subject:${breed}`, true);
  else if (breed && hasExactPhrase(bodyCorpus, breed)) add(35, `breed_body:${breed}`, true);
  else if (breedTokens.length > 0 && hasAnyIdentityToken(bodyCorpus, breedTokens)) add(18, `breed_token:${breedTokens[0]}`);

  if (speciesHints.some((alias) => hasExactPhrase(subjectCorpus, alias))) add(22, `species_subject:${pet.species}`);
  else if (speciesHints.some((alias) => hasExactPhrase(bodyCorpus, alias))) add(12, `species_body:${pet.species}`);
  if (corpusSpeciesSignals.length > 0 && canonicalPetSpecies && !corpusSpeciesSignals.includes(canonicalPetSpecies)) {
    add(-55, `species_exclusion:${canonicalPetSpecies}->${corpusSpeciesSignals.join("|")}`);
  }

  for (const condition of conditionHints.slice(0, 3)) {
    if (condition.length < 4) continue;
    if (hasExactPhrase(subjectCorpus, condition)) { add(48, `condition_subject:${condition}`, true); continue; }
    if (hasExactPhrase(bodyCorpus, condition)) { add(34, `condition_body:${condition}`, true); }
  }

  return { pet, score, anchors, reasons };
}

// ─── Main resolution: choose best pet ────────────────────────────

export function choosePetByHints(args: {
  pets: PetCandidateProfile[];
  hints?: PetResolutionHints | null;
}): PetCandidateScore | null {
  const subjectCorpus = normalizeTextForMatch(asString(args.hints?.subjectText));
  const bodyCorpus = normalizeTextForMatch(asString(args.hints?.bodyText));
  const fullCorpus = `${subjectCorpus}\n${bodyCorpus}`.trim();
  if (!subjectCorpus && !bodyCorpus) return null;

  const namedMatches = args.pets.filter((pet) => petMatchesByName(fullCorpus, pet));
  if (namedMatches.length === 1) {
    const forced = scorePetCandidate({ subjectCorpus, bodyCorpus, pet: namedMatches[0] });
    return {
      ...forced,
      score: Math.max(forced.score, 120),
      anchors: Math.max(forced.anchors, 1),
      reasons: uniqueNonEmpty([...forced.reasons, `unique_name_match:${namedMatches[0].name}`]).slice(0, 8),
    };
  }

  const breedMatches = args.pets.filter((pet) => petMatchesByBreed(fullCorpus, pet));
  if (namedMatches.length === 0 && breedMatches.length === 1) {
    const forced = scorePetCandidate({ subjectCorpus, bodyCorpus, pet: breedMatches[0] });
    return {
      ...forced,
      score: Math.max(forced.score, 88),
      anchors: Math.max(forced.anchors, 1),
      reasons: uniqueNonEmpty([...forced.reasons, `unique_breed_match:${breedMatches[0].breed}`]).slice(0, 8),
    };
  }

  const speciesSignals = inferSpeciesSignalsFromCorpus(fullCorpus);
  const speciesMatches = speciesSignals.length > 0
    ? args.pets.filter((pet) => petMatchesBySpeciesSignal(speciesSignals, pet))
    : [];
  if (namedMatches.length === 0 && breedMatches.length === 0 && speciesMatches.length === 1) {
    const forced = scorePetCandidate({ subjectCorpus, bodyCorpus, pet: speciesMatches[0] });
    return {
      ...forced,
      score: Math.max(forced.score, 72),
      anchors: Math.max(forced.anchors, 1),
      reasons: uniqueNonEmpty([...forced.reasons, `unique_species_match:${speciesMatches[0].species}`]).slice(0, 8),
    };
  }

  const ranked = args.pets
    .map((pet) => scorePetCandidate({ subjectCorpus, bodyCorpus, pet }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score < 60 || best.anchors === 0) return null;
  if (second && second.score > 0 && best.score - second.score < 25) return null;
  if (best.anchors < 2 && best.score < 95) return null;
  return best;
}

// ─── Clinical signal detection ───────────────────────────────────

export function attachmentNamesContainClinicalSignal(metadata: AttachmentMetadata[]): boolean {
  const joined = normalizeTextForMatch(metadata.map((row) => row.filename).join(" "));
  if (!joined) return false;
  return /\b(receta|prescrip|estudio|analisis|informe|laboratorio|hemograma|bioquim|perfil\s+hep|perfil\s+renal|quimica\s+sanguinea|sangre|radiograf|ecograf|ecocard|doppler|ultrasound|ecg|historiaclinica|historia.?clinic|clinicavet|resultado)\b/i.test(
    joined
  );
}

export function hasStrongHumanHealthcareSignal(text: string): boolean {
  const normalized = normalizeTextForMatch(text);
  if (!normalized) return false;
  const pattern =
    /\b(huesped|vih|hiv|infectologia|infectolog|obra social|prep|hepati(?:tis)?|paciente humano|paciente adulto|adulto mayor|turno medico|turno médico|medicina humana|clinica humana|clínica humana|oncologia humana|ginecolog|urolog|mastograf|mamograf|papanicolau|pap smear|colonoscop|endoscop|resonancia de cerebro|tomografia de torax humano|tomografía de tórax humano|hospital italiano|hospital aleman|hospital alemán|sanatorio|osde|swiss medical|medicus|galeno|omint)\b/;
  return pattern.test(normalized);
}

export function hasStrongVeterinaryEvidence(args: {
  subject?: string;
  fromEmail?: string;
  bodyText?: string;
  attachmentMetadata?: AttachmentMetadata[];
}): boolean {
  const haystack = normalizeTextForMatch(
    [
      asString(args.subject), asString(args.fromEmail), asString(args.bodyText),
      ...(args.attachmentMetadata || []).flatMap((row) => [row.filename, row.mimetype, row.normalized_mimetype || ""]),
    ].join(" ")
  );
  if (!haystack) return false;
  if (attachmentNamesContainClinicalSignal(args.attachmentMetadata || [])) return true;
  if (isTrustedClinicalSender(asString(args.fromEmail)) || isVetDomain(asString(args.fromEmail))) return true;
  return /\b(veterinari|vet\b|canino|canina|felino|felina|mascota|thor|loki|perro|gato|ecografia veterinaria|radiografia veterinaria|vacuna canina|vacuna felina|placa de torax|placa de tórax|ecocard|electrocard|rx|hemograma|bioquim|perfil hep|perfil renal|quimica sanguinea|analisis de sangre|extraccion de sangre|sangre|doppler)\b/i.test(
    haystack
  );
}

export function hasVeterinaryAdministrativeOnlySignal(args: {
  subject?: string;
  fromEmail?: string;
  bodyText?: string;
  attachmentMetadata?: AttachmentMetadata[];
}): boolean {
  const haystack = normalizeTextForMatch(
    [
      asString(args.subject),
      asString(args.fromEmail),
      asString(args.bodyText),
      ...(args.attachmentMetadata || []).map((row) => row.filename),
    ].join(" ")
  );
  if (!haystack) return false;

  const administrativeSignal =
    /\b(comprobante(?:s)?|comprobantes de cliente|factura|invoice|payment|pago|recibo|cae|iva|importe|subtotal|total|afip|encuesta|consumos)\b/.test(
      haystack
    );
  if (!administrativeSignal) return false;

  const clinicalSignal =
    /\b(turno|consulta|control|recordatorio|confirmacion|confirmación|cancelacion|cancelación|estudio|resultado|radiograf|ecograf|ecocard|doppler|electrocard|ecg|rx\b|laboratorio|hemograma|bioquim|analisis de sangre|extraccion de sangre|perfil hep|perfil renal|sangre|receta|prescrip|medicaci[oó]n|tratamiento|vacuna)\b/i.test(
      haystack
    ) || attachmentNamesContainClinicalSignal(args.attachmentMetadata || []);

  return !clinicalSignal;
}

export function hasStrongNonClinicalSignal(text: string): boolean {
  const normalized = normalizeTextForMatch(text);
  if (!normalized) return false;
  const pattern =
    /\b(delivery status notification|mail delivery subsystem|newsletter|unsubscribe|linkedin|mercadopago|mercado pago|supervielle|banco|tarjeta|factura|invoice|pedido|shipping|envio|orden de compra|webinar|meeting invite|zoom|promocion|promoción|promo|oferta|descuento|alimento|balanceado|petshop|pet shop|accesorios)\b/;
  return pattern.test(normalized);
}

// ─── Candidate email classifier ─────────────────────────────────

export function isCandidateClinicalEmail(args: {
  subject: string;
  fromEmail: string;
  bodyText: string;
  attachmentCount: number;
  attachmentMetadata: AttachmentMetadata[];
  petName: string;
  petId: string;
}): boolean {
  const corpus = `${args.subject}\n${args.bodyText}`;
  const normalizedCorpus = normalizeTextForMatch(corpus);
  const normalizedFrom = normalizeTextForMatch(args.fromEmail);
  const attachmentNames = normalizeTextForMatch(args.attachmentMetadata.map((row) => row.filename).join(" "));
  const fullSearchCorpus = `${normalizedCorpus}\n${normalizedFrom}\n${attachmentNames}`;

  const keywordPattern =
    /\b(appointment|turno|diagnosis|diagnostico|vaccine|vacuna|lab|laboratorio|hemograma|bioquim|analisis de sangre|extraccion de sangre|perfil hep|perfil renal|sangre|rx|receta|veterinary|veterinaria|veterinario|radiograf|ecocardiograma|ecocardiograma|electrocardiograma|doppler|ultrasound|ecografia|\beco\b|tratamiento|medicacion|consulta|hospital|nombre del paciente)\b/i;
  const hasClinicalKeywords = keywordPattern.test(fullSearchCorpus);
  const hasVetSender = isVetDomain(args.fromEmail);
  const hasTrustedSender = isTrustedClinicalSender(args.fromEmail);
  const hasBlockedSender = isBlockedClinicalDomain(args.fromEmail);
  const isSelfGenerated = isSelfGeneratedPessyEmail(args);
  const hasAttachment = args.attachmentCount > 0;
  const hasClinicalAttachment = attachmentNamesContainClinicalSignal(args.attachmentMetadata);
  const MIN_LIGHTWEIGHT_BODY_LENGTH = 80;
  const hasLongBody = normalizeTextForMatch(args.bodyText).length >= MIN_LIGHTWEIGHT_BODY_LENGTH;
  const notMassMarketingSender = !isMassMarketingDomain(args.fromEmail);
  const hasNonClinicalNoise = hasStrongNonClinicalSignal(`${args.subject}\n${args.fromEmail}\n${args.bodyText}`);
  const hasHumanHealthcareNoise = hasStrongHumanHealthcareSignal(`${args.subject}\n${args.fromEmail}\n${args.bodyText}`);
  const hasPromoSignal = /\b(promocion|promoción|promo|oferta|descuento|alimento|balanceado|accesorios)\b/.test(fullSearchCorpus);
  const hasAdministrativeOnlySignal = /\b(comprobante|factura|invoice|payment|pago|recibo)\b/.test(fullSearchCorpus);
  const hasVeterinaryEvidence = hasStrongVeterinaryEvidence({
    subject: args.subject, fromEmail: args.fromEmail, bodyText: args.bodyText, attachmentMetadata: args.attachmentMetadata,
  });

  const petTokens = [...tokenizeIdentity(args.petName), ...tokenizeIdentity(args.petId)];
  const hasPetMention = petTokens.length > 0 && hasAnyIdentityToken(fullSearchCorpus, petTokens);

  let score = 0;
  if (hasVetSender) score += 3;
  if (hasTrustedSender) score += 4;
  if (hasClinicalKeywords) score += 3;
  if (hasClinicalAttachment) score += 3;
  if (hasPetMention) score += 2;
  if (hasAttachment) score += 1;
  if (hasLongBody && hasPetMention) score += 1;
  if (hasBlockedSender) score -= 6;
  if (!notMassMarketingSender) score -= 4;
  if (hasNonClinicalNoise) score -= 3;
  if (hasHumanHealthcareNoise) score -= 5;

  const hasClinicalAnchor = hasClinicalKeywords || hasClinicalAttachment || hasVetSender || hasTrustedSender;

  if (isSelfGenerated) return false;
  if (hasBlockedSender && !hasClinicalAttachment && !hasPetMention) return false;
  if (hasHumanHealthcareNoise && !hasVeterinaryEvidence && !hasPetMention) return false;
  if (hasNonClinicalNoise && !hasClinicalAttachment && !hasVetSender && !hasTrustedSender) return false;
  if (hasPromoSignal && !hasClinicalAttachment && !hasTrustedSender) return false;
  if (hasAdministrativeOnlySignal && !hasClinicalAttachment && !hasClinicalKeywords) return false;
  if (hasTrustedSender && hasClinicalAttachment) return true;
  if (score >= 4 && (hasClinicalAnchor || (hasPetMention && hasAttachment))) return true;

  return false;
}
