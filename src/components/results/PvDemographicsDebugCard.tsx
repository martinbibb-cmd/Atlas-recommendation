/**
 * PvDemographicsDebugCard.tsx
 *
 * Temporary dev/debug card that exposes the canonical demographic and PV
 * assessment outputs so that surveyors can verify that changing household
 * composition, bath use, occupancy pattern, PV status, battery status, and
 * roof suitability visibly alters recommendation ranking and model truth.
 *
 * Render this card anywhere that has access to FullEngineResult.
 * It is intentionally styled as a debug/inspection panel — not presentation.
 */

import type { FullEngineResult, EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';

interface Props {
  result: FullEngineResult;
  /** Optional engine input — used to surface explicit pvStatus/batteryStatus fields. */
  input?: EngineInputV2_3;
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: '0.5rem',
  padding: '0.2rem 0',
  borderBottom: '1px dotted #e2e8f0',
  fontSize: '0.78rem',
};

const LABEL_STYLE: React.CSSProperties = {
  color: '#718096',
  flexShrink: 0,
};

const VALUE_STYLE: React.CSSProperties = {
  fontWeight: 600,
  color: '#2d3748',
  textAlign: 'right',
};

function Row({ label, value }: { label: string; value: string | number | boolean | undefined }) {
  const display =
    value === undefined  ? '—' :
    value === true       ? '✓ yes' :
    value === false      ? '✗ no' :
    String(value);
  return (
    <div style={ROW_STYLE}>
      <span style={LABEL_STYLE}>{label}</span>
      <span style={VALUE_STYLE}>{display}</span>
    </div>
  );
}

export default function PvDemographicsDebugCard({ result, input }: Props) {
  const demo = result.demographicOutputs;
  const pv   = result.pvAssessment;

  return (
    <div
      data-testid="pv-demographics-debug-card"
      style={{
        border: '1px dashed #cbd5e0',
        borderRadius: '8px',
        padding: '1rem',
        background: '#f7fafc',
        fontFamily: 'monospace',
      }}
    >
      <div style={{
        fontWeight: 700,
        fontSize: '0.8rem',
        color: '#4a5568',
        marginBottom: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        🔍 Model Inspection (dev)
      </div>

      {/* ─── Home demand ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{
          fontWeight: 600,
          fontSize: '0.75rem',
          color: '#4a5568',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: '0.25rem',
        }}>
          Home demand
        </div>
        <Row label="demand profile"           value={demo.demandProfileLabel} />
        <Row label="daily hot water (L)"      value={Math.round(demo.dailyHotWaterLitres)} />
        <Row label="peak simultaneous outlets" value={demo.peakSimultaneousOutlets} />
        <Row label="bath use intensity"        value={demo.bathUseIntensity} />
        <Row label="occupancy timing"          value={demo.occupancyTimingProfile} />
        <Row label="storage benefit signal"    value={demo.storageBenefitSignal} />
      </div>

      {/* ─── Solar / energy ───────────────────────────────────────────── */}
      <div>
        <div style={{
          fontWeight: 600,
          fontSize: '0.75rem',
          color: '#4a5568',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: '0.25rem',
        }}>
          Solar / energy
        </div>
        {input && <Row label="PV status (explicit)"      value={input.pvStatus ?? '—'} />}
        {input && <Row label="battery status (explicit)" value={input.batteryStatus ?? '—'} />}
        <Row label="has existing PV"           value={pv.hasExistingPv} />
        <Row label="battery planned"           value={pv.batteryPlanned} />
        <Row label="PV suitability"            value={pv.pvSuitability} />
        <Row label="generation timing profile" value={pv.pvGenerationTimingProfile} />
        <Row label="energy-demand alignment"   value={pv.energyDemandAlignment} />
        <Row label="solar storage opportunity" value={pv.solarStorageOpportunity} />
      </div>
    </div>
  );
}
