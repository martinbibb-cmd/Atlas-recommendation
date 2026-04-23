/**
 * ExistingSystemSection.tsx
 *
 * PR7 — Shows what Atlas captured about the currently installed system.
 *
 * Data comes from EngineerHandoff.existingSystem, which is derived from
 * AtlasDecisionV1.lifecycle + optional engineInput context. No customer
 * narrative — strictly operational facts.
 */

import type { EngineerHandoff } from '../../../contracts/EngineerHandoff';

interface Props {
  existingSystem: EngineerHandoff['existingSystem'];
}

const BOILER_TYPE_LABELS: Record<string, string> = {
  combi:        'Combi boiler',
  system:       'System boiler',
  regular:      'Regular (heat-only) boiler',
  back_boiler:  'Back boiler',
  unknown:      'Unknown type',
};

const DHW_ARCH_LABELS: Record<string, string> = {
  on_demand:       'On-demand DHW (mains-fed)',
  stored_standard: 'Stored DHW — standard unvented cylinder',
  stored_mixergy:  'Stored DHW — Mixergy cylinder',
  unknown:         'DHW architecture unknown',
};

function FactRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      padding: '0.35rem 0',
      borderBottom: '1px solid #f0f4f8',
      gap: '1rem',
    }}>
      <span style={{ fontSize: '0.78rem', color: '#718096', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '0.85rem', color: '#2d3748', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export function ExistingSystemSection({ existingSystem }: Props) {
  const { boilerType, boilerAgeYears, nominalOutputKw, hotWaterType } = existingSystem;

  const hasData = boilerType !== undefined || boilerAgeYears !== undefined ||
    nominalOutputKw !== undefined || hotWaterType !== undefined;

  return (
    <div
      data-testid="engineer-handoff-existing-system"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      <h2 style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', fontWeight: 700, color: '#2d3748' }}>
        🏠 Existing system
      </h2>

      {!hasData ? (
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#718096', fontStyle: 'italic' }}>
          No existing system data captured — confirm on arrival.
        </p>
      ) : (
        <div>
          {boilerType !== undefined && (
            <FactRow
              label="Boiler type"
              value={BOILER_TYPE_LABELS[boilerType] ?? boilerType}
            />
          )}
          {boilerAgeYears !== undefined && (
            <FactRow label="Approx. age" value={`${boilerAgeYears} years`} />
          )}
          {nominalOutputKw !== undefined && (
            <FactRow label="Rated output" value={`${nominalOutputKw} kW`} />
          )}
          {hotWaterType !== undefined && (
            <FactRow
              label="Hot water type"
              value={DHW_ARCH_LABELS[hotWaterType] ?? hotWaterType}
            />
          )}
        </div>
      )}
    </div>
  );
}
