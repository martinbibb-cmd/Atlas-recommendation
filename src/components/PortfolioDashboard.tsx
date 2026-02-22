/**
 * PortfolioDashboard
 *
 * Housing Association / large-landlord fleet health portal.
 * Displays portfolio properties ranked by kettling + sludge risk,
 * with MCS and Legionella compliance status for each asset.
 */
import { useState } from 'react';
import { analysePortfolio } from '../engine/modules/PortfolioAnalyzer';
import type { PortfolioProperty, PortfolioPropertyResult } from '../engine/schema/EngineInputV2_3';

interface Props {
  properties: PortfolioProperty[];
  onBack?: () => void;
}

function riskBadge(score: number) {
  if (score >= 7) return { label: 'CRITICAL', color: '#c53030', bg: '#fff5f5' };
  if (score >= 4) return { label: 'MODERATE', color: '#c05621', bg: '#fffaf0' };
  return { label: 'LOW', color: '#276749', bg: '#f0fff4' };
}

function healthBar(score: number) {
  const color = score >= 70 ? '#48bb78' : score >= 40 ? '#ed8936' : '#e53e3e';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color, minWidth: 32 }}>{score}</span>
    </div>
  );
}

function PropertyRow({ prop }: { prop: PortfolioPropertyResult }) {
  const [expanded, setExpanded] = useState(false);
  const combinedRisk = prop.kettlingRiskScore + prop.magnetiteRiskScore;
  const badge = riskBadge(Math.max(prop.kettlingRiskScore, prop.magnetiteRiskScore));
  const hasCompliance = prop.complianceAlerts.length > 0;

  return (
    <>
      <tr
        onClick={() => setExpanded(prev => !prev)}
        style={{ cursor: 'pointer', background: expanded ? '#f7fafc' : undefined }}
      >
        <td style={{ padding: '10px 8px', fontWeight: 600, fontSize: '0.85rem' }}>
          {prop.address}
        </td>
        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
          <span style={{
            padding: '2px 8px', borderRadius: 12,
            background: badge.bg, color: badge.color,
            fontSize: '0.75rem', fontWeight: 700,
          }}>{badge.label}</span>
        </td>
        <td style={{ padding: '10px 8px', fontSize: '0.82rem' }}>
          {prop.kettlingRiskScore.toFixed(1)} / 10
        </td>
        <td style={{ padding: '10px 8px', fontSize: '0.82rem' }}>
          {prop.magnetiteRiskScore.toFixed(1)} / 10
        </td>
        <td style={{ padding: '10px 8px', minWidth: 120 }}>
          {healthBar(prop.overallHealthScore)}
        </td>
        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
          {hasCompliance ? (
            <span style={{ color: '#c53030', fontWeight: 700, fontSize: '0.8rem' }}>
              ⚠️ {prop.complianceAlerts.length}
            </span>
          ) : (
            <span style={{ color: '#276749', fontSize: '0.8rem' }}>✅</span>
          )}
        </td>
        <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '0.8rem', color: '#718096' }}>
          {combinedRisk.toFixed(1)} {expanded ? '▲' : '▼'}
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: '#f7fafc' }}>
          <td colSpan={7} style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
            {prop.complianceAlerts.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <strong style={{ color: '#c53030' }}>Compliance Alerts:</strong>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                  {prop.complianceAlerts.map((a, i) => (
                    <li key={i} style={{ color: '#c53030', marginBottom: 2 }}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {prop.recommendedActions.length > 0 && (
              <div>
                <strong style={{ color: '#2c5282' }}>Recommended Actions:</strong>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                  {prop.recommendedActions.map((a, i) => (
                    <li key={i} style={{ color: '#4a5568', marginBottom: 2 }}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function PortfolioDashboard({ properties, onBack }: Props) {
  const result = analysePortfolio(properties);

  return (
    <div className="stepper-container">
      <div className="stepper-header">
        {onBack && (
          <button className="back-btn" onClick={onBack}>← Back</button>
        )}
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2d3748', margin: 0 }}>
          🏘️ Portfolio Asset Dashboard
        </h2>
      </div>

      {/* Fleet summary cards */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {[
          { label: 'Fleet Health Score', value: `${result.fleetAverageHealthScore}/100`, color: result.fleetAverageHealthScore >= 70 ? '#276749' : '#c05621' },
          { label: 'Critical Assets', value: result.criticalAssetCount, color: result.criticalAssetCount > 0 ? '#c53030' : '#276749' },
          { label: 'Compliance Failures', value: result.complianceFailureCount, color: result.complianceFailureCount > 0 ? '#c05621' : '#276749' },
          { label: 'Total Properties', value: properties.length, color: '#2c5282' },
        ].map(card => (
          <div key={card.label} style={{
            flex: 1, minWidth: 130,
            background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
            padding: '12px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.72rem', color: '#718096', marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Ranked table */}
      <div className="result-section" style={{ overflowX: 'auto' }}>
        <h3>📊 Assets Ranked by Risk (Highest First)</h3>
        {properties.length === 0 ? (
          <p style={{ color: '#718096', fontSize: '0.875rem' }}>
            No properties in portfolio. Add properties to begin analysis.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>Property</th>
                <th style={{ padding: '8px' }}>Risk Level</th>
                <th style={{ padding: '8px' }}>Kettling Risk</th>
                <th style={{ padding: '8px' }}>Sludge Risk</th>
                <th style={{ padding: '8px' }}>Health Score</th>
                <th style={{ padding: '8px' }}>Compliance</th>
                <th style={{ padding: '8px' }}>Combined</th>
              </tr>
            </thead>
            <tbody>
              {result.rankedByRisk.map(prop => (
                <PropertyRow key={prop.assetId} prop={prop} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: '0.5rem' }}>
        Click any row to expand compliance alerts and recommended actions.
      </p>
    </div>
  );
}
