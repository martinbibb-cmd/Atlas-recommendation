/**
 * PresentationHeader.tsx — Presentation Layer v1.
 *
 * Top strip of the PresentationFlow screen:
 *   Left  — home summary chips (bed count, bathrooms, pipes, pressure)
 *   Centre — "Simulator" label
 *   Right  — family selector pills (Combi | Stored | Heat pump)
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
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PresentationHeader({
  homeSummary,
  selectedFamily,
  onSelectFamily,
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
      <span className="pres-header__title" aria-label="Simulator">
        Simulator
      </span>

      {/* Right — family selector pills */}
      <nav className="pres-header__families" aria-label="System family selector">
        {FAMILY_PILL_LABELS.map(({ family, label }) => (
          <button
            key={family}
            className={`pres-header__family-pill ${selectedFamily === family ? 'pres-header__family-pill--active' : ''}`}
            onClick={() => onSelectFamily(family)}
            aria-pressed={selectedFamily === family}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
