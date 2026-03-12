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
    colorVar: 'var(--color-red-500)',
    bgVar: 'var(--surface-danger)',
    borderVar: 'var(--border-danger)',
  },
  {
    key: 'dhw' as const,
    icon: '🚿',
    label: 'DHW',
    colorVar: 'var(--color-blue-500)',
    bgVar: 'var(--surface-info)',
    borderVar: 'var(--border-info)',
  },
  {
    key: 'hydraulics' as const,
    icon: '🔧',
    label: 'Hydraulics',
    colorVar: 'var(--color-green-500)',
    bgVar: 'var(--surface-success)',
    borderVar: 'var(--border-success)',
  },
] as const;

function InfluenceBlock({
  block,
  label,
  icon,
  colorVar,
  bgVar,
  borderVar,
}: {
  block: InfluenceBlockV1;
  label: string;
  icon: string;
  colorVar: string;
  bgVar: string;
  borderVar: string;
}) {
  return (
    <div
      className="ib-block"
      style={{
        background: bgVar,
        border: `1px solid ${borderVar}`,
        color: colorVar,
        flex: '1 1 160px',
        minWidth: 140,
      }}
    >
      {/* Header */}
      <div className="ib-block__icon-row">
        <span>{icon}</span>
        <span>{label}</span>
      </div>

      {/* Influence % bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>
          <span>Influence</span>
          <span className="ib-block__pct">{block.influencePct}%</span>
        </div>
        <div className="ib-block__bar-track">
          <div
            className="ib-block__bar-fill"
            style={{ width: `${block.influencePct}%` }}
          />
        </div>
      </div>

      {/* Top drivers */}
      {block.topDrivers.length > 0 && (
        <div className="ib-block__drivers">
          {block.topDrivers.slice(0, 2).map((driver, i) => (
            <div key={i} style={{ padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: 'var(--text-xs)' }}>▸</span>
              {driver}
            </div>
          ))}
        </div>
      )}

      {/* Assumptions count */}
      {block.assumptionsCount > 0 && (
        <div
          className="ib-block__assumptions"
          style={{ borderTop: `1px solid ${borderVar}`, paddingTop: 6, color: 'var(--text-muted)' }}
        >
          {block.assumptionsCount} assumption{block.assumptionsCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

export default function InfluenceBlocks({ summary }: Props) {
  // Determine the dominant domain for the "What this means" sentence
  const dominantKey = (Object.keys(summary) as Array<keyof InfluenceSummaryV1>).reduce(
    (best, key) => (summary[key].influencePct > summary[best].influencePct ? key : best),
    'heat' as keyof InfluenceSummaryV1,
  );

  const WHAT_THIS_MEANS: Record<keyof InfluenceSummaryV1, string> = {
    heat:       'What this means: Heat demand drives the system sizing decision.',
    dhw:        'What this means: DHW requirements drive system selection — hot water delivery is the binding constraint.',
    hydraulics: 'What this means: Hydraulic constraints determine which systems are viable for this property.',
  };
  const whatThisMeans = WHAT_THIS_MEANS[dominantKey];

  return (
    <div className="influence-blocks" style={{ marginBottom: 'var(--space-5)' }}>
      <h3
        style={{
          margin: '0 0 var(--space-3)',
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--weight-bold)',
          color: 'var(--text-body)',
          borderBottom: '1px solid var(--border-default)',
          paddingBottom: 'var(--space-2)',
        }}
      >
        Domain Influence
      </h3>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        {BLOCK_CONFIG.map(cfg => (
          <InfluenceBlock
            key={cfg.key}
            block={summary[cfg.key]}
            label={cfg.label}
            icon={cfg.icon}
            colorVar={cfg.colorVar}
            bgVar={cfg.bgVar}
            borderVar={cfg.borderVar}
          />
        ))}
      </div>
      <p style={{ margin: 'var(--space-3) 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        {whatThisMeans}
      </p>
    </div>
  );
}

