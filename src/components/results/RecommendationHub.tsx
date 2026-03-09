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
import type { EvidenceItemV1 } from '../../contracts/EngineOutputV1';
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

  const measured   = evidence.filter((e: EvidenceItemV1) => e.source === 'manual');
  const assumed    = evidence.filter((e: EvidenceItemV1) => e.source === 'assumed' || e.source === 'derived');
  const missing    = evidence.filter((e: EvidenceItemV1) => e.source === 'placeholder');

  // Don't render if there's nothing to show
  if (!confidence && evidence.length === 0) return null;

  const level = confidence?.level ?? 'medium';
  const unlockBy = confidence?.unlockBy ?? [];

  const LEVEL_ICON: Record<string, string> = {
    high: '🟢', medium: '🟡', low: '🔴',
  };
  const LEVEL_LABEL: Record<string, string> = {
    high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence',
  };

  return (
    <div className="conf-panel">
      <h4 className="conf-panel__title">Measurement Confidence</h4>
      <span
        className={`conf-panel__level conf-panel__level--${level}`}
        aria-label={`Confidence: ${LEVEL_LABEL[level] ?? level}`}
      >
        <span aria-hidden="true">{LEVEL_ICON[level] ?? '⚪'}</span>{' '}
        {LEVEL_LABEL[level] ?? level}
      </span>

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
            <p className="conf-panel__group-label">Assumptions used</p>
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
            <p className="conf-panel__group-label">Not measured</p>
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

      {unlockBy.length > 0 && (
        <div className="conf-panel__unlock">
          <span className="conf-panel__unlock-label">
            Measuring these values would increase accuracy:
          </span>
          {unlockBy.join(' · ')}
        </div>
      )}
    </div>
  );
}

/**
 * PlateHexConditionPanel — compact combi plate heat exchanger condition section.
 *
 * Surfaces when the engine has inferred a plate HEX condition from survey evidence.
 * Shows condition band, short implication, and practical maintenance guidance when degraded.
 *
 * Only rendered when plateHexConditionBand is present on combiDhwV1.
 * Does not surface for stored system paths.
 */
interface PlateHexConditionPanelProps {
  result: FullEngineResult;
}

const PLATE_HEX_IMPLICATION: Record<string, string> = {
  good:     'On-demand hot water response within design limits.',
  moderate: 'Hot water response likely slightly reduced.',
  poor:     'Likely temperature fluctuation under heavier demand.',
  severe:   'Performance loss likely due to scale/fouling — on-demand hot water output reduced.',
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

const PLATE_HEX_BAND_COLOUR: Record<string, string> = {
  good: '#276749', moderate: '#b7791f', poor: '#c05621', severe: '#c53030',
};
const PLATE_HEX_BAND_BG: Record<string, string> = {
  good: '#f0fff4', moderate: '#fffff0', poor: '#fffaf0', severe: '#fff5f5',
};
const PLATE_HEX_BAND_BORDER: Record<string, string> = {
  good: '#9ae6b4', moderate: '#faf089', poor: '#fbd38d', severe: '#feb2b2',
};

function PlateHexConditionPanel({ result }: PlateHexConditionPanelProps) {
  const { combiDhwV1 } = result;
  const band = combiDhwV1.plateHexConditionBand;
  const foulingFactor = combiDhwV1.plateHexFoulingFactor;

  // Only render when plate HEX evidence was collected
  if (!band) return null;

  const implication = PLATE_HEX_IMPLICATION[band] ?? '';
  const guidance = PLATE_HEX_GUIDANCE[band] ?? [];
  const colour = PLATE_HEX_BAND_COLOUR[band] ?? '#4a5568';
  const bg = PLATE_HEX_BAND_BG[band] ?? '#f7fafc';
  const border = PLATE_HEX_BAND_BORDER[band] ?? '#e2e8f0';

  return (
    <section className="rec-hub__section" aria-label="Plate heat exchanger condition">
      <h3 className="rec-hub__section-title">Plate heat exchanger condition</h3>
      <div style={{
        padding: '0.875rem 1rem',
        background: bg,
        border: `1px solid ${border}`,
        borderLeft: `4px solid ${colour}`,
        borderRadius: '6px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
          <span style={{
            padding: '0.2rem 0.65rem',
            borderRadius: '4px',
            fontSize: '0.82rem',
            fontWeight: 700,
            background: colour,
            color: '#fff',
          }}>
            {band.charAt(0).toUpperCase() + band.slice(1)}
          </span>
          {foulingFactor !== undefined && foulingFactor < 1.0 && (
            <span style={{ fontSize: '0.75rem', color: '#718096' }}>
              {((1 - foulingFactor) * 100).toFixed(0)}% capacity reduction estimated
            </span>
          )}
        </div>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.88rem', color: '#2d3748' }}>
          {implication}
        </p>
        {guidance.length > 0 && (
          <div>
            <p style={{ margin: '0.5rem 0 0.3rem 0', fontSize: '0.78rem', fontWeight: 600, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Practical next steps
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.83rem', color: '#4a5568', lineHeight: 1.5 }}>
              {guidance.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Main hub ─────────────────────────────────────────────────────────────────

export default function RecommendationHub({ result }: Props) {
  const { engineOutput } = result;
  const options = engineOutput.options ?? [];

  return (
    <div className="rec-hub">

      {/* 1 — Recommendation Summary */}
      <SystemRecommendationPanel engineOutput={engineOutput} />

      {/* Trust strip — evidence count + action prompt */}
      <TrustStrip result={result} />

      {/* 2 — System Comparison */}
      {options.length > 0 && (
        <section className="rec-hub__section">
          <h3 className="rec-hub__section-title">System Comparison</h3>
          {options.map(card => (
            <SystemOptionCard key={card.id} card={card} />
          ))}
        </section>
      )}

      {/* 3 — Plate HEX condition (combi only, when survey evidence available) */}
      <PlateHexConditionPanel result={result} />

      {/* 4 — Measurement Confidence */}
      <MeasurementConfidencePanel result={result} />

      {/* 5 — Evidence & Context */}
      {engineOutput.contextSummary && engineOutput.contextSummary.bullets.length > 0 && (
        <section className="rec-hub__section">
          <h3 className="rec-hub__section-title">Evidence &amp; Context</h3>
          <ul className="rec-summary__bullets">
            {engineOutput.contextSummary.bullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
