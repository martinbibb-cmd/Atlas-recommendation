/**
 * TimelineLegend.tsx
 *
 * Compact one-line legend for the BehaviourTimelinePanel instrument stage.
 * Shows colour-dot keys for Heat, DHW, Output, and optionally Efficiency/COP.
 * Hides the efficiency item when the strip is not rendered.
 */

interface Props {
  efficiencyLabel: string;
  showEfficiency: boolean;
}

export default function TimelineLegend({ efficiencyLabel, showEfficiency }: Props) {
  return (
    <div className="btp-legend">
      <span className="btp-legend-item">
        <span className="btp-legend-dot btp-legend-dot--heat" />
        <span className="btp-legend-item__label">Heat</span>
      </span>
      <span className="btp-legend-item">
        <span className="btp-legend-dot btp-legend-dot--dhw" />
        <span className="btp-legend-item__label">DHW</span>
      </span>
      <span className="btp-legend-item">
        <span className="btp-legend-dot btp-legend-dot--output" />
        <span className="btp-legend-item__label">Output</span>
      </span>
      {showEfficiency && (
        <span className="btp-legend-item">
          <span className="btp-legend-dot btp-legend-dot--eff" />
          <span className="btp-legend-item__label">{efficiencyLabel}</span>
        </span>
      )}
    </div>
  );
}
