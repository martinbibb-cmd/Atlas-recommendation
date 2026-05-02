/**
 * RecommendationHub — the primary results composition page.
 *
 * Replaces the previous fail-heavy diagnostic screen with a structured
 * technical recommendation report:
 *
 *   1. Recommendation Summary  — headline decision (why this system fits)
 *      └─ TrustStrip           — compact evidence count + action prompt (PR2)
 *   2. System Comparison       — option cards with new recommendation states
 *   3. Measurement Confidence  — what was measured vs assumed vs missing
 *   4. Evidence & Context      — supporting context bullets
 *
 * Rules:
 * - No engine logic; only presentation and composition.
 * - All data sourced from EngineOutputV1 / FullEngineResult.
 * - No mention of "fail", "rejected", or judgement language in user-facing copy.
 */
import { useState, useEffect, useContext } from 'react';
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { EvidenceItemV1, OptionCardV1 } from '../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { PriorityKey } from '../../features/survey/priorities/prioritiesTypes';
import type { HeatLossState } from '../../features/survey/heatLoss/heatLossTypes';
import type { PrioritiesState } from '../../features/survey/priorities/prioritiesTypes';
import RecommendationCard from '../live/RecommendationCard';
import SystemOptionCard from './SystemOptionCard';
import PerformanceEnablersPanel from '../performance/PerformanceEnablersPanel';
import OperatingPointChart from '../visualizers/OperatingPointChart';
import HouseHeatMapPanel from '../live/HouseHeatMapPanel';
import HotWaterDemandPanel from '../live/HotWaterDemandPanel';
import EvidenceRecommendationPanel from '../recommendation/EvidenceRecommendationPanel';
import PvDemographicsDebugCard from './PvDemographicsDebugCard';
import CanonicalPresentationPage from '../presentation/CanonicalPresentationPage';
import { NoteInfluencePanel } from '../../features/voiceNotes/NoteInfluencePanel';
import { buildNoteInfluenceSummary } from '../../lib/advice/buildNoteInfluenceSummary';
import { VisitContext } from '../../features/visits/VisitProvider';
import {
  trackRecommendationViewed,
  trackRecommendationSelected,
} from '../../features/analytics/analyticsTracker';
import './results.css';
import '../../live/LiveHubPage.css';

interface Props {
  result: FullEngineResult;
  /** Optional survey input — passed to PerformanceEnablersPanel for richer derivation. */
  input?: EngineInputV2_3;
}

// ─── Trust Strip ─────────────────────────────────────────────────────────────

/**
 * Priority order for unlockBy items rendered in the action line.
 *
 * Items are matched via keyword substring (case-insensitive). Unmatched items
 * fall to the end (priority = UNLOCK_PRIORITY.length).
 *
 * Order rationale (most-actionable first):
 *   1. static pressure   — single-point gauge read; unlocks capacity questions
 *   2. dynamic / flow    — flow-rate measurement under load
 *   3. cylinder          — cylinder condition/sizing
 *   4. appliance age / plate HEX — component wear / thermal degradation
 *   5. softer contextual — everything else
 */
const UNLOCK_PRIORITY: ReadonlyArray<RegExp> = [
  /static\s*pressure/i,
  /dynamic|flow/i,
  /cylinder/i,
  /age|plate\s*hex|heat\s*exchanger/i,
];

// ─── Evidence sort priority ───────────────────────────────────────────────────

/**
 * Priority order for evidence items within each display bucket.
 *
 * Matched against `fieldPath + " " + label` (case-insensitive).
 *
 * Order rationale (highest decision value first):
 *   1. mains flow / pressure — capacity gate for combi, unvented, ASHP
 *   2. DHW demand / occupancy — demand gate for combi simultaneity
 *   3. component condition — plate HEX, cylinder
 *   4. appliance age / heat loss / sizing — background context
 *   5. everything else
 */
const EVIDENCE_FIELD_PRIORITY: ReadonlyArray<RegExp> = [
  /mains|pressure/i,
  /bathroom|combi|dhw|occupan/i,
  /cylinder|hex|plate/i,
  /age|heat.?loss|sizing/i,
];

function evidenceRank(item: EvidenceItemV1): number {
  const text = `${item.fieldPath} ${item.label}`;
  for (let i = 0; i < EVIDENCE_FIELD_PRIORITY.length; i++) {
    if (EVIDENCE_FIELD_PRIORITY[i].test(text)) return i;
  }
  return EVIDENCE_FIELD_PRIORITY.length;
}

/**
 * Return a copy of `items` sorted by decision value (highest-impact first).
 * Relative order within each priority band is preserved (stable sort).
 * Exported for unit testing.
 */
export function sortEvidenceItems(items: ReadonlyArray<EvidenceItemV1>): EvidenceItemV1[] {
  return [...items].sort((a, b) => evidenceRank(a) - evidenceRank(b));
}

// ─── Context bullet classification ────────────────────────────────────────────

/**
 * Presentation-only classification of a context summary bullet string into one
 * of three display groups.  Does not change any engine output or contract.
 *
 * Groups:
 *   'site_context'    — occupancy, property size, current system, mains readings,
 *                       bathroom count (low demand), adequate space
 *   'key_constraint'  — simultaneous demand, mains limitation, loft conversion,
 *                       future bathroom, limited space
 *   'general'         — boiler sizing, fabric model, thermal inertia
 */
export type BulletGroup = 'site_context' | 'key_constraint' | 'general';

const KEY_CONSTRAINT_PATTERNS: ReadonlyArray<RegExp> = [
  /simultaneous.*factor/i,
  /loft conversion/i,
  /additional bathroom planned/i,
  /limited space/i,
];

const SITE_CONTEXT_PATTERNS: ReadonlyArray<RegExp> = [
  /\d+\s+(person|people)|\bbedroom|\bbed\s+property/i,
  /single bathroom/i,
  /^current system:/i,
  /adequate space/i,
  /mains (pressure|supply|flow)|^pressure:/i,
];

/**
 * Classify a context bullet string into a display group.
 * Exported for unit testing.
 */
