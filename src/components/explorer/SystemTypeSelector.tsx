/**
 * SystemTypeSelector.tsx
 *
 * Horizontal tab strip to switch between the 6 heating system types.
 * Shows each system's short label, accent colour, and key trait.
 */

import type { SystemTypeId } from './explorerTypes';
import { SYSTEM_CONFIGS, SYSTEM_TYPE_ORDER } from './systemConfigs';

interface Props {
  selectedId: SystemTypeId;
  onChange: (id: SystemTypeId) => void;
}

const SYSTEM_TRAITS: Record<string, string> = {
  combi:            'No cylinder · on-demand DHW',
  stored_vented:    'Gravity-fed · loft tanks',
  stored_unvented:  'Mains-pressure · G3 required',
  ashp:             'Low flow temp · 45°C fast-fit',
  regular_vented:   'Open-vented · traditional',
  system_unvented:  'Sealed primary · mains-pressure',
};

export default function SystemTypeSelector({ selectedId, onChange }: Props) {
  return (
    <div className="sys-selector" role="tablist" aria-label="Select heating system type">
      <span className="sys-selector__label">System type:</span>
      <div className="sys-selector__tabs">
        {SYSTEM_TYPE_ORDER.map(id => {
          const cfg = SYSTEM_CONFIGS[id];
          if (!cfg) return null;
          const active = id === selectedId;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              className={`sys-selector__tab ${active ? 'sys-selector__tab--active' : ''}`}
              style={active ? {
                borderColor: cfg.accentColor,
                color: cfg.accentColor,
                background: `${cfg.accentColor}12`,
              } : undefined}
              onClick={() => onChange(cfg.id)}
              title={cfg.description}
            >
              <span className="sys-selector__tab-label">{cfg.shortLabel}</span>
              <span className="sys-selector__tab-trait">{SYSTEM_TRAITS[id]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
