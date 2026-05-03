/**
 * QuotePlannerStepTile.tsx
 *
 * Reusable large-tile card for the Quote Planner stepper.
 *
 * Renders a button with an icon, a text label, an optional badge (e.g.
 * "Atlas Pick"), and selected/hover visual state.
 *
 * Accessibility: uses `aria-pressed` to communicate selection state.
 */

export interface QuotePlannerStepTileProps {
  /** Emoji or text icon displayed at the top of the tile. */
  icon: string;
  /** Primary label shown below the icon. */
  label: string;
  /** Whether this tile is currently selected. */
  selected: boolean;
  /** Optional badge text rendered in the tile corner (e.g. "Atlas Pick"). */
  badge?: string;
  /** Called when the tile is clicked. */
  onClick: () => void;
}

export function QuotePlannerStepTile({
  icon,
  label,
  selected,
  badge,
  onClick,
}: QuotePlannerStepTileProps) {
  return (
    <button
      type="button"
      className={`qp-tile${selected ? ' qp-tile--selected' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
    >
      {badge !== undefined && (
        <span className="qp-tile__badge" aria-label={badge}>
          {badge}
        </span>
      )}
      <span className="qp-tile__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="qp-tile__label">{label}</span>
    </button>
  );
}