export function classifyContextBullet(bullet: string): BulletGroup {
  for (const pattern of KEY_CONSTRAINT_PATTERNS) {
    if (pattern.test(bullet)) return 'key_constraint';
  }
  for (const pattern of SITE_CONTEXT_PATTERNS) {
    if (pattern.test(bullet)) return 'site_context';
  }
  return 'general';
}

// ─── Next check hint ──────────────────────────────────────────────────────────

/** Result of buildNextCheckHint — a practical field instruction. */
export interface NextCheckHint {
  check: string;
  whyItMatters: string;
}

/**
 * Maps the top unlock item to a concise "Most useful next check" hint.
 * Each entry is [matchPattern, whyItMatters].
 */
const UNLOCK_WHY_HINTS: ReadonlyArray<[RegExp, string]> = [
  [/static\s*pressure/i,            'confirms whether mains-fed hot water options are viable under load'],
  [/dynamic|flow/i,                 'determines whether mains supply can meet simultaneous hot-water demand'],
  [/cylinder/i,                     'indicates whether existing storage can be retained or requires replacement'],
  [/plate\s*hex|heat\s*exchanger/i, 'determines whether on-demand hot water performance is being limited by fouling'],
  [/age/i,                          'helps estimate remaining component life and service requirements'],
];

/**
 * Derive a "Most useful next check" hint from a sorted unlockBy list.
 * Returns null when no unlock items are available.
 * Exported for unit testing.
 */
export function buildNextCheckHint(unlockItems: ReadonlyArray<string>): NextCheckHint | null {
  if (unlockItems.length === 0) return null;
  const top = unlockItems[0];
  for (const [pattern, why] of UNLOCK_WHY_HINTS) {
    if (pattern.test(top)) return { check: top, whyItMatters: why };
  }
  return { check: top, whyItMatters: 'would improve the accuracy of this recommendation' };
}

/**
 * Return a copy of `items` sorted by UNLOCK_PRIORITY keyword order.
 * Items that match no keyword are kept at the end, preserving their
 * original relative order (stable sort).
 */
export function sortUnlockBy(items: ReadonlyArray<string>): string[] {
  const rank = (item: string): number => {
    for (let i = 0; i < UNLOCK_PRIORITY.length; i++) {
      if (UNLOCK_PRIORITY[i].test(item)) return i;
    }
    return UNLOCK_PRIORITY.length;
  };
  return [...items].sort((a, b) => rank(a) - rank(b));
}

// ─── Option card ordering ─────────────────────────────────────────────────────

const CARD_STATUS_RANK: Record<OptionCardV1['status'], number> = {
  viable:   0,
  caution:  1,
  rejected: 2,
};

/**
 * Return a copy of `options` sorted for decision-usefulness:
 *   1. Recommended options (viable) first
 *   2. Viable alternatives with caveats (caution) second
 *   3. Not-recommended options (rejected) last
 *
 * Relative order within each group is preserved (stable sort).
 * Exported for unit testing.
 */
export function sortOptionCards(options: ReadonlyArray<OptionCardV1>): OptionCardV1[] {
  return [...options].sort((a, b) => CARD_STATUS_RANK[a.status] - CARD_STATUS_RANK[b.status]);
}

// ─── Comparison summary sentence ─────────────────────────────────────────────

/**
 * Derives a single comparison-summary sentence for display above the option
 * cards.  Returns null when there is nothing useful to say (e.g. no viable
 * option or only one card).
 *
 * Names the recommended option as the better fit for this home.
 * The full reasoning is shown in the recommendation summary panel above and
 * in each option card's "Why this result" section, so no reason phrase is
 * repeated here.
 *
 * Exported for unit testing.
 */
export function buildComparisonSummary(options: ReadonlyArray<OptionCardV1>): string | null {
  if (options.length < 2) return null;
  const recommended = options.find(o => o.status === 'viable');
  if (!recommended) return null;

  return `For this home, ${recommended.label} is the better fit.`;
}

// ─── Evidence summary line ────────────────────────────────────────────────────

/**
 * Returns a one-sentence partial-evidence summary for display at the top of
 * the Measurement Confidence panel.  Returns null when the evidence mix does
 * not need extra explanation (e.g. all measured, or no evidence at all).
 *
 * Cases:
 *   - No evidence items            → null (panel will be empty anyway)
 *   - All measured (none assumed)  → null (chips alone are sufficient)
 *   - Survey-only (none measured)  → "Based on survey details only — no site measurements recorded."
 *   - Mixed measured + assumed     → "This recommendation is based on N site measurement(s)
 *                                     and M survey-derived value(s)."
 *
 * Exported for unit testing.
 */
export function buildEvidenceSummaryLine(
  evidence: ReadonlyArray<EvidenceItemV1>,
): string | null {
  if (evidence.length === 0) return null;

  const measuredCount = evidence.filter(e => e.source === 'manual').length;
  const assumedCount  = evidence.filter(
    e => e.source === 'assumed' || e.source === 'derived',
  ).length;

  if (measuredCount === 0 && assumedCount === 0) return null;

  if (measuredCount === 0) {
    return 'Based on survey details only — no site measurements recorded.';
  }

  if (assumedCount === 0) {
    return null; // all measured — chips speak for themselves
  }

  const measuredWord = measuredCount === 1 ? 'measurement' : 'measurements';
  const assumedWord  = assumedCount  === 1 ? 'value'       : 'values';
  return (
    `This recommendation is based on ${measuredCount} site ${measuredWord} ` +
    `and ${assumedCount} survey-derived ${assumedWord}.`
  );
}

/**
 * TrustStrip — compact evidence-count strip placed directly below the
 * recommendation summary.
 *
 * Shows three counts (Measured on site / Assumed / Still needed) and,
 * when the engine supplies confidence.unlockBy[], a single action line:
 * "To strengthen this recommendation, measure: …"
 *
 * This is a presentation-only component. All data comes from
 * EngineOutputV1.evidence and EngineOutputV1.meta.confidence.
 */
