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
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import type { EvidenceItemV1, OptionCardV1 } from '../../contracts/EngineOutputV1';
import SystemRecommendationPanel from './SystemRecommendationPanel';
import SystemOptionCard from './SystemOptionCard';
import './results.css';

interface Props {
  result: FullEngineResult;
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

  return (
    <div className="rec-trust-strip" aria-label="Evidence summary">
      <div className="rec-trust-strip__counts">
        <span className="rec-trust-strip__count rec-trust-strip__count--measured">
          Measured on site: <strong>{measuredCount}</strong>
        </span>
        <span className="rec-trust-strip__sep" aria-hidden="true">·</span>
        <span className="rec-trust-strip__count rec-trust-strip__count--assumed">
          Assumed: <strong>{assumedCount}</strong>
        </span>
        <span className="rec-trust-strip__sep" aria-hidden="true">·</span>
        <span className="rec-trust-strip__count rec-trust-strip__count--needed">
          Still needed: <strong>{stillNeededCount}</strong>
        </span>
      </div>
      {unlockBy.length > 0 && (
        <p className="rec-trust-strip__action">
          To strengthen this recommendation, measure:{' '}
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

  return (
    <div className="conf-panel">
      <h4 className="conf-panel__title">Measurement Confidence</h4>

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

const PLATE_HEX_IMPLICATION: Record<string, string> = {
  good: 'On-demand hot water response within design limits.',
  moderate: 'On-demand hot water response slightly reduced.',
  poor: 'Likely temperature fluctuation under heavier demand.',
  severe: 'On-demand hot water output reduced.',
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
 * Returns an empty array when neither the combi plate HEX nor the cylinder
 * condition was recorded by the engine, so the panel can safely be omitted.
 *
 * Exported for unit testing.
 */
export function buildComponentHealthItems(result: FullEngineResult): ComponentHealthItem[] {
  const items: ComponentHealthItem[] = [];

  // ── Plate HEX (combi path) ────────────────────────────────────────────────
  const hexBand = result.combiDhwV1.plateHexConditionBand;
  if (hexBand !== undefined) {
    items.push({
      component: 'Plate heat exchanger',
      conditionBand: hexBand,
      conditionLabel: PLATE_HEX_CONDITION_LABEL[hexBand] ?? hexBand,
      implications: PLATE_HEX_IMPLICATION[hexBand] ? [PLATE_HEX_IMPLICATION[hexBand]] : [],
      guidance: PLATE_HEX_GUIDANCE[hexBand] ?? [],
    });
  }

  // ── Cylinder (stored path) ────────────────────────────────────────────────
  const cyl = result.storedDhwV1.cylinderCondition;
  if (cyl !== undefined) {
    const implications: string[] = [];
    if (cyl.insulationFactor < 1.0) implications.push('Standing heat loss elevated.');
    if (cyl.coilTransferFactor < 1.0) implications.push('Recovery slower than expected.');
    items.push({
      component: 'Hot water cylinder',
      conditionBand: cyl.conditionBand,
      conditionLabel: CYL_CONDITION_LABEL[cyl.conditionBand] ?? cyl.conditionBand,
      implications,
      guidance: [],
    });
  }

  return items;
}

/**
 * ComponentHealthPanel — unified "System condition" section.
 *
 * Surfaces plate HEX condition (combi path) and cylinder condition (stored path)
 * in a single at-a-glance view. Only renders when the engine has recorded at
 * least one component condition.
 *
 * No new physics — reads directly from combiDhwV1 and storedDhwV1.
 */
function ComponentHealthPanel({ result }: { result: FullEngineResult }) {
  const items = buildComponentHealthItems(result);
  if (items.length === 0) return null;

  return (
    <section className="rec-hub__section" aria-label="System condition">
      <h3 className="rec-hub__section-title">System condition</h3>
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

  return (
    <div className="print-header">
      <p className="print-header__title">Atlas — Heating System Recommendation</p>
      <div className="print-header__meta">
        <span>{dateStr}</span>
        <span className="print-header__sep"> · </span>
        <span>{primary}</span>
        <span className="print-header__sep"> · </span>
        <span>{confLabel[level] ?? level}</span>
      </div>
    </div>
  );
}

// ─── Main hub ─────────────────────────────────────────────────────────────────

export default function RecommendationHub({ result }: Props) {
  const { engineOutput } = result;
  const options = sortOptionCards(engineOutput.options ?? []);
  const comparisonSummary = buildComparisonSummary(options);
  const contextBullets = engineOutput.contextSummary?.bullets ?? [];

  return (
    <div className="rec-hub">

      {/* Print header — screen hidden, print visible */}
      <PrintHeader result={result} />

      {/* 1 — Recommendation Summary */}
      <SystemRecommendationPanel engineOutput={engineOutput} />

      {/* Trust strip — evidence count + action prompt */}
      <TrustStrip result={result} />

      {/* 2 — System condition (plate HEX and/or cylinder, when evidence available) */}
      <ComponentHealthPanel result={result} />

      {/* 3 — System Comparison */}
      {options.length > 0 && (
        <section className="rec-hub__section">
          <h3 className="rec-hub__section-title">System Comparison</h3>
          {comparisonSummary && (
            <p className="rec-comparison__summary">{comparisonSummary}</p>
          )}
          {options.map(card => (
            <SystemOptionCard key={card.id} card={card} />
          ))}
        </section>
      )}

      {/* 4 — Measurement Confidence */}
      <MeasurementConfidencePanel result={result} />

      {/* 5 — Evidence & Context (grouped: site context / key constraints / general) */}
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
    </div>
  );
}
