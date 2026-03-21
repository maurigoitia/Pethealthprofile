/**
 * Pet matching & scoring module — multi-pet resolution, species signal
 * detection, identity-conflict analysis, and condition-hint retrieval.
 *
 * Extracted from clinicalIngestion.ts as part of the Strangler Fig refactor.
 */

import * as admin from "firebase-admin";

import type {
  PetCandidateProfile,
  PetCandidateScore,
  PetResolutionHints,
} from "./types";

import {
  asRecord,
  asString,
  canonicalSpeciesKey,
  hasAnyIdentityToken,
  hasExactPhrase,
  inferSpeciesSignalsFromCorpus,
  listStringValues,
  normalizeTextForMatch,
  speciesAliases,
  tokenizeIdentity,
  uniqueNonEmpty,
} from "./utils";

// ---------------------------------------------------------------------------
// Pet name / breed / species matching helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Identity conflict detection
// ---------------------------------------------------------------------------

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
    return {
      hasConflict: false,
      label: null,
      reasons: [],
      speciesSignals: [],
      mentionedPetNames: [],
    };
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
    speciesSignals.length > 0
      ? args.pets.filter((pet) => petMatchesBySpeciesSignal(speciesSignals, pet))
      : [];
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

// ---------------------------------------------------------------------------
// Pet condition hints (Firestore lookup)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Pet candidate scoring
// ---------------------------------------------------------------------------

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
    if (hasExactPhrase(subjectCorpus, condition)) {
      add(48, `condition_subject:${condition}`, true);
      continue;
    }
    if (hasExactPhrase(bodyCorpus, condition)) {
      add(34, `condition_body:${condition}`, true);
    }
  }

  return { pet, score, anchors, reasons };
}

// ---------------------------------------------------------------------------
// Pet resolution by hints (multi-pet disambiguator)
// ---------------------------------------------------------------------------

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
