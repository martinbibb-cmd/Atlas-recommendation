/**
 * CondensateDischargeCards.tsx
 *
 * Visual tile picker for selecting the condensate discharge method.
 *
 * Renders one card per discharge kind. Each card shows a schematic image (or
 * icon fallback), label, a one-line hint, and badges for freeze risk or
 * maintenance considerations where applicable.
 *
 * External trace heating is NOT offered as a normal selectable option.
 * Plans carrying the legacy `external_trace_heat` value should use
 * `LegacyCondensateWarning` to prompt the surveyor to update the route.
 *
 * Design rules:
 *   - Pure presentational — receives `selected` and `onSelect` from the parent.
 *   - No recommendation logic — discharge selection is a surveyor decision.
 *   - Does not output customer-facing copy.
 */

import type { CondensateDischargeKind } from '../../model/QuoteInstallationPlanV1';
import { CONDENSATE_DISCHARGE_LABELS } from '../../model/condensateActions';

export { CONDENSATE_DISCHARGE_LABELS };

// ─── Metadata ─────────────────────────────────────────────────────────────────

interface CondensateDischargeCardMeta {
  kind:        CondensateDischargeKind;
  /** Emoji icon shown as fallback when no image is available. */
  icon:        string;
  /** Path to a schematic image, or null to use the icon fallback. */
  imageSrc:    string | null;
  label:       string;
  hint:        string;
  /** True when the route involves an external section (freeze-risk applies). */
  isExternal:  boolean;
  /** Additional consideration badge text, e.g. maintenance note. */
  note?:       string;
}

const DISCHARGE_CARDS: CondensateDischargeCardMeta[] = [
  {
    kind:      'internal_waste',
    icon:      '🪣',
    imageSrc:  '/images/systems/condensate.svg',
    label:     'Internal waste',
    hint:      'Routed to an internal sink trap, basin waste, or soil stack.',
    isExternal: false,
  },
  {
    kind:      'external_gully',
    icon:      '🌧',
    imageSrc:  null,
    label:     'External gully',
    hint:      'Terminated at an external gully at ground level.',
    isExternal: true,
  },
  {
    kind:      'soakaway',
    icon:      '⬇️',
    imageSrc:  null,
    label:     'Soakaway',
    hint:      'Terminated at a soakaway — soil permeability check required.',
    isExternal: true,
  },
  {
    kind:      'condensate_pump',
    icon:      '⚙️',
    imageSrc:  null,
    label:     'Condensate pump',
    hint:      'Lifted via a condensate pump to an internal discharge point.',
    isExternal: false,
    note:      'Power and maintenance consideration',
  },
];

// ─── Legacy warning ───────────────────────────────────────────────────────────

/**
 * Warning banner shown when a saved plan contains the legacy
 * `external_trace_heat` condensate option.
 *
 * The surveyor must select one of the current discharge routes before the
 * specification can be completed.
 */
export function LegacyCondensateWarning() {
  return (
    <div
      className="condensate-legacy-warning"
      role="alert"
      data-testid="condensate-legacy-warning"
    >
      <span className="condensate-legacy-warning__icon" aria-hidden="true">⚠️</span>
      <span className="condensate-legacy-warning__text">
        Legacy condensate option — update specification.
        Select a current discharge route before completing the specification.
      </span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CondensateDischargeCardsProps {
  /** Currently selected discharge kind, or `null` when none is selected. */
  selected: CondensateDischargeKind | null;
  /** Called with the new discharge kind when a card is pressed. */
  onSelect: (kind: CondensateDischargeKind) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CondensateDischargeCards({ selected, onSelect }: CondensateDischargeCardsProps) {
  return (
    <div className="qp-tile-grid" role="group" aria-label="Condensate discharge method">
      {DISCHARGE_CARDS.map(({ kind, icon, imageSrc, label, hint, isExternal, note }) => {
        const isSelected = selected === kind;
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={isSelected}
            aria-label={label}
            title={hint}
            className={`qp-tile${isSelected ? ' qp-tile--selected' : ''}`}
            onClick={() => onSelect(kind)}
          >
            <div className="qp-tile__image-area">
              {imageSrc !== null ? (
                <img
                  src={imageSrc}
                  alt={label}
                  className="qp-tile__image"
                  loading="lazy"
                />
              ) : (
                <span className="qp-tile__icon" aria-hidden="true">{icon}</span>
              )}
            </div>
            <span className="qp-tile__label">{label}</span>
            {isExternal && (
              <span className="condensate-tile__freeze-badge" aria-label="Freeze risk — external run">
                Freeze risk
              </span>
            )}
            {note !== undefined && (
              <span className="condensate-tile__note">
                {note}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
