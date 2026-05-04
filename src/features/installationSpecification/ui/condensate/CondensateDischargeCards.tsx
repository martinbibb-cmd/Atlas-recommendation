/**
 * CondensateDischargeCards.tsx
 *
 * Visual tile picker for selecting the condensate discharge method.
 *
 * Renders one card per discharge kind. Each card shows a schematic icon,
 * label, and a one-line hint describing the route type.
 *
 * Design rules:
 *   - Pure presentational — receives `selected` and `onSelect` from the parent.
 *   - No recommendation logic — discharge selection is an engineer decision.
 *   - Does not output customer-facing copy.
 */

import type { CondensateDischargeKind } from '../../model/QuoteInstallationPlanV1';
import { CONDENSATE_DISCHARGE_LABELS } from '../../model/condensateActions';

export { CONDENSATE_DISCHARGE_LABELS };

// ─── Metadata ─────────────────────────────────────────────────────────────────

interface CondensateDischargeCardMeta {
  kind:      CondensateDischargeKind;
  icon:      string;
  label:     string;
  hint:      string;
  /** True when the route involves an external section (freeze-risk applies). */
  isExternal: boolean;
}

const DISCHARGE_CARDS: CondensateDischargeCardMeta[] = [
  {
    kind:       'internal_waste',
    icon:       '🪣',
    label:      'Internal waste',
    hint:       'Routed to an internal sink trap, basin waste, or soil stack.',
    isExternal: false,
  },
  {
    kind:       'external_gully',
    icon:       '🌧',
    label:      'External gully',
    hint:       'Terminated at an external gully at ground level.',
    isExternal: true,
  },
  {
    kind:       'soakaway',
    icon:       '⬇️',
    label:      'Soakaway',
    hint:       'Terminated at a soakaway — soil permeability check required.',
    isExternal: true,
  },
  {
    kind:       'condensate_pump',
    icon:       '⚙️',
    label:      'Condensate pump',
    hint:       'Lifted via a condensate pump to an internal discharge point.',
    isExternal: false,
  },
  {
    kind:       'external_trace_heat',
    icon:       '🌡',
    label:      'External with trace heat',
    hint:       'External run with trace heating to prevent freezing in cold weather.',
    isExternal: true,
  },
];

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
      {DISCHARGE_CARDS.map(({ kind, icon, label, hint, isExternal }) => {
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
            <span className="qp-tile__icon" aria-hidden="true">{icon}</span>
            <span className="qp-tile__label">{label}</span>
            {isExternal && (
              <span className="condensate-tile__freeze-badge" aria-label="Freeze risk — external run">
                Freeze risk
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
