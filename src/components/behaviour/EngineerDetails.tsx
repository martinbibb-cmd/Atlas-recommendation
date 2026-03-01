/**
 * EngineerDetails.tsx
 *
 * Collapsible "Engine Ledger" panel for engineer mode.
 *
 * Shows:
 *   - Normalized inputs summary
 *   - Key derived values (hydraulics, efficiency, etc.)
 *   - Assumptions + sources
 *
 * Only rendered when engineer mode is enabled.
 */
import { useState } from 'react';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';

interface Props {
  output: EngineOutputV1;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#718096',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 6,
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: 4,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string | number | undefined | null }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
        padding: '3px 0',
        borderBottom: '1px solid #f7fafc',
        gap: 8,
      }}
    >
      <span style={{ color: '#4a5568', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#2d3748', fontWeight: 600, fontFamily: 'monospace', textAlign: 'right' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

export default function EngineerDetails({ output }: Props) {
  const [open, setOpen] = useState(false);

  const assumptions = output.meta?.assumptions ?? [];
  const evidence = output.evidence ?? [];
  const limiters = output.limiters?.limiters ?? [];

  return (
    <div
      className="engineer-details"
      style={{
        background: '#f7fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        marginBottom: 20,
        overflow: 'hidden',
      }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 600,
          color: '#4a5568',
        }}
        aria-expanded={open}
      >
        <span>🔬 Engineer Details</span>
        <span style={{ fontSize: 18, color: '#a0aec0' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>

          {/* Verdict / recommendation */}
          <Section title="Verdict">
            <KV label="Primary recommendation" value={output.recommendation.primary} />
            {output.verdict && (
              <>
                <KV label="Status" value={output.verdict.status} />
                <KV label="Confidence" value={output.verdict.confidence.level} />
              </>
            )}
          </Section>

          {/* Evidence items */}
          {evidence.length > 0 && (
            <Section title="Evidence">
              {evidence.map(ev => (
                <KV key={ev.id} label={ev.label} value={`${ev.value} (${ev.source}, ${ev.confidence})`} />
              ))}
            </Section>
          )}

          {/* Limiters (IDs) */}
          {limiters.length > 0 && (
            <Section title="Active Limiters">
              {limiters.map(l => (
                <KV key={l.id} label={l.id} value={`${l.severity} — ${l.observed.value} ${l.observed.unit}`} />
              ))}
            </Section>
          )}

          {/* Assumptions */}
          {assumptions.length > 0 && (
            <Section title="Assumptions">
              {assumptions.map(a => (
                <div
                  key={a.id}
                  style={{
                    fontSize: 12,
                    padding: '4px 0',
                    borderBottom: '1px solid #f0f0f0',
                    color: '#4a5568',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      background: a.severity === 'warn' ? '#fef3c7' : '#ebf8ff',
                      border: `1px solid ${a.severity === 'warn' ? '#f59e0b' : '#90cdf4'}`,
                      borderRadius: 3,
                      padding: '1px 5px',
                      marginRight: 6,
                      fontSize: 10,
                      color: a.severity === 'warn' ? '#92400e' : '#2b6cb0',
                    }}
                  >
                    {a.severity.toUpperCase()}
                  </span>
                  <span style={{ fontWeight: 600 }}>{a.title}</span>
                  {' — '}
                  <span style={{ color: '#718096' }}>{a.detail}</span>
                </div>
              ))}
            </Section>
          )}

          {/* Eligibility table */}
          <Section title="Eligibility">
            {output.eligibility.map(e => (
              <KV
                key={e.id}
                label={e.label}
                value={`${e.status}${e.reason ? ` — ${e.reason}` : ''}`}
              />
            ))}
          </Section>

          {/* Red flags */}
          {output.redFlags.length > 0 && (
            <Section title="Red Flags">
              {output.redFlags.map((f, i) => (
                <KV key={i} label={`[${f.severity.toUpperCase()}] ${f.title}`} value={f.detail} />
              ))}
            </Section>
          )}

          {/* Behaviour timeline summary */}
          {output.behaviourTimeline && (
            <Section title="Behaviour Timeline">
              <KV label="Resolution" value={`${output.behaviourTimeline.resolutionMins} min`} />
              <KV label="Points" value={output.behaviourTimeline.points.length} />
              <KV label="Appliance" value={output.behaviourTimeline.labels.applianceName} />
              <KV label="Efficiency label" value={output.behaviourTimeline.labels.efficiencyLabel} />
              <KV
                label="Peak heat demand"
                value={`${Math.max(...output.behaviourTimeline.points.map(p => p.heatDemandKw)).toFixed(2)} kW`}
              />
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
