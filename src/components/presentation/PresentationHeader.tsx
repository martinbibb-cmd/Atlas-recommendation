/**
 * PresentationHeader.tsx — Presentation Layer v1.
 *
 * Top strip of the PresentationFlow screen:
 *   Left  — home summary chips (bed count, bathrooms, pipes, pressure)
 *   Centre — "In-room Presentation" label
 *   Right  — family selector pills (Combi | Stored | Heat pump)
 *            Pills for the current and recommended families are annotated.
 *
 * The family pills are the primary system-selector control on this screen.
 */

import type { SelectableFamily } from '../family-view/useSelectedFamilyData';
import './PresentationHeader.css';

// ─── Display helpers ──────────────────────────────────────────────────────────

const FAMILY_PILL_LABELS: { family: SelectableFamily; label: string }[] = [
  { family: 'combi',        label: 'On-demand' },
  { family: 'stored_water', label: 'Stored' },
  { family: 'heat_pump',    label: 'Heat pump' },
  { family: 'open_vented',  label: 'Tank-fed' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Short descriptors about the home, e.g. ["3 bed semi", "1 bath", "22mm pipes"]. */
  homeSummary: string[];
  /** The family currently selected for analysis. */
  selectedFamily: SelectableFamily;
  /** Called when the user taps a family pill. */
  onSelectFamily: (family: SelectableFamily) => void;
  /** The family currently installed in the home. */
  currentFamily?: SelectableFamily;
  /** The recommended family for the home. */
  recommendedFamily?: SelectableFamily;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PresentationHeader({
  homeSummary,
  selectedFamily,
  onSelectFamily,
  currentFamily,
  recommendedFamily,
}: Props) {
  return (
    <header className="pres-header" role="banner">
      {/* Left — home summary chips */}
      <div className="pres-header__chips" aria-label="Home summary">
        {homeSummary.map((label) => (
          <span key={label} className="pres-header__chip">
            {label}
          </span>
        ))}
      </div>

      {/* Centre — screen title */}
      <span className="pres-header__title" aria-label="In-room Presentation">
        In-room Presentation
      </span>

      {/* Right — family selector pills */}
      <nav className="pres-header__families" aria-label="System family selector">
        {FAMILY_PILL_LABELS.map(({ family, label }) => {
          const isCurrent = family === currentFamily;
          const isRecommended = family === recommendedFamily;
          const badge = isRecommended ? '★' : isCurrent ? '·' : null;
          const ariaLabel = isRecommended
            ? `${label} — recommended`
            : isCurrent
              ? `${label} — current system`
              : label;
          return (
            <button
              key={family}
              className={`pres-header__family-pill ${selectedFamily === family ? 'pres-header__family-pill--active' : ''} ${isRecommended ? 'pres-header__family-pill--recommended' : ''} ${isCurrent && !isRecommended ? 'pres-header__family-pill--current' : ''}`}
              onClick={() => onSelectFamily(family)}
              aria-pressed={selectedFamily === family}
              aria-label={ariaLabel}
            >
              {label}
              {badge != null && (
                <span className="pres-header__pill-badge" aria-hidden="true">{badge}</span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
