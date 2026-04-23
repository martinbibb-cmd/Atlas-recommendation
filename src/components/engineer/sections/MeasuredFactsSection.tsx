/**
 * MeasuredFactsSection.tsx
 *
 * PR7 — Tabular display of measured and surveyed facts with source badges.
 *
 * Data comes from EngineerHandoff.measuredFacts, which aggregates
 * AtlasDecisionV1.supportingFacts and physics inputs from engineInput.
 * Source badges let the engineer see at a glance whether a value came
 * from the survey, the Atlas engine, or a quote.
 */

import type { EngineerHandoff, EngineerHandoffFact } from '../../../contracts/EngineerHandoff';

interface Props {
  measuredFacts: EngineerHandoff['measuredFacts'];
}

const SOURCE_CONFIG: Record<EngineerHandoffFact['source'], { label: string; color: string; bg: string; border: string }> = {
  survey: { label: 'Survey',  color: '#276749', bg: '#f0fff4', border: '#9ae6b4' },
  engine: { label: 'Engine',  color: '#2a4365', bg: '#ebf8ff', border: '#bee3f8' },
  quote:  { label: 'Quote',   color: '#744210', bg: '#fffff0', border: '#f6e05e' },
};

function SourceBadge({ source }: { source: EngineerHandoffFact['source'] }) {
  const cfg = SOURCE_CONFIG[source];
  return (
    <span style={{
      fontSize: '0.65rem',
      fontWeight: 700,
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      padding: '0.1rem 0.4rem',
      borderRadius: '4px',
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

export function MeasuredFactsSection({ measuredFacts }: Props) {
  if (measuredFacts.length === 0) return null;

  return (
    <div
      data-testid="engineer-handoff-facts"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      <h2 style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', fontWeight: 700, color: '#2d3748' }}>
        📐 Measured facts
      </h2>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {measuredFacts.map((fact, i) => (
            <tr
              key={i}
              style={{ borderBottom: '1px solid #f0f4f8' }}
            >
              <td style={{ padding: '0.35rem 0', fontSize: '0.78rem', color: '#718096', fontWeight: 600, width: '50%' }}>
                {fact.label}
              </td>
              <td style={{ padding: '0.35rem 0', fontSize: '0.85rem', color: '#2d3748', fontWeight: 500 }}>
                {fact.value}
              </td>
              <td style={{ padding: '0.35rem 0', textAlign: 'right' }}>
                <SourceBadge source={fact.source} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
