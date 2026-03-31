---
name: pessy-mail-canonical-flow
description: Enforce the canonical routing rules for Pessy email ingestion. Use when reviewing or changing Gmail clinical ingestion, deciding whether an ingested email should be discarded, sent to review, persisted as a canonical medical event, projected to appointments/treatments/medications, or allowed into clinical episodes.
---

# Pessy Mail Canonical Flow

Use this skill when the task touches:
- Gmail clinical ingestion
- `medical_events` created from mail
- `gmail_event_reviews`
- `pending_actions` from ingestion
- appointment / treatment / medication projections
- episode compilation from ingested events

## Source of truth

Read first:
- [`guidelines/MAIL_INGESTION_CANONICAL_FLOW.md`](/Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/guidelines/MAIL_INGESTION_CANONICAL_FLOW.md)

Then inspect only the needed code:
- `functions/src/gmail/clinicalIngestion.ts`
- `functions/src/gmail/ingestion/domainIngestion.ts`
- `functions/src/gmail/ingestion/reviewActions.ts`
- `functions/src/clinical/episodeCompiler.ts`

## Non-negotiable rules

1. A mail never writes directly to UI-facing truth.
2. `gmail_ingestion_documents` is operational evidence, not clinical history.
3. `gmail_event_reviews` and `pending_actions` are review surfaces, not final truth.
4. `medical_events` is the canonical clinical event collection for email ingestion.
5. `appointments`, `treatments`, and `medications` are projections from canonical events or explicitly allowed review paths.
6. `clinical_episodes` are always derived later, never written directly from the email worker.
7. If a record does not clearly carry `source = email_import`, do not assume it came from Gmail.

## Routing checklist

For every ingested email, answer in order:

1. Is it clearly non-clinical?
- If yes, keep only `gmail_ingestion_documents` and discard.

2. Is it clinically suggestive but weak, ambiguous, or blocked by login/external link?
- If yes, write `gmail_event_reviews` + `pending_actions.sync_review`.

3. Is it a treatment with missing dose or frequency?
- If yes, create review-safe canonical context:
  - `medical_events` draft/review state
  - `clinical_review_drafts`
  - `pending_actions.incomplete_data`

4. Is it clinically valid and above auto-ingest threshold?
- If yes, write canonical `medical_events`, then project by type.

## Projection rules

- Appointment mail:
  - canonical `medical_events`
  - then `appointments`

- Prescription mail with complete medication data:
  - canonical `medical_events`
  - then `treatments` + `medications`

- Study / lab / vaccine / clinical report:
  - canonical `medical_events`
  - only project more if the domain contract explicitly requires it

## Episode gate

Only events that are not draft/review-required/manual-confirmation should be allowed into `clinical_episodes`.

When changing ingestion, always verify the downstream gate in `episodeCompiler` so review-state mail does not leak into episodes.

## Output expectation

When using this skill, report:
- which collection is the canonical destination
- which collections are only review/operational mirrors
- whether the event should or should not flow into episodes
- which invariant would be broken by the proposed change
