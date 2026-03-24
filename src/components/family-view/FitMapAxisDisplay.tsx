/**
 * FitMapAxisDisplay.tsx — PR10: Fit-map axis score panel.
 *
 * Renders the two scored axes of the FitMapModel (heating stability on the
 * vertical axis, DHW strength on the horizontal axis) together with their
 * evidence lists.  All displayed values are derived from real engine evidence —
 * no hard-coded family assumptions.
 *
 * This is the first place the PR9 FitMapModel is rendered in the UI.
 */

import type { FitMapModel, FitAxisScore, FitEvidence } from '../../engine/fitmap/FitMapModel';
import type { FitContourProfile } from '../../engine/fitmap/FitMapModel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a CSS class suffix for the score band (high / mid / low). */
function scoreBand(score: number): 'high' | 'mid' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 45) return 'mid';
  return 'low';
}

/** Human-readable contour shape labels. */
const VERTICAL_SHAPE_LABELS: Record<FitContourProfile['verticalShape'], string> = {
  tall: 'Strong',
  mid:  'Moderate',
  low:  'Constrained',
};

const HORIZONTAL_SHAPE_LABELS: Record<FitContourProfile['horizontalShape'], string> = {
  broad:  'Strong',
  mid:    'Moderate',
  narrow: 'Limited',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface EvidenceItemProps {
  item: FitEvidence;
}

function EvidenceItem({ item }: EvidenceItemProps) {
  const effectIcon = item.effect === 'penalty' ? '↓' : '↑';
  const effectClass = item.effect === 'penalty'
    ? 'fit-map-axis-display__evidence-item--penalty'
    : 'fit-map-axis-display__evidence-item--boost';

  return (
    <li
      className={`fit-map-axis-display__evidence-item ${effectClass}`}
      data-evidence-id={item.id}
      data-source-type={item.sourceType}
    >
      <span
        className="fit-map-axis-display__evidence-effect"
        aria-label={item.effect === 'penalty' ? 'penalty' : 'boost'}
      >
        {effectIcon}
      </span>
      <span className="fit-map-axis-display__evidence-magnitude" aria-hidden="true">
        {item.magnitude}
      </span>
      <span className="fit-map-axis-display__evidence-description">
        {item.description}
      </span>
      <span className="fit-map-axis-display__evidence-source" aria-label={`Source: ${item.id}`}>
        {item.id}
      </span>
    </li>
  );
}

interface AxisPanelProps {
  label: string;
  axisDescription: string;
  axisScore: FitAxisScore;
  shapeLabel: string;
  testIdPrefix: string;
}

function AxisPanel({ label, axisDescription, axisScore, shapeLabel, testIdPrefix }: AxisPanelProps) {
  const band = scoreBand(axisScore.score);

  return (
    <div
      className={`fit-map-axis-display__axis fit-map-axis-display__axis--${band}`}
      data-testid={`${testIdPrefix}-axis-panel`}
    >
      <div className="fit-map-axis-display__axis-header">
        <span className="fit-map-axis-display__axis-label">{label}</span>
        <span
          className="fit-map-axis-display__axis-shape"
          data-testid={`${testIdPrefix}-shape-label`}
        >
          {shapeLabel}
        </span>
        <span
          className={`fit-map-axis-display__axis-score fit-map-axis-display__axis-score--${band}`}
          aria-label={`${label} score: ${axisScore.score} out of 100`}
          data-testid={`${testIdPrefix}-score`}
        >
          {axisScore.score}
        </span>
      </div>
      <p className="fit-map-axis-display__axis-description">{axisDescription}</p>

      {/* Score bar */}
      <div
        className="fit-map-axis-display__score-bar"
        role="meter"
        aria-valuenow={axisScore.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} score bar`}
      >
        <div
          className={`fit-map-axis-display__score-fill fit-map-axis-display__score-fill--${band}`}
          style={{ width: `${axisScore.score}%` }}
        />
      </div>

      {/* Evidence list */}
      {axisScore.evidence.length > 0 && (
        <div className="fit-map-axis-display__evidence">
          <div className="fit-map-axis-display__evidence-heading">Evidence</div>
          <ul
            className="fit-map-axis-display__evidence-list"
            data-testid={`${testIdPrefix}-evidence-list`}
            aria-label={`${label} evidence items`}
          >
            {axisScore.evidence.map((item) => (
              <EvidenceItem key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}

      {axisScore.evidence.length === 0 && (
        <p className="fit-map-axis-display__no-evidence">No constraints detected for this axis.</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface FitMapAxisDisplayProps {
  fitMap: FitMapModel;
}

/**
 * Renders both scored axes of the FitMapModel alongside their evidence lists.
 *
 * - Vertical axis (heating): `fitMap.heatingAxis`
 * - Horizontal axis (DHW): `fitMap.dhwAxis`
 * - Optional efficiency score: `fitMap.efficiencyScore`
 * - Contour profile notes: `fitMap.contour.evidenceNotes`
 */
export default function FitMapAxisDisplay({ fitMap }: FitMapAxisDisplayProps) {
  const { heatingAxis, dhwAxis, efficiencyScore, contour } = fitMap;

  const heatingShapeLabel = VERTICAL_SHAPE_LABELS[contour.verticalShape];
  const dhwShapeLabel = HORIZONTAL_SHAPE_LABELS[contour.horizontalShape];

  return (
    <section
      className="fit-map-axis-display"
      aria-label="Service shape fit map"
      data-testid="fit-map-axis-display"
    >
      <h3 className="fit-map-axis-display__heading">Service shape</h3>
      <p className="fit-map-axis-display__subtitle">
        Derived from engine evidence — scores reflect real constraints, not family assumptions.
      </p>

      <div className="fit-map-axis-display__axes">
        <AxisPanel
          label="Heating stability"
          axisDescription="How reliably space heating is maintained without interruption."
          axisScore={heatingAxis}
          shapeLabel={heatingShapeLabel}
          testIdPrefix="heating"
        />
        <AxisPanel
          label="Hot water strength"
          axisDescription="How well the system handles concurrent or high-volume hot water demand."
          axisScore={dhwAxis}
          shapeLabel={dhwShapeLabel}
          testIdPrefix="dhw"
        />
      </div>

      {/* Optional efficiency score */}
      {efficiencyScore != null && (
        <div
          className="fit-map-axis-display__efficiency"
          data-testid="efficiency-score"
          aria-label={`Efficiency score: ${efficiencyScore} out of 100`}
        >
          <span className="fit-map-axis-display__efficiency-label">Efficiency</span>
          <span className="fit-map-axis-display__efficiency-value">{efficiencyScore}</span>
        </div>
      )}

      {/* Contour evidence notes */}
      {contour.evidenceNotes.length > 0 && (
        <div className="fit-map-axis-display__contour-notes">
          <div className="fit-map-axis-display__contour-notes-heading">Shape notes</div>
          <ul className="fit-map-axis-display__contour-notes-list">
            {contour.evidenceNotes.map((note) => (
              <li key={note} className="fit-map-axis-display__contour-note">{note}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
