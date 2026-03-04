/**
 * PlumbingStackView — vertical "house reality" representation of a LegoScenario.
 *
 * Renders each block as a stacked row: icon + label + key params.
 * Edges are implied by order; no arrows in v1.
 */

import type { LegoScenario, LegoBlock } from '../schema/legoTypes';
import type { CapacityChainResult } from '../model/dhwModel';
import { BLOCK_CATALOG } from '../catalog/blockCatalog';

// ─── Icons (emoji for v1) ─────────────────────────────────────────────────────

const BLOCK_ICON: Partial<Record<string, string>> = {
  mains_supply:          '🚰',
  tank_head:             '🪣',
  whole_house_booster:   '⬆️',
  pipe_section:          '🔩',
  outlet_restriction:    '🚿',
  unvented_inlet_group:  '🔐',
  boiler_combi_dhw_hex:  '🔥',
  boiler_primary:        '🔥',
  heat_pump_primary:     '♨️',
  immersion_heater:      '⚡',
  cylinder_vented:       '🛢️',
  cylinder_unvented:     '🛢️',
  buffer_tank:           '🪣',
  diverter_valve:        '🔀',
  flow_sensor_gate:      '🚦',
  branch_splitter:       '🔱',
  draw_event:            '💧',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  scenario: LegoScenario;
  computed: CapacityChainResult;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlumbingStackView({ scenario, computed }: Props) {
  const { limitingComponent } = computed;

  return (
    <div className="stack-view">
      <h3 className="stack-view__title">{scenario.meta.name}</h3>
      <p className="stack-view__desc">{scenario.meta.description}</p>

      <div className="stack-view__list">
        {scenario.graph.blocks.map((block, idx) => (
          <BlockRow
            key={block.id}
            block={block}
            isLast={idx === scenario.graph.blocks.length - 1}
            limitingLabel={limitingComponent}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Block row ────────────────────────────────────────────────────────────────

function BlockRow({
  block,
  isLast,
  limitingLabel,
}: {
  block: LegoBlock;
  isLast: boolean;
  limitingLabel: string | undefined;
}) {
  const entry = BLOCK_CATALOG[block.type];
  const icon = BLOCK_ICON[block.type] ?? '⬜';
  const label = entry?.label ?? block.type;
  const isLimit = label === limitingLabel;

  // Build a one-line param summary
  const paramSummary = Object.entries(block.params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(' · ');

  return (
    <div className={`stack-row${isLimit ? ' stack-row--limit' : ''}`}>
      <div className="stack-row__icon-col">
        <span className="stack-row__icon">{icon}</span>
        {!isLast && <div className="stack-row__connector" aria-hidden="true" />}
      </div>
      <div className="stack-row__body">
        <span className="stack-row__label">
          {label}
          {isLimit && <span className="stack-row__badge"> ← bottleneck</span>}
        </span>
        {paramSummary && (
          <span className="stack-row__params">{paramSummary}</span>
        )}
      </div>
    </div>
  );
}
