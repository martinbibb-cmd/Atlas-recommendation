/**
 * SystemFlowView — horizontal "Source → Control → Heat → Distribution → Outlet" diagram.
 *
 * Groups blocks by category and renders them in a left-to-right pipeline view.
 */

import type { LegoScenario, LegoBlock, BlockCategory } from '../schema/legoTypes';
import type { CapacityChainResult } from '../model/dhwModel';
import { BLOCK_CATALOG } from '../catalog/blockCatalog';

// ─── Category order ────────────────────────────────────────────────────────────

const CATEGORY_ORDER: BlockCategory[] = [
  'pressure_source',
  'flow_restriction',
  'heat_source',
  'storage',
  'control_switching',
  'distribution',
  'outlet_demand',
];

const CATEGORY_LABEL: Record<BlockCategory, string> = {
  pressure_source:   'Source',
  flow_restriction:  'Restriction',
  heat_source:       'Heat',
  storage:           'Storage',
  control_switching: 'Control',
  distribution:      'Distribution',
  outlet_demand:     'Outlet',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  scenario: LegoScenario;
  computed: CapacityChainResult;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SystemFlowView({ scenario, computed }: Props) {
  const { limitingComponent } = computed;

  // Group blocks by category, preserving order within each group
  const grouped = new Map<BlockCategory, LegoBlock[]>();
  for (const cat of CATEGORY_ORDER) grouped.set(cat, []);

  for (const block of scenario.graph.blocks) {
    const entry = BLOCK_CATALOG[block.type];
    if (!entry) continue;
    grouped.get(entry.category)?.push(block);
  }

  // Only render non-empty columns
  const columns = CATEGORY_ORDER.filter(cat => (grouped.get(cat)?.length ?? 0) > 0);

  return (
    <div className="sysflow-view">
      <h3 className="sysflow-view__title">{scenario.meta.name}</h3>
      <p className="sysflow-view__desc">{scenario.meta.description}</p>

      <div className="sysflow-view__pipeline" role="img" aria-label="System flow diagram">
        {columns.map((cat, colIdx) => (
          <div key={cat} className="sysflow-col">
            <div className="sysflow-col__header">{CATEGORY_LABEL[cat]}</div>
            <div className="sysflow-col__blocks">
              {(grouped.get(cat) ?? []).map(block => {
                const entry = BLOCK_CATALOG[block.type];
                const label = entry?.label ?? block.type;
                const isLimit = label === limitingComponent;
                return (
                  <div
                    key={block.id}
                    className={`sysflow-block${isLimit ? ' sysflow-block--limit' : ''}`}
                  >
                    <span className="sysflow-block__label">
                      {label}
                      {isLimit && <span className="sysflow-block__badge"> ← limit</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            {colIdx < columns.length - 1 && (
              <div className="sysflow-col__arrow" aria-hidden="true">→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