interface TrustStripProps {
  result: FullEngineResult;
}

function TrustStrip({ result }: TrustStripProps) {
  const { engineOutput } = result;
  const evidence = engineOutput.evidence ?? [];
  const confidence = engineOutput.meta?.confidence ?? engineOutput.verdict?.confidence;
  const unlockBy = sortUnlockBy(confidence?.unlockBy ?? []);

  // Only render when we have something meaningful to show
  if (evidence.length === 0 && unlockBy.length === 0) return null;

  // Single-pass count across all three source buckets
  let measuredCount = 0;
  let assumedCount = 0;
  let stillNeededCount = 0;
  for (const e of evidence) {
    if (e.source === 'manual') measuredCount++;
    else if (e.source === 'assumed' || e.source === 'derived') assumedCount++;
    else if (e.source === 'placeholder') stillNeededCount++;
  }

  // Build the visible count chips — suppress zero-count items to avoid
  // "Measured on site: 0" showing on survey-only journeys.
  const countChips: Array<{ className: string; label: string; count: number }> = [];
  if (measuredCount > 0) {
    countChips.push({
      className: 'rec-trust-strip__count rec-trust-strip__count--measured',
      label: 'Measured on site',
      count: measuredCount,
    });
  }
  if (assumedCount > 0) {
    countChips.push({
      className: 'rec-trust-strip__count rec-trust-strip__count--assumed',
      label: 'Modelled from survey',
      count: assumedCount,
    });
  }
  if (stillNeededCount > 0) {
    countChips.push({
      className: 'rec-trust-strip__count rec-trust-strip__count--needed',
      label: 'Still worth confirming',
      count: stillNeededCount,
    });
  }

  return (
    <div className="rec-trust-strip" aria-label="Evidence summary">
      {countChips.length > 0 && (
        <div className="rec-trust-strip__counts">
          {countChips.map((chip, i) => (
            <span key={chip.label}>
              {i > 0 && <span className="rec-trust-strip__sep" aria-hidden="true">·</span>}
              <span className={chip.className}>
                {chip.label}: <strong>{chip.count}</strong>
              </span>
            </span>
          ))}
        </div>
      )}
      {unlockBy.length > 0 && (
        <p className="rec-trust-strip__action">
          This recommendation would be firmer with:{' '}
          <span className="rec-trust-strip__action-items">
            {unlockBy.join(', ')}
          </span>
        </p>
      )}
    </div>
  );
}

// ─── Measurement Confidence Panel ────────────────────────────────────────────

interface ConfidencePanelProps {
  result: FullEngineResult;
}

