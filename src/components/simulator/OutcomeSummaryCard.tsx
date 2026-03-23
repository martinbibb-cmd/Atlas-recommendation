// src/components/simulator/OutcomeSummaryCard.tsx
//
// Renders a single install outcome card — used for both simple install and
// best-fit install. Keeps both cards visually identical so the comparison
// reads as: same day, same home, same system, different spec.

import type { ClassifiedDaySchedule, OutcomeSystemSpec } from '../../logic/outcomes/types';

interface OutcomeSummaryCardProps {
  /** Card variant label shown in the header badge. */
  variant: 'simple' | 'best-fit';
  /** Classified outcome data to display. */
  outcome: ClassifiedDaySchedule;
  /** Short narrative summary for the customer. */
  summary: string;
  /**
   * System family of the evaluated system.  Drives the hot-water section heading
   * so combi cards say "On-demand hot water" and stored-water / heat-pump cards
   * say "Hot water performance" — never implying on-demand behaviour for a
   * stored-water path.
   */
  systemType: OutcomeSystemSpec['systemType'];
}

const VARIANT_LABELS: Record<OutcomeSummaryCardProps['variant'], string> = {
  'simple':   'Simple install',
  'best-fit': 'Best-fit install',
};

const VARIANT_CLASS: Record<OutcomeSummaryCardProps['variant'], string> = {
  'simple':   'outcome-summary-card--simple',
  'best-fit': 'outcome-summary-card--best-fit',
};

/** System-aware heading for the hot-water section. */
const HOT_WATER_SECTION_LABEL: Record<OutcomeSystemSpec['systemType'], string> = {
  combi:        'On-demand hot water',
  stored_water: 'Hot water performance',
  heat_pump:    'Hot water performance',
  open_vented:  'Hot water performance',
};

export default function OutcomeSummaryCard({
  variant,
  outcome,
  summary,
  systemType,
}: OutcomeSummaryCardProps) {
  const { hotWater, heating } = outcome;

  const bathFill =
    hotWater.averageBathFillTimeMinutes != null
      ? `${hotWater.averageBathFillTimeMinutes.toFixed(1)} min`
      : '—';

  const hotWaterLabel = HOT_WATER_SECTION_LABEL[systemType];

  return (
    <div className={`outcome-summary-card ${VARIANT_CLASS[variant]}`} data-testid={`outcome-card-${variant}`}>
      <div className="outcome-summary-card__badge">{VARIANT_LABELS[variant]}</div>

      {/* ── Hot-water draws ─────────────────────────────────────────── */}
      <div className="outcome-summary-card__section">
        <div className="outcome-summary-card__section-label">{hotWaterLabel}</div>
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
            <span className="outcome-summary-card__metric-label">Conflicts</span>
          </div>
          <div className="outcome-summary-card__metric outcome-summary-card__metric--info">
            <span className="outcome-summary-card__metric-value">{hotWater.simultaneousEventCount}</span>
            <span className="outcome-summary-card__metric-label">Simultaneous</span>
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
