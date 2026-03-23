// src/components/simulator/OutcomeSummaryCard.tsx
//
// Renders a single install outcome card — used for both simple install and
// best-fit install. Keeps both cards visually identical so the comparison
// reads as: same day, same home, same system, different spec.

import type { ClassifiedDaySchedule } from '../../logic/outcomes/types';

interface OutcomeSummaryCardProps {
  /** Card variant label shown in the header badge. */
  variant: 'simple' | 'best-fit';
  /** Classified outcome data to display. */
  outcome: ClassifiedDaySchedule;
  /** Short narrative summary for the customer. */
  summary: string;
}

const VARIANT_LABELS: Record<OutcomeSummaryCardProps['variant'], string> = {
  'simple':   'Simple install',
  'best-fit': 'Best-fit install',
};

const VARIANT_CLASS: Record<OutcomeSummaryCardProps['variant'], string> = {
  'simple':   'outcome-summary-card--simple',
  'best-fit': 'outcome-summary-card--best-fit',
};

export default function OutcomeSummaryCard({
  variant,
  outcome,
  summary,
}: OutcomeSummaryCardProps) {
  const { hotWater, heating } = outcome;

  const bathFill =
    hotWater.averageBathFillTimeMinutes != null
      ? `${hotWater.averageBathFillTimeMinutes.toFixed(1)} min`
      : '—';

  return (
    <div className={`outcome-summary-card ${VARIANT_CLASS[variant]}`} data-testid={`outcome-card-${variant}`}>
      <div className="outcome-summary-card__badge">{VARIANT_LABELS[variant]}</div>

      {/* ── Hot-water draws ─────────────────────────────────────────── */}
      <div className="outcome-summary-card__section">
        <div className="outcome-summary-card__section-label">On-demand hot water</div>
        <div className="outcome-summary-card__metrics">
          <div className="outcome-summary-card__metric outcome-summary-card__metric--good">
            <span className="outcome-summary-card__metric-value">{hotWater.successful}</span>
            <span className="outcome-summary-card__metric-label">Successful</span>
          </div>
          <div className="outcome-summary-card__metric outcome-summary-card__metric--warn">
            <span className="outcome-summary-card__metric-value">{hotWater.reduced}</span>
            <span className="outcome-summary-card__metric-label">Reduced</span>
          </div>
          <div className="outcome-summary-card__metric outcome-summary-card__metric--fail">
            <span className="outcome-summary-card__metric-value">{hotWater.conflict}</span>
            <span className="outcome-summary-card__metric-label">Conflict</span>
          </div>
        </div>
      </div>

      {/* ── Bath fill time ────────────────────────────────────────────── */}
      <div className="outcome-summary-card__section">
        <div className="outcome-summary-card__section-label">Average bath fill time</div>
        <div className="outcome-summary-card__single-metric">{bathFill}</div>
      </div>

      {/* ── Heating events outside target ─────────────────────────────── */}
      <div className="outcome-summary-card__section">
        <div className="outcome-summary-card__section-label">Heating events outside target</div>
        <div className={`outcome-summary-card__single-metric ${heating.outsideTargetEventCount > 0 ? 'outcome-summary-card__single-metric--warn' : ''}`}>
          {heating.outsideTargetEventCount}
        </div>
      </div>

      {/* ── Narrative summary ─────────────────────────────────────────── */}
      <p className="outcome-summary-card__summary">{summary}</p>
    </div>
  );
}