function MeasurementConfidencePanel({ result }: ConfidencePanelProps) {
  const { engineOutput } = result;
  const confidence = engineOutput.meta?.confidence ?? engineOutput.verdict?.confidence;
  const evidence = engineOutput.evidence ?? [];

  // Sort evidence items by decision value before bucketing
  const sorted = sortEvidenceItems(evidence);

  const measured = sorted.filter((e: EvidenceItemV1) => e.source === 'manual');
  const assumed  = sorted.filter((e: EvidenceItemV1) => e.source === 'assumed' || e.source === 'derived');
  const missing  = sorted.filter((e: EvidenceItemV1) => e.source === 'placeholder');

  // Don't render if there's nothing to show
  if (!confidence && evidence.length === 0) return null;
  // Also don't render an empty panel (all three groups empty)
  if (measured.length === 0 && assumed.length === 0 && missing.length === 0) return null;

  const evidenceSummaryLine = buildEvidenceSummaryLine(evidence);

  return (
    <div className="conf-panel">
      <h4 className="conf-panel__title">Measurement Confidence</h4>

      {evidenceSummaryLine && (
        <p className="conf-panel__evidence-summary">{evidenceSummaryLine}</p>
      )}

      <div className="conf-panel__groups">
        {measured.length > 0 && (
          <div>
            <p className="conf-panel__group-label">Measured on site</p>
            <div className="conf-panel__chips">
              {measured.map(e => (
                <span key={e.id} className="conf-panel__chip conf-panel__chip--measured">
                  {e.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {assumed.length > 0 && (
          <div>
            <p className="conf-panel__group-label">Modelled from survey details</p>
            <div className="conf-panel__chips">
              {assumed.map(e => (
                <span key={e.id} className="conf-panel__chip conf-panel__chip--assumed">
                  {e.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {missing.length > 0 && (
          <div>
            <p className="conf-panel__group-label">Still worth confirming</p>
            <div className="conf-panel__chips">
              {missing.map(e => (
                <span key={e.id} className="conf-panel__chip conf-panel__chip--missing">
                  {e.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Component Health Panel ───────────────────────────────────────────────────

/**
 * ComponentHealthItem — one row in the unified "System condition" panel.
 * Exported so it can be unit-tested independently of the React component.
 */
export interface ComponentHealthItem {
  /** Human-readable component name shown as the row heading. */
  component: string;
  /** Engine-inferred condition band. */
  conditionBand: 'good' | 'moderate' | 'poor' | 'severe';
  /** Short label describing the condition (e.g. "Moderate fouling"). */
  conditionLabel: string;
  /** One-line implication strings displayed beneath the badge. */
  implications: string[];
  /** Practical next-step bullets; empty for good or cylinder rows. */
  guidance: string[];
}

// ── Plate HEX copy ────────────────────────────────────────────────────────────

const PLATE_HEX_CONDITION_LABEL: Record<string, string> = {
  good: 'No significant fouling detected',
  moderate: 'Moderate fouling',
  poor: 'Significant fouling',
  severe: 'Severe fouling',
};

const PLATE_HEX_IMPLICATION: Record<string, string[]> = {
  good: ['On-demand hot water response within design limits.'],
  moderate: ['On-demand hot water response slightly reduced.'],
  poor: [
    'Temperature fluctuation under demand is likely.',
    'More sensitive to short draws and concurrent demand.',
  ],
  severe: [
    'On-demand hot water output significantly reduced.',
    'Temperature fluctuation under demand is likely.',
    'More sensitive to short draws and concurrent demand.',
  ],
};

const PLATE_HEX_GUIDANCE: Record<string, string[]> = {
  good:     [],
  moderate: [
    'Monitor for worsening performance over time.',
    'Consider scale protection or regular servicing if in a hard water area.',
  ],
  poor: [
    'Inspect the plate heat exchanger — scale or fouling is the likely cause.',
    'A descale or professional service is recommended.',
    'If the property is in a hard water area, consider a water softener or scale inhibitor.',
  ],
  severe: [
    'Plate heat exchanger likely significantly fouled — inspect or replace at earliest opportunity.',
    'Descale or replacement strongly recommended before relying on on-demand hot water.',
    'Scale protection (softener or inhibitor) should be fitted if not already present.',
  ],
};

// ── Cylinder copy ─────────────────────────────────────────────────────────────

const CYL_CONDITION_LABEL: Record<string, string> = {
  good: 'Good condition',
  moderate: 'Moderate degradation',
  poor: 'Poor insulation',
  severe: 'Severe degradation',
};

/**
 * Band-based performance consequence lines added for non-good cylinder states.
 * These complement the factor-based standing-loss / recovery lines derived
 * from insulationFactor and coilTransferFactor.
 */
const CYL_EXTRA_IMPLICATION: Record<string, string> = {
  moderate: 'User experience is buffered compared to on-demand hot water, but efficiency and recovery are slightly degraded.',
  poor:     'User experience is buffered compared to on-demand hot water, but efficiency and recovery are degraded.',
  severe:   'User experience is buffered compared to on-demand hot water, but efficiency and recovery are significantly degraded.',
};

const CYL_GUIDANCE: Record<string, string[]> = {
  good:     [],
  moderate: [
    'Check cylinder insulation — add lagging if thin or absent.',
  ],
  poor: [
    'Check cylinder insulation and add lagging if absent.',
    'Inspect coil condition — scale build-up is likely in hard water areas.',
  ],
  severe: [
    'Check cylinder insulation and add lagging if absent.',
    'Inspect coil condition — descaling or coil replacement may be needed.',
    'Consider cylinder upgrade if condition cannot be restored.',
  ],
};

// ── Boiler copy ───────────────────────────────────────────────────────────────
// Boiler condition covers combustion/modulation/condensing/cycling degradation.
// Distinct from plate HEX fouling (DHW side) and cylinder condition (storage side).

const BOILER_CONDITION_LABEL: Record<string, string> = {
  good:     'Operating as expected',
  moderate: 'Moderate degradation likely',
  poor:     'Performance degraded',
  severe:   'Significant degradation',
};

const BOILER_IMPLICATION: Record<string, string[]> = {
  good: ['Combustion and modulation appear within normal operating range.'],
  moderate: [
    'Efficiency likely slightly reduced from design rating.',
    'More sensitive to short-cycling and poor setup.',
  ],
  poor: [
    'Higher operating temperatures reduce condensing gain.',
    'Increased cycling reduces reliability and efficiency.',
    'Running costs likely above design specification.',
  ],
  severe: [
    'Likely operating well below intended efficiency.',
    'Reliability and longevity significantly affected.',
    'Service or replacement discussion is justified.',
  ],
};

const BOILER_GUIDANCE: Record<string, string[]> = {
  good: [],
  moderate: [
    'Ensure the annual service is up to date.',
    'Check controls and heating schedule — unnecessarily long run times increase cycling.',
  ],
  poor: [
    'Service and setup check recommended.',
    'Review weather compensation or load compensation controls if fitted.',
    'Improving emitter sizing or reducing required flow temperature can recover condensing behaviour.',
  ],
  severe: [
    'Full service and efficiency check strongly recommended.',
    'Review controls, flow temperature, and system setup.',
    'Consider a replacement discussion if service cannot restore performance.',
  ],
};

// ── Band styling tokens ───────────────────────────────────────────────────────

const BAND_COLOUR: Record<string, string> = {
  good: '#276749',
  moderate: '#b7791f',
  poor: '#c05621',
  severe: '#c53030',
};
const BAND_BG: Record<string, string> = {
  good: '#f0fff4',
  moderate: '#fffff0',
  poor: '#fffaf0',
  severe: '#fff5f5',
};
const BAND_BORDER: Record<string, string> = {
  good: '#9ae6b4',
  moderate: '#faf089',
  poor: '#fbd38d',
  severe: '#feb2b2',
};

/**
 * buildComponentHealthItems — pure function that derives health panel rows
 * from a FullEngineResult.
 *
 * Returns an empty array when no component conditions (plate HEX, cylinder,
 * or boiler) were recorded by the engine, so the panel can safely be omitted.
 *
 * Exported for unit testing.
 */
export function buildComponentHealthItems(result: FullEngineResult): ComponentHealthItem[] {
  const items: ComponentHealthItem[] = [];

  // ── Plate HEX (combi path) ────────────────────────────────────────────────
  const hexBand = result.combiDhwV1?.plateHexConditionBand;
  if (hexBand !== undefined) {
    items.push({
      component: 'Plate heat exchanger',
      conditionBand: hexBand,
      conditionLabel: PLATE_HEX_CONDITION_LABEL[hexBand] ?? hexBand,
      implications: PLATE_HEX_IMPLICATION[hexBand] ?? [],
      guidance: PLATE_HEX_GUIDANCE[hexBand] ?? [],
    });
  }

  // ── Cylinder (stored path) ────────────────────────────────────────────────
  const cyl = result.storedDhwV1?.cylinderCondition;
  if (cyl !== undefined) {
    const implications: string[] = [];
    if (cyl.insulationFactor < 1.0) implications.push('Standing heat loss elevated.');
    if (cyl.coilTransferFactor < 1.0) implications.push('Recovery slower than expected.');
    const extraLine = CYL_EXTRA_IMPLICATION[cyl.conditionBand];
    if (extraLine) implications.push(extraLine);
    items.push({
      component: 'Hot water cylinder',
      conditionBand: cyl.conditionBand,
      conditionLabel: CYL_CONDITION_LABEL[cyl.conditionBand] ?? cyl.conditionBand,
      implications,
      guidance: CYL_GUIDANCE[cyl.conditionBand] ?? [],
    });
  }

  // ── Boiler (combustion/modulation/condensing/cycling) ─────────────────────
  // Distinct from plate HEX fouling (DHW side) and cylinder condition (storage side).
  const boilerBand = result.boilerEfficiencyModelV1?.conditionBand;
  if (boilerBand !== undefined) {
    items.push({
      component: 'Boiler',
      conditionBand: boilerBand,
      conditionLabel: BOILER_CONDITION_LABEL[boilerBand] ?? boilerBand,
      implications: BOILER_IMPLICATION[boilerBand] ?? [],
      guidance: BOILER_GUIDANCE[boilerBand] ?? [],
    });
  }

  return items;
}

/**
 * ComponentHealthPanel — "Component condition" section.
 *
 * Surfaces plate HEX condition (combi path), cylinder condition (stored path),
 * and boiler condition (boiler path) in a single at-a-glance view.
 * Only renders when the engine has recorded at least one component condition.
 *
 * No new physics — reads directly from combiDhwV1, storedDhwV1, and boilerEfficiencyModelV1.
 */
function ComponentHealthPanel({ result }: { result: FullEngineResult }) {
  const items = buildComponentHealthItems(result);
  if (items.length === 0) return null;

  return (
    <section className="rec-hub__section" aria-label="Component condition">
      <h3 className="rec-hub__section-title">Component condition</h3>
      <div className="comp-health">
        {items.map((item, i) => {
          const colour = BAND_COLOUR[item.conditionBand] ?? '#4a5568';
          const bg     = BAND_BG[item.conditionBand]     ?? '#f7fafc';
          const border = BAND_BORDER[item.conditionBand] ?? '#e2e8f0';
          return (
            <div
              key={item.component}
              className={`comp-health__item${i < items.length - 1 ? ' comp-health__item--divider' : ''}`}
            >
              <div className="comp-health__header">
                <span className="comp-health__name">{item.component}</span>
                <span
                  className="comp-health__badge"
                  style={{ background: colour, color: '#fff' }}
                  aria-label={`Condition: ${item.conditionLabel}`}
                >
                  {item.conditionLabel}
                </span>
              </div>
              <div
                className="comp-health__body"
                style={{ background: bg, borderLeft: `4px solid ${border}` }}
              >
                {item.implications.map((line, j) => (
                  <p key={j} className="comp-health__implication">{line}</p>
                ))}
                {item.guidance.length > 0 && (
                  <>
                    <p className="comp-health__guidance-label">Practical next steps</p>
                    <ul className="comp-health__guidance-list">
                      {item.guidance.map((step, j) => (
                        <li key={j}>{step}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── System Health Gauge ──────────────────────────────────────────────────────

/** Overall hot-water system health level derived from component condition bands. */
export type SystemHealthLevel = 'Good' | 'Fair' | 'Degraded' | 'Poor';

/** Result returned by buildSystemHealthLevel. */
export interface SystemHealthResult {
  level: SystemHealthLevel;
  message: string;
}

/** Numeric severity rank for a condition band (higher = worse). */
const BAND_SEVERITY: Record<string, number> = {
  good:     0,
  moderate: 1,
  poor:     2,
  severe:   3,
};

const HEALTH_LEVEL_MAP: Record<string, SystemHealthLevel> = {
  good:     'Good',
  moderate: 'Fair',
  poor:     'Degraded',
  severe:   'Poor',
};

const HEALTH_MESSAGE: Record<SystemHealthLevel, string> = {
  Good:     'Hot water components appear in good condition.',
  Fair:     'Some performance loss is possible from component condition.',
  Degraded: 'Condition-related hot water performance loss is likely.',
  Poor:     'Significant condition-related performance loss is likely.',
};

/**
 * buildSystemHealthLevel — derives an overall system health level
 * from the worst available component condition band.
 *
 * Returns null when no component conditions (plate HEX, cylinder, or boiler)
 * are present so the gauge can be safely omitted from the UI.
 *
 * Rules:
 *  - If no component condition is present → null
 *  - If one component is present → use that band
 *  - If multiple are present → use the worst band
 *  - Mapping: good→Good, moderate→Fair, poor→Degraded, severe→Poor
 *
 * Exported for unit testing. Does not mutate inputs.
 */
export function buildSystemHealthLevel(result: FullEngineResult): SystemHealthResult | null {
  const hexBand    = result.combiDhwV1?.plateHexConditionBand;
  const cylBand    = result.storedDhwV1?.cylinderCondition?.conditionBand;
  const boilerBand = result.boilerEfficiencyModelV1?.conditionBand;

  if (hexBand === undefined && cylBand === undefined && boilerBand === undefined) return null;

  // Pick the worst band (highest severity rank). At least one candidate is present
  // due to the null check above, so 'good' is a safe initial accumulator.
  const candidates = [hexBand, cylBand, boilerBand].filter((b): b is 'good' | 'moderate' | 'poor' | 'severe' => b !== undefined);
  const worstBand = candidates.reduce((worst, band) => {
    const bandRank = BAND_SEVERITY[band] ?? 0;
    const worstRank = BAND_SEVERITY[worst] ?? 0;
    return bandRank > worstRank ? band : worst;
  }, 'good' as string);

  const level = HEALTH_LEVEL_MAP[worstBand] ?? 'Fair';
  return { level, message: HEALTH_MESSAGE[level] };
}

const GAUGE_BAND_FOR_LEVEL: Record<SystemHealthLevel, string> = {
  Good:     'good',
  Fair:     'moderate',
  Degraded: 'poor',
  Poor:     'severe',
};

/**
 * SystemHealthGauge — compact summary gauge placed above the component health
 * panel.  Shows one overall health state (Good / Fair / Degraded / Poor) and a
 * short explanatory sentence.
 *
 * Only renders when at least one component condition is available.
 * Presentation-only: reads buildSystemHealthLevel(), no new engine logic.
 */
function SystemHealthGauge({ result }: { result: FullEngineResult }) {
  const health = buildSystemHealthLevel(result);
  if (!health) return null;

  const band   = GAUGE_BAND_FOR_LEVEL[health.level];
  const colour = BAND_COLOUR[band] ?? '#4a5568';
  const bg     = BAND_BG[band]     ?? '#f7fafc';
  const border = BAND_BORDER[band] ?? '#e2e8f0';

  return (
    <section className="rec-hub__section" aria-label="System health">
      <h3 className="rec-hub__section-title">System health</h3>
      <div
        className="sys-health-gauge"
        style={{ background: bg, borderColor: border }}
      >
        <span
          className="sys-health-gauge__badge"
          style={{ background: colour, color: '#fff' }}
          aria-label={`Overall system health: ${health.level}`}
        >
          {health.level}
        </span>
        <p className="sys-health-gauge__message">{health.message}</p>
      </div>
    </section>
  );
}

// ─── Print Header ─────────────────────────────────────────────────────────────

/**
 * PrintHeader — compact report metadata block rendered at the very top of the
 * printed page. Invisible on screen (display:none via CSS); visible only when
 * the browser enters print mode (@media print).
 *
 * Includes: report title, date, recommended system, confidence level.
 * No new engine dependencies — reads directly from EngineOutputV1.
 */
function PrintHeader({ result }: { result: FullEngineResult }) {
  const { engineOutput } = result;
  const primary = engineOutput.recommendation.primary;
  const level =
    engineOutput.meta?.confidence?.level ??
    engineOutput.verdict?.confidence?.level ??
    'medium';
  const confLabel: Record<string, string> = {
    high:   'High confidence',
    medium: 'Medium confidence',
    low:    'Low confidence',
  };
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Items still needing confirmation — rendered in print only so the
  // printed output reads as intentional even for provisional results.
  const stillToConfirm = (engineOutput.evidence ?? [])
    .filter(e => e.source === 'placeholder')
    .map(e => e.label);

  return (
    <div className="print-header">
      <p className="print-header__title">Heating System Recommendation</p>
      <div className="print-header__meta">
        <span>{dateStr}</span>
        <span className="print-header__sep"> · </span>
        <span>{primary}</span>
        <span className="print-header__sep"> · </span>
        <span>{confLabel[level] ?? level}</span>
      </div>
      {stillToConfirm.length > 0 && (
        <p className="print-header__still-to-confirm">
          Still to confirm: {stillToConfirm.join(', ')}
        </p>
      )}
    </div>
  );
}

// ─── Standard UK room design temperatures (BS EN 12831) ──────────────────────
// Fixed reference values that demonstrate sizing is standards-based.

const ROOM_DESIGN_TEMPS: Array<{ room: string; tempC: number }> = [
  { room: 'Lounge',   tempC: 21 },
  { room: 'Kitchen',  tempC: 20 },
  { room: 'Bedroom',  tempC: 18 },
  { room: 'Bathroom', tempC: 22 },
  { room: 'Hall',     tempC: 18 },
];

/** Build a heatMap OutputHubSection from the engine result. */
function buildHeatMapSection(result: FullEngineResult) {
  const fabric = result.fabricModelV1;
  return {
    id: 'heatMap' as const,
    title: 'House Heating Map',
    status: 'ok' as const,
    visible: true,
    customerSafe: true,
    content: {
      roomDesignTemps: ROOM_DESIGN_TEMPS,
      heatLossBand:    fabric?.heatLossBand    ?? 'unknown',
      thermalMassBand: fabric?.thermalMassBand ?? 'unknown',
      driftTauHours:   fabric?.driftTauHours   ?? null,
      notes:           fabric?.notes           ?? [],
    },
  };
}

/** Build a hotWaterDemand OutputHubSection from the engine result and survey input. */
function buildHotWaterDemandSection(result: FullEngineResult, input: EngineInputV2_3) {
  const combi  = result.combiDhwV1;
  const stored = result.storedDhwV1;
  const bathrooms = input.bathroomCount ?? null;
  const occupancy = input.occupancyCount ?? null;

  // Hot water demand is driven by occupancy first — how many people live in the home.
  // Bathrooms affect concurrency (how many can draw simultaneously), not total demand.
  // Diversity factor accounts for the fact that people rarely all use water at exactly
  // the same second, even when multiple bathrooms are available.
  const DIVERSITY_FACTOR: Record<number, number> = { 1: 1.0, 2: 0.75, 3: 0.60 };
  const maxConcurrent = (input as { peakConcurrentOutlets?: number }).peakConcurrentOutlets
    ?? (occupancy != null && bathrooms != null
        ? Math.min(bathrooms, occupancy)
        : bathrooms ?? (occupancy != null ? 1 : null));
  const diversityFactor = maxConcurrent != null
    ? (DIVERSITY_FACTOR[Math.min(maxConcurrent, 3)] ?? 0.60)
    : 1.0;
  const peakOutlets = maxConcurrent;
  const peakDemandLpm = occupancy != null
    ? Math.round(occupancy * 8 * diversityFactor)
    : peakOutlets != null ? peakOutlets * 8 : null;

  const combiMaxKw = (combi as { maxQtoDhwKwDerated?: number } | undefined)?.maxQtoDhwKwDerated;
  const combiDeliveryLpm = combiMaxKw != null
    ? parseFloat((combiMaxKw / (4.2 * 40 / 60)).toFixed(1))
    : null;
  return {
    id: 'hotWaterDemand' as const,
    title: 'Hot Water Demand',
    status: combi?.verdict.combiRisk === 'fail' ? 'watch' as const : 'ok' as const,
    visible: true,
    customerSafe: true,
    content: {
      occupancyCount:   occupancy,
      bathroomCount:    bathrooms,
      peakOutlets:      peakOutlets,
      peakDemandLpm,
      diversityFactor,
      combiDeliveryLpm,
      combiRisk:        combi?.verdict.combiRisk ?? 'pass',
      storedVolumeBand: (stored as { recommended?: { volumeBand?: string } } | undefined)?.recommended?.volumeBand ?? 'medium',
      // Stratification is ONLY a feature of Mixergy cylinders — use the user's
      // dhwTankType selection, NOT the engine's upgrade recommendation.
      // The engine may recommend Mixergy based on space/demand, but that is an
      // upgrade suggestion; the current proposal is what dhwTankType captures.
      storedType:       input.dhwTankType === 'mixergy' ? 'mixergy' : 'standard',
    },
  };
}

// ─── Depot Notes Builder ──────────────────────────────────────────────────────

/** Build plain-text depot notes from the full engine result for clipboard copy. */
function buildDepotNotes(result: FullEngineResult): string {
  const { engineOutput } = result;
  const primary = engineOutput.recommendation.primary;
  const secondary = engineOutput.recommendation.secondary;
  const confidence = engineOutput.meta?.confidence ?? engineOutput.verdict?.confidence;
  const options = engineOutput.options ?? [];
  const viableOption = options.find(o => o.status === 'viable');
  const mustHave = viableOption?.typedRequirements?.mustHave ?? viableOption?.requirements ?? [];
  const unlockBy = confidence?.unlockBy ?? [];

  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const lines: string[] = [];
  lines.push(`OUR RECOMMENDATION — ${dateStr}`);
  lines.push('');
  lines.push(`SYSTEM: ${primary}`);
  if (secondary) lines.push(`NOTE: ${secondary}`);
  lines.push(`CONFIDENCE: ${confidence?.level?.toUpperCase() ?? 'MEDIUM'}`);

  if (viableOption?.why?.length) {
    lines.push('');
    lines.push('WHY IT SUITS:');
    viableOption.why.forEach(r => lines.push(`• ${r}`));
  }

  if (mustHave.length > 0) {
    lines.push('');
    lines.push('MUST-HAVES BEFORE INSTALL:');
    mustHave.forEach(u => lines.push(`• ${u}`));
  }

  if (unlockBy.length > 0) {
    lines.push('');
    lines.push('STILL TO CONFIRM:');
    unlockBy.forEach(u => lines.push(`• ${u}`));
  }

  return lines.join('\n');
}

// ─── Main hub ─────────────────────────────────────────────────────────────────

export default function RecommendationHub({ result, input }: Props) {
  const { engineOutput } = result;
  const options = sortOptionCards(engineOutput.options ?? []);
  const comparisonSummary = buildComparisonSummary(options);
  const contextBullets = engineOutput.contextSummary?.bullets ?? [];

  // Extract selected priorities from the survey model (FullSurveyModelV1 extends EngineInputV2_3).
  // Cast is safe: CurrentSituationSection always passes FullSurveyModelV1 here.
  const fullSurveyModel = input as FullSurveyModelV1 | undefined;
  const selectedPriorities: PriorityKey[] =
    fullSurveyModel?.fullSurvey?.priorities?.selected ?? [];

  // Extract heat-loss and priorities state from the full survey model so the
  // presentation deck can show the house snapshot and selected priority chips.
  // These are UI-only fields stripped by toEngineInput(); they are not present
  // on bare EngineInputV2_3 objects.
  const presentationHeatLossState: HeatLossState | undefined =
    fullSurveyModel?.fullSurvey?.heatLoss;
  const presentationPrioritiesState: PrioritiesState | undefined =
    fullSurveyModel?.fullSurvey?.priorities;

  // Build note influence summary from accepted note suggestions (UI-only extras,
  // not part of EngineInputV2_3 — cast is safe as above).
  const noteInfluenceSummary = buildNoteInfluenceSummary(
    fullSurveyModel?.fullSurvey?.appliedNoteSuggestions,
  );

  // Depot notes clipboard state
  const [depotCopied, setDepotCopied] = useState(false);

  // Analytics — read optional visit context (null-safe: component may render
  // outside a VisitProvider in lab/audit surfaces).
  const visitCtx = useContext(VisitContext);
  const analyticsVisitId = visitCtx?.activeVisit?.visitId;

  // Fire recommendation_viewed once on mount.
  // The intent is to record a single "page viewed" event per render of this
  // component.  Dependency changes (e.g. visitId or option list refreshing)
  // should NOT re-fire the event because the engineer has not navigated away
  // and back.  The eslint-disable comment suppresses the exhaustive-deps
  // warning that would otherwise flag this intentional empty deps array.
  useEffect(() => {
    if (!analyticsVisitId) return;
    const scenarioIds: string[] = [];
    if (engineOutput.recommendation?.primary) {
      scenarioIds.push(engineOutput.recommendation.primary);
    }
    for (const option of options) {
      if (!scenarioIds.includes(option.id)) scenarioIds.push(option.id);
    }
    trackRecommendationViewed(analyticsVisitId, scenarioIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDepotCopy = () => {
    const text = buildDepotNotes(result);
    navigator.clipboard.writeText(text).then(() => {
      setDepotCopied(true);
      setTimeout(() => setDepotCopied(false), 2500);
    });
    // Track scenario selection — depot-copy is the engineer's act of confirming
    // the primary recommendation for handoff use.
    if (analyticsVisitId && engineOutput.recommendation?.primary) {
      trackRecommendationSelected(analyticsVisitId, engineOutput.recommendation.primary);
    }
  };

  // Mains operating point data (for OperatingPointChart)
  const flowLpm     = input?.mainsDynamicFlowLpm ?? null;
  const pressureBar = input?.dynamicMainsPressureBar ?? input?.dynamicMainsPressure ?? null;
  const hasMainsData = flowLpm != null && pressureBar != null;

  // Graphical panel sections
  const heatMapSection      = buildHeatMapSection(result);
  const hotWaterSection     = input ? buildHotWaterDemandSection(result, input) : null;

  return (
    <div className="rec-hub">

      {/* Print header — screen hidden, print visible */}
      <PrintHeader result={result} />

      {/* 1 — Decision-first hero card */}
      <div className="rec-hub__hero">
        <RecommendationCard engineOutput={engineOutput} />
        <div className="rec-hub__depot-copy">
          <button
            className={`rec-hub__depot-btn${depotCopied ? ' rec-hub__depot-btn--copied' : ''}`}
            onClick={handleDepotCopy}
            aria-label="Copy summary for depot notes"
          >
            {depotCopied ? '✓ Copied to clipboard' : 'Copy for depot notes'}
          </button>
        </div>
      </div>

      {/* Trust strip — sticky evidence count + next step */}
      <div className="rec-hub__sticky-strip">
        <TrustStrip result={result} />
      </div>

      {/* Note influence provenance — show when accepted note suggestions shaped this recommendation */}
      {noteInfluenceSummary.hasActiveInfluence || noteInfluenceSummary.overridden.length > 0 ? (
        <section className="rec-hub__section" aria-label="Note influence">
          <h3 className="rec-hub__section-title">Influenced by Accepted Notes</h3>
          <NoteInfluencePanel summary={noteInfluenceSummary} />
        </section>
      ) : null}

      {/* 1 — Canonical presentation (house/home/energy/system/objectives — physics-first) */}
      {input && (
        <section className="rec-hub__section" aria-label="Engine-driven recommendation">
          <h3 className="rec-hub__section-title">Engine-Driven Recommendation</h3>
          <CanonicalPresentationPage
            result={result}
            input={input}
            recommendationResult={result.recommendationResult}
            deckMode={true}
            heatLossState={presentationHeatLossState}
            prioritiesState={presentationPrioritiesState}
          />
        </section>
      )}

      {/* 1a — Evidence-backed recommendation (PR11/PR12 canonical output) */}
      <section className="rec-hub__section" aria-label="Evidence-backed recommendation">
        <h3 className="rec-hub__section-title">Evidence-Backed Recommendation</h3>
        <EvidenceRecommendationPanel recommendation={result.recommendationResult} />
      </section>

      {/* 2 — Performance Enablers — install-readiness conditions near the verdict */}
      <section className="rec-hub__section">
        <PerformanceEnablersPanel result={result} input={input} />
      </section>

      {/* 3 — Graphical Performance Evidence panels */}
      {(hasMainsData || hotWaterSection) && (
        <section className="rec-hub__section" aria-label="Performance evidence">
          <h3 className="rec-hub__section-title">Performance Evidence</h3>
          <div className="rec-hub__perf-panels">

            {/* House Heat-Map — room temperatures and fabric heat-loss */}
            <div className="rec-hub__perf-panel">
              <HouseHeatMapPanel section={heatMapSection} />
            </div>

            {/* Hot Water Demand — combi vs cylinder capacity bars */}
            {hotWaterSection && (
              <div className="rec-hub__perf-panel">
                <HotWaterDemandPanel section={hotWaterSection} />
              </div>
            )}

            {/* Mains Operating Point — flow vs pressure scatter chart */}
            {hasMainsData && (
              <div className="rec-hub__perf-panel rec-hub__perf-panel--chart">
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Mains Supply — Operating Point
                </div>
                <OperatingPointChart flowLpm={flowLpm!} pressureBar={pressureBar!} />
              </div>
            )}

          </div>
        </section>
      )}

      {/* 4 — System Health Gauge (overall hot-water health summary, when evidence available) */}
      <SystemHealthGauge result={result} />

      {/* 5 — Component condition (plate HEX and/or cylinder, when evidence available) */}
      <ComponentHealthPanel result={result} />

      {/* 6 — System Comparison */}
      {options.length > 0 && (
        <section className="rec-hub__section">
          <h3 className="rec-hub__section-title">System Comparison</h3>
          {comparisonSummary && (
            <p className="rec-comparison__summary">{comparisonSummary}</p>
          )}
          {options.map(card => (
            <SystemOptionCard key={card.id} card={card} selectedPriorities={selectedPriorities} />
          ))}
        </section>
      )}

      {/* 7 — Measurement Confidence */}
      <MeasurementConfidencePanel result={result} />

      {/* 8 — Evidence & Context (grouped: site context / key constraints / general) */}
      {contextBullets.length > 0 && (() => {
        const siteCtx  = contextBullets.filter(b => classifyContextBullet(b) === 'site_context');
        const keyConstr = contextBullets.filter(b => classifyContextBullet(b) === 'key_constraint');
        const general  = contextBullets.filter(b => classifyContextBullet(b) === 'general');
        const hasGroups = siteCtx.length > 0 || keyConstr.length > 0;
        return (
          <section className="rec-hub__section">
            <h3 className="rec-hub__section-title">Evidence &amp; Context</h3>
            {hasGroups ? (
              <div className="evctx">
                {siteCtx.length > 0 && (
                  <div className="evctx__group">
                    <p className="evctx__group-title">Site context</p>
                    <ul className="evctx__bullets">
                      {siteCtx.map((bullet, i) => <li key={i}>{bullet}</li>)}
                    </ul>
                  </div>
                )}
                {keyConstr.length > 0 && (
                  <div className="evctx__group">
                    <p className="evctx__group-title">Key constraints</p>
                    <ul className="evctx__bullets">
                      {keyConstr.map((bullet, i) => <li key={i}>{bullet}</li>)}
                    </ul>
                  </div>
                )}
                {general.length > 0 && (
                  <ul className="rec-summary__bullets evctx__general">
                    {general.map((bullet, i) => <li key={i}>{bullet}</li>)}
                  </ul>
                )}
              </div>
            ) : (
              <ul className="rec-summary__bullets">
                {contextBullets.map((bullet, i) => <li key={i}>{bullet}</li>)}
              </ul>
            )}
          </section>
        );
      })()}

      {/* 9 — Model inspection (dev) — demographic + PV canonical outputs */}
      <section className="rec-hub__section" aria-label="Model inspection">
        <h3 className="rec-hub__section-title">Model Inspection</h3>
        <PvDemographicsDebugCard result={result} input={input} />
      </section>

    </div>
  );
}
