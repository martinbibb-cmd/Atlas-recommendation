/**
 * InfluenceBlocks.tsx
 *
 * Renders an InfluenceSummaryV1 as three domain blocks:
 *   - Heat
 *   - DHW
 *   - Hydraulics
 *
 * Each block shows: influence %, top 2 drivers, assumptions count.
 */
import type { InfluenceSummaryV1, InfluenceBlockV1 } from '../../contracts/EngineOutputV1';

interface Props {
  summary: InfluenceSummaryV1;
}

const BLOCK_CONFIG = [
  {
    key: 'heat' as const,
    icon: '🔥',
    label: 'Heat',
    color: '#e53e3e',
    bg: '#fff5f5',
    border: '#fc8181',
  },
  {
    key: 'dhw' as const,
    icon: '🚿',
    label: 'DHW',
    color: '#3182ce',
    bg: '#ebf8ff',
    border: '#90cdf4',
  },
  {
    key: 'hydraulics' as const,
    icon: '🔧',
    label: 'Hydraulics',
    color: '#38a169',
    bg: '#f0fff4',
    border: '#9ae6b4',
  },
] as const;

function InfluenceBlock({
  block,
  label,
  icon,
  color,
  bg,
  border,
}: {
  block: InfluenceBlockV1;
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: '14px 16px',
        flex: '1 1 160px',
        minWidth: 140,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color }}>{label}</span>
      </div>

      {/* Influence % bar */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#718096',
            marginBottom: 4,
          }}
        >
          <span>Influence</span>
          <span style={{ fontWeight: 700, color }}>{block.influencePct}%</span>
        </div>
        <div
          style={{
            height: 6,
            background: '#e2e8f0',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${block.influencePct}%`,
              background: color,
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Top drivers */}
      {block.topDrivers.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {block.topDrivers.slice(0, 2).map((driver, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                color: '#4a5568',
                padding: '2px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{ color, fontSize: 10 }}>▸</span>
              {driver}
            </div>
          ))}
        </div>
      )}

      {/* Assumptions count */}
      {block.assumptionsCount > 0 && (
        <div
          style={{
            fontSize: 11,
            color: '#a0aec0',
            borderTop: `1px solid ${border}`,
            paddingTop: 6,
          }}
        >
          {block.assumptionsCount} assumption{block.assumptionsCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

export default function InfluenceBlocks({ summary }: Props) {
  return (
    <div className="influence-blocks" style={{ marginBottom: 20 }}>
      <h3
        style={{
          margin: '0 0 12px',
          fontSize: 16,
          color: '#2d3748',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: 8,
        }}
      >
        Domain Influence
      </h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {BLOCK_CONFIG.map(cfg => (
          <InfluenceBlock
            key={cfg.key}
            block={summary[cfg.key]}
            label={cfg.label}
            icon={cfg.icon}
            color={cfg.color}
            bg={cfg.bg}
            border={cfg.border}
          />
        ))}
      </div>
    </div>
  );
}
