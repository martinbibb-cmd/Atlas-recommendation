/**
 * buildPrintData.ts
 *
 * Adapts a completed Full Survey engine result into the LabPrintData shape
 * consumed by the three print-layout components (LabPrintCustomer,
 * LabPrintTechnical, LabPrintComparison).
 *
 * Where the engine provides live values (confidence, verdict, evidence) they
 * are used directly.  For comparison-row cells that do not have a direct
 * engine equivalent (longevity, control, eco, future) the adapter falls back
 * to the corresponding placeholder row from CANDIDATE_SYSTEMS / CURRENT_SYSTEM
 * when a matching id is found, or a generic note otherwise.
 */

import type { FullEngineResult } from '../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../ui/fullSurvey/FullSurveyModelV1';
import type { OptionCardV1 } from '../contracts/EngineOutputV1';
import type { LabPrintData, CandidateSystem, HeadingKey } from '../components/lab/labSharedData';
import {
  CANDIDATE_SYSTEMS,
  CURRENT_SYSTEM,
  PLACEHOLDER_CONFIDENCE,
  PLACEHOLDER_CURRENT_SYSTEM,
  PLACEHOLDER_CONFIDENCE_STRIP,
  PLACEHOLDER_RECOMMENDED_SYSTEM_ID,
  PLACEHOLDER_VERDICT,
} from '../components/lab/labSharedData';
import type { ConfidenceStripData } from '../components/lab/LabConfidenceStrip';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map a boiler type from the engine input to a human-readable label. */
function boilerTypeLabel(type?: string): string {
  switch (type) {
    case 'combi':       return 'Gas Combi';
    case 'system':      return 'Gas System Boiler';
    case 'regular':     return 'Regular (Heat-Only) Boiler';
    case 'back_boiler': return 'Back Boiler';
    default:            return PLACEHOLDER_CURRENT_SYSTEM;
  }
}

