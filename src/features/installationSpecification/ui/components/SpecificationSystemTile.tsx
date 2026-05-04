/**
 * SpecificationSystemTile.tsx
 *
 * Large visual tile for the Installation Specification system selector.
 *
 * Shows a system schematic image (or an icon fallback when no image is
 * available), a bold title, a short descriptive subtitle, and a strong
 * selected-state border.
 *
 * Accessibility: aria-pressed communicates selection state; aria-label
 * combines the title and subtitle for screen readers.
 */

export interface SpecificationSystemTileProps {
  /** Internal value identifier for this tile. */
  value: string;
  /** Bold title shown below the image (e.g. "Combination boiler"). */
  title: string;
  /** Short subtitle (e.g. "On-demand hot water"). */
  subtitle: string;
  /** URL for the system schematic image. Pass null to show the icon fallback. */
  imageSrc: string | null;
  /** Alt text for the image — defaults to the title when omitted. */
  imageAlt?: string;
  /** Whether this tile is currently selected. */
  selected: boolean;
  /** Optional badge text rendered in the tile corner (e.g. "Atlas selected"). */
  badge?: string;
  /** Called when the tile is clicked. */
  onClick: () => void;
}

export function SpecificationSystemTile({
  title,
  subtitle,
  imageSrc,
  imageAlt,
  selected,
  badge,
  onClick,
}: SpecificationSystemTileProps) {
  return (
    <button
      type="button"
      className={`spec-sys-tile${selected ? ' spec-sys-tile--selected' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${title} — ${subtitle}`}
    >
      {badge !== undefined && (
        <span className="spec-sys-tile__badge" aria-label={badge}>
          {badge}
        </span>
      )}
      <div className="spec-sys-tile__image-area">
        {imageSrc !== null ? (
          <img
            src={imageSrc}
            alt={imageAlt ?? title}
            className="spec-sys-tile__image"
            loading="lazy"
          />
        ) : (
          <span className="spec-sys-tile__image-placeholder" aria-hidden="true">
            🔧
          </span>
        )}
      </div>
      <span className="spec-sys-tile__title">{title}</span>
      <span className="spec-sys-tile__subtitle">{subtitle}</span>
    </button>
  );
}
