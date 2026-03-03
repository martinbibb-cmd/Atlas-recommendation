/**
 * CurrentSituationSection — /live/current
 *
 * Current situation summary: eligibility grid, options headline, red flags,
 * and the engine recommendation banner.
 */
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';

interface Props {
  result: FullEngineResult;
}

export default function CurrentSituationSection({ result }: Props) {
  const { engineOutput } = result;

  return (
    <>
      {/* Your situation */}
      {engineOutput.contextSummary && (
        <div className="result-section">
          <h3>Your Situation</h3>
          <ul className="context-summary-list">
            {engineOutput.contextSummary.bullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </div>
      )}

      {/* System eligibility */}
      <div className="result-section">
        <h3>🚩 System Eligibility</h3>
        <div className="verdict-grid">
          {engineOutput.eligibility.map(item => {
            const statusClass =
              item.status === 'rejected' ? 'rejected'
              : item.status === 'caution' ? 'flagged'
              : 'approved';
            const statusLabel =
              item.status === 'rejected' ? '❌ Rejected'
              : item.status === 'caution' ? '⚠️ Caution'
              : '✅ Viable';
            return (
              <div key={item.id} className={`verdict-item ${statusClass}`}>
                <div className="verdict-label">{item.label}</div>
                <div className="verdict-status">{statusLabel}</div>
              </div>
            );
          })}
        </div>
        {engineOutput.redFlags.length > 0 && (
          <ul className="red-flag-list" style={{ marginTop: '1rem' }}>
            {engineOutput.redFlags.map(flag => (
              <li key={flag.id} className={flag.severity === 'fail' ? 'reject' : 'flag'}>
                <strong>{flag.title}:</strong> {flag.detail}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Options summary */}
      {engineOutput.options && engineOutput.options.length > 0 && (
        <div className="result-section">
          <h3>🔍 Options at a Glance</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {engineOutput.options.map(card => {
              const statusClass =
                card.status === 'rejected' ? 'rejected'
                : card.status === 'caution' ? 'caution'
                : 'viable';
              const statusLabel =
                card.status === 'rejected' ? '❌ Not suitable'
                : card.status === 'caution' ? '⚠️ Possible'
                : '✅ Suitable';
              return (
                <div key={card.id} className={`option-card option-card--${statusClass}`}>
                  <div className="option-card__title">
                    <span className="option-card__label">{card.label}</span>
                    <span className={`option-card__status option-card__status--${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="option-card__headline">{card.headline}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendation */}
      <div className="result-section">
        <h3>📋 Recommendation</h3>
        <div
          className="recommendation-banner"
          style={{
            padding: '1rem 1.25rem',
            background: '#ebf8ff',
            border: '1px solid #90cdf4',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 600,
            color: '#2c5282',
          }}
        >
          {engineOutput.recommendation.primary}
        </div>
      </div>
    </>
  );
}