/** Convert a raw confidence level to a display string. */
function confidenceLabel(level?: string): string {
  if (!level) return PLACEHOLDER_CONFIDENCE;
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/**
 * Map an OptionCardV1 to the CandidateSystem shape used by the print layouts.
 *
 * For rows that cannot be directly derived from the engine output the adapter
 * falls back to the matching entry in CANDIDATE_SYSTEMS (keyed by ID).
 * Engine option IDs ('combi', 'ashp', 'stored_unvented', etc.) align with
 * the labSharedData IDs for 'ashp'.  Other IDs (e.g. 'combi',
 * 'stored_unvented') have no exact match in the two-entry CANDIDATE_SYSTEMS
 * placeholder, so editorial rows (longevity, control, eco, future) will
 * fall back to the generic note.  This is intentional — those rows require
 * manual copy that the engine does not produce.
 */
function optionToCandidate(opt: OptionCardV1): CandidateSystem {
  // Best-effort match to the lab placeholder data for editorial rows we
  // cannot derive from engine physics output alone.
  const placeholder = CANDIDATE_SYSTEMS.find(c => c.id === opt.id);

  const rows: Record<HeadingKey, string> = {
    heat:        opt.heat.headline,
    dhw:         opt.dhw.headline,
    reliability: placeholder?.rows.reliability ?? 'Refer to technical specification.',
    longevity:   placeholder?.rows.longevity   ?? 'Refer to technical specification.',
    disruption:  opt.engineering.headline,
    control:     placeholder?.rows.control     ?? 'Refer to technical specification.',
    eco:         placeholder?.rows.eco         ?? 'Refer to technical specification.',
    future:      placeholder?.rows.future      ?? 'Refer to technical specification.',
  };

  // Build the struggles explanation from the first few engine heat / DHW
  // caution bullets where available; fall back to placeholder editorial copy.
  const strugglesExplanation = [
    ...opt.heat.bullets.slice(0, 2),
    ...opt.dhw.bullets.slice(0, 1),
  ].join(' ');

  // `typedRequirements.mustHave` is the canonical requirements list (PR that
  // introduced it deprecated the flat `requirements[]`); we still check the
  // flat array as a fallback for engine versions that haven't migrated yet.
  const changesExplanation =
    opt.typedRequirements.mustHave.join('. ') ||
    opt.requirements.join('. ')               ||
    placeholder?.explanation.changes          || '—';

  return {
    id: opt.id,
    label: opt.label,
    rows,
    explanation: {
      suits:     opt.why.join(' ')       || placeholder?.explanation.suits     || '—',
      struggles: strugglesExplanation    || placeholder?.explanation.struggles || '—',
      changes:   changesExplanation,
    },
  };
}

// ─── Public adapter ───────────────────────────────────────────────────────────

/**
 * Build a LabPrintData payload from a completed Full Survey engine result.
 *
 * Falls back gracefully: any field that cannot be derived from the engine
 * output is replaced by the corresponding placeholder constant so the print
 * surface always renders something meaningful.
 */
export function buildPrintData(
  result: FullEngineResult,
  input: FullSurveyModelV1,
): LabPrintData {
  const { engineOutput } = result;

  // ── Confidence ────────────────────────────────────────────────────────────
  const confLevel =
    engineOutput.meta?.confidence?.level ??
    engineOutput.verdict?.confidence?.level;
  const confidence = confidenceLabel(confLevel);

  // ── Current system label ──────────────────────────────────────────────────
  const currentSystem = boilerTypeLabel(input.currentSystem?.boiler?.type);

  // ── Headline verdict ──────────────────────────────────────────────────────
  const verdictSystem =
    engineOutput.verdict?.title ??
    engineOutput.recommendation.primary;
  const verdictNote =
    engineOutput.verdict?.primaryReason ??
    engineOutput.recommendation.secondary ??
    '';
  const verdict = { system: verdictSystem, note: verdictNote };

  // ── Recommended system ID ─────────────────────────────────────────────────
  const options = engineOutput.options ?? [];
  const primaryOption = options.find(o => o.status === 'viable') ?? options[0];
  const recommendedSystemId = primaryOption?.id ?? PLACEHOLDER_RECOMMENDED_SYSTEM_ID;

  // ── Confidence strip ──────────────────────────────────────────────────────
  const evidence = engineOutput.evidence ?? [];
  const measured = evidence
    .filter(e => e.source === 'manual')
    .map(e => e.label);
  const inferred = evidence
    .filter(e => e.source === 'assumed' || e.source === 'derived')
    .map(e => e.label);
  const unknowns   = engineOutput.meta?.confidence?.unknowns ?? [];
  const missingEvidence = evidence
    .filter(e => e.source === 'placeholder')
    .map(e => e.label);
  const missing = [
    ...missingEvidence,
    ...unknowns.filter(u => !evidence.some(e => e.label === u)),
  ];
  const unlockBy  = engineOutput.meta?.confidence?.unlockBy;
  const nextStep  = unlockBy?.[0] ?? PLACEHOLDER_CONFIDENCE_STRIP.nextStep;

  const confidenceStrip: ConfidenceStripData = {
    measured: measured.length > 0 ? measured : PLACEHOLDER_CONFIDENCE_STRIP.measured,
    inferred: inferred.length > 0 ? inferred : PLACEHOLDER_CONFIDENCE_STRIP.inferred,
    missing:  missing.length  > 0 ? missing  : PLACEHOLDER_CONFIDENCE_STRIP.missing,
    nextStep,
  };

  // ── Candidate systems ─────────────────────────────────────────────────────
  // Use the first two engine options when available; otherwise fall back to
  // the placeholder editorial copy.
  const candidates: CandidateSystem[] =
    options.length > 0
      ? options.slice(0, 2).map(optionToCandidate)
      : CANDIDATE_SYSTEMS;

  // ── Current system (comparison column) ───────────────────────────────────
  const currentSystemForComparison: CandidateSystem = {
    ...CURRENT_SYSTEM,
    label: `${currentSystem} (Current)`,
  };

  return {
    confidence,
    currentSystem,
    verdict,
    recommendedSystemId,
    confidenceStrip,
    candidates,
    currentSystemForComparison,
  };
}
