/**
 * EvidenceConfidenceSection — measured vs estimated / missing input
 * messaging and confidence badges.
 *
 * Extracted from LiveSectionPage so it can be composed inside
 * LiveSectionShell independently of the section routing layer.
 */
import type { FullEngineResult } from '../../../engine/schema/EngineInputV2_3';

interface Props {
  result: FullEngineResult;
}

const BADGE_ALPHA = '26'; // ~15% opacity hex suffix

function confidenceColour(confidence: string): string {
  if (confidence === 'high') return '#38a169';
  if (confidence === 'medium') return '#d69e2e';
  return '#e53e3e';
}

function sourceColour(source: string): string {
  if (source === 'measured') return '#3182ce';
  if (source === 'derived') return '#805ad5';
  if (source === 'assumed') return '#d69e2e';
  return '#718096';
}

export default function EvidenceConfidenceSection({ result }: Props) {
  const { engineOutput } = result;

  if (!engineOutput.evidence || engineOutput.evidence.length === 0) {
    return (
      <div className="result-section">
        <p style={{ color: '#718096' }}>No evidence data available for this result.</p>
      </div>
    );
  }

  return (
    <div className="result-section">
      <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '0.75rem' }}>
        What the engine knows, how it knows it, and how confident it is.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Input</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Value</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Source</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Confidence</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Affects</th>
            </tr>
          </thead>
          <tbody>
            {engineOutput.evidence.map(item => {
              const cColour = confidenceColour(item.confidence);
              const sColour = sourceColour(item.source);
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#2d3748' }}>
                    {item.label}
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{item.value}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: sColour + BADGE_ALPHA,
                        color: sColour,
                      }}
                    >
                      {item.source}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: cColour + BADGE_ALPHA,
                        color: cColour,
                      }}
                    >
                      {item.confidence}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#718096', fontSize: '0.75rem' }}>
                    {item.affectsOptionIds.join(', ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
