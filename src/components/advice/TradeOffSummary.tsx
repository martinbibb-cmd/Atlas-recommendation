/**
 * TradeOffSummary
 *
 * A simple, literal side-by-side comparison of the current and recommended
 * heating systems across plain-English trade-off dimensions.
 *
 * Design intent: readable in ~2 seconds with no interpretation overhead.
 * Replaces the Home Energy Compass with something that lands instantly.
 *
 * Rules:
 *   - No abstract axes or metaphors.
 *   - All data comes from buildTradeOffSummary (deterministic, rule-based).
 *   - No Math.random().
 */

import type { TradeOffSummaryData, TradeOffBand } from '../../lib/advice/buildTradeOffSummary';
import './TradeOffSummary.css';

// ─── Band display helpers ─────────────────────────────────────────────────────

const BAND_LABEL: Record<TradeOffBand, string> = {
  low:    'Lower',
  medium: 'Medium',
  high:   'Higher',
};

/**
 * Return a small directional arrow when moving from current to recommended
 * is a meaningful change. No arrow when the bands are equal.
 *
 * The "direction" of improvement depends on the dimension:
 *   - Efficiency, Hot water, Future-readiness: higher is better → ↑ is good
 *   - Upfront cost, Disruption, Space impact: lower is better → ↓ is good
 */
function directionArrow(
  dimension: string,
  current: TradeOffBand,
  recommended: TradeOffBand,
): string | null {
  if (current === recommended) return null;

  const lowerIsBetter = new Set(['Upfront cost', 'Disruption', 'Space impact']);
  const bands: TradeOffBand[] = ['low', 'medium', 'high'];
  const delta = bands.indexOf(recommended) - bands.indexOf(current);

  if (lowerIsBetter.has(dimension)) {
    return delta < 0 ? '↓' : '↑';
  }
  return delta > 0 ? '↑' : '↓';
}

// ─── Sub-component: BandChip ──────────────────────────────────────────────────

interface BandChipProps {
  dimension: string;
  band:      TradeOffBand;
  isRecommended?: boolean;
  currentBand?:   TradeOffBand;
}

function BandChip({ dimension, band, isRecommended = false, currentBand }: BandChipProps) {
  const arrow = isRecommended && currentBand != null
    ? directionArrow(dimension, currentBand, band)
    : null;

  return (
    <span className={`trade-off-chip trade-off-chip--${band}`}>
      {arrow != null && (
        <em className="trade-off-chip__arrow" aria-hidden="true">{arrow}</em>
      )}
      {BAND_LABEL[band]}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  summary: TradeOffSummaryData;
}

export default function TradeOffSummary({ summary }: Props) {
  const { currentSystemLabel, recommendedSystemLabel, dimensions } = summary;

  return (
    <div
      className="trade-off-summary"
      aria-label="Recommendation trade-off summary"
      data-testid="trade-off-summary"
    >
      {/* ── Column headers ──────────────────────────────────────────────── */}
      <div className="trade-off-summary__header" aria-hidden="true">
        <span className="trade-off-summary__header-label">Dimension</span>
        <span className="trade-off-summary__header-label">{currentSystemLabel}</span>
        <span className="trade-off-summary__header-label">{recommendedSystemLabel}</span>
      </div>

      {/* ── Dimension rows ────────────────────────────────────────────────── */}
      {dimensions.map(dim => (
        <div
          key={dim.label}
          className="trade-off-summary__row"
          role="row"
          aria-label={`${dim.label}: current ${BAND_LABEL[dim.current]}, recommended ${BAND_LABEL[dim.recommended]}`}
        >
          <span className="trade-off-summary__dimension">{dim.label}</span>

          <div className="trade-off-summary__band">
            <BandChip dimension={dim.label} band={dim.current} />
          </div>

          <div className="trade-off-summary__band">
            <BandChip
              dimension={dim.label}
              band={dim.recommended}
              isRecommended
              currentBand={dim.current}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
