/**
 * RouteTypePicker.tsx
 *
 * Visual tile picker for selecting a pipework route type.
 *
 * Renders one tile per supported `PipeworkRouteKind`, grouped by MVP
 * priority.  The selected tile is highlighted with the standard
 * `qp-tile--selected` class.
 *
 * Design rules:
 *   - Pure presentational — receives `selected` and `onSelect` from parent.
 *   - No recommendation logic — route type selection is an engineer decision.
 *   - Does not output customer-facing copy.
 */

import type { PipeworkRouteKind } from '../../model/QuoteInstallationPlanV1';

// ─── Route kind metadata ──────────────────────────────────────────────────────

interface RouteKindMeta {
  kind:  PipeworkRouteKind;
  icon:  string;
  label: string;
  hint:  string;
}

const ROUTE_KINDS: RouteKindMeta[] = [
  {
    kind:  'gas',
    icon:  '🔥',
    label: 'Gas supply',
    hint:  'Gas supply pipe from meter to appliance.',
  },
  {
    kind:  'heating_flow',
    icon:  '♨️',
    label: 'Heating flow',
    hint:  'Primary flow pipe from boiler / heat pump to heat emitters.',
  },
  {
    kind:  'heating_return',
    icon:  '↩️',
    label: 'Heating return',
    hint:  'Return pipe from heat emitters back to boiler / heat pump.',
  },
  {
    kind:  'condensate',
    icon:  '🪣',
    label: 'Condensate',
    hint:  'Condensate drain from boiler to discharge point.',
  },
  {
    kind:  'hot_water',
    icon:  '🌡️',
    label: 'Hot water',
    hint:  'Domestic hot-water supply pipe.',
  },
  {
    kind:  'cold_main',
    icon:  '💧',
    label: 'Cold main',
    hint:  'Mains cold-water supply pipe.',
  },
  {
    kind:  'discharge',
    icon:  '⬇️',
    label: 'Discharge pipe',
    hint:  'Safety / pressure-relief discharge pipe.',
  },
  {
    kind:  'controls',
    icon:  '🎛️',
    label: 'Controls wiring',
    hint:  'Electrical controls or zone-valve wiring run.',
  },
];

// ─── Human-readable labels (exported for shared use) ─────────────────────────

export const PIPEWORK_ROUTE_KIND_LABELS: Record<PipeworkRouteKind, string> =
  Object.fromEntries(ROUTE_KINDS.map(({ kind, label }) => [kind, label])) as Record<
    PipeworkRouteKind,
    string
  >;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RouteTypePickerProps {
  /** Currently selected route kind, or `null` when none is selected yet. */
  selected: PipeworkRouteKind | null;
  /** Called with the new kind when a tile is pressed. */
  onSelect: (kind: PipeworkRouteKind) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RouteTypePicker({ selected, onSelect }: RouteTypePickerProps) {
  return (
    <div className="qp-tile-grid" role="group" aria-label="Route type">
      {ROUTE_KINDS.map(({ kind, icon, label, hint }) => {
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
          </button>
        );
      })}
    </div>
  );
}
