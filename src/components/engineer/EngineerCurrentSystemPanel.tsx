/**
 * EngineerCurrentSystemPanel.tsx
 *
 * PR11 — Current system and knowledge readiness panel for the engineer route.
 *
 * Shows the knowledge summary (per-domain confidence) alongside the recommended
 * system so the engineer can see what Atlas understood and what is still uncertain.
 */

import type { EngineerDisplayModel, KnowledgeStatus } from './types/engineerDisplay.types';

interface Props {
  model: EngineerDisplayModel;
}

const STATUS_CONFIG: Record<KnowledgeStatus, { label: string; color: string; bg: string; border: string }> = {
  confirmed: { label: 'Confirmed', color: '#276749', bg: '#f0fff4', border: '#9ae6b4' },
  review:    { label: 'Review',    color: '#744210', bg: '#fffff0', border: '#f6e05e' },
  missing:   { label: 'Missing',   color: '#742a2a', bg: '#fff5f5', border: '#feb2b2' },
};

const KNOWLEDGE_DOMAIN_LABELS: Record<keyof EngineerDisplayModel['knowledgeSummary'], string> = {
  household:     'Household',
  usage:         'Hot-water usage',
  currentSystem: 'Current system',
  priorities:    'Priorities',
  constraints:   'Install constraints',
};

function KnowledgeBadge({ status }: { status: KnowledgeStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      fontSize: '0.7rem',
      fontWeight: 700,
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      padding: '0.1rem 0.4rem',
      borderRadius: '4px',
    }}>
      {cfg.label}
    </span>
  );
}

export function EngineerCurrentSystemPanel({ model }: Props) {
  const { knowledgeSummary } = model;

  return (
    <div
      data-testid="engineer-current-system"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      <h2 style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', fontWeight: 700, color: '#2d3748' }}>
        🔍 What Atlas understood
      </h2>

      <dl style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '0.5rem 1rem',
        margin: 0,
      }}>
        {(Object.keys(knowledgeSummary) as Array<keyof typeof knowledgeSummary>).map(domain => (
          <div key={domain} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <dt style={{ fontSize: '0.68rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              {KNOWLEDGE_DOMAIN_LABELS[domain]}
            </dt>
            <dd style={{ margin: 0 }}>
              <KnowledgeBadge status={knowledgeSummary[domain]} />
            </dd>
          </div>
        ))}
      </dl>

      {model.recommendedSystem && (
        <div style={{
          marginTop: '1rem',
          padding: '0.6rem 0.85rem',
          background: '#ebf8ff',
          borderRadius: '6px',
          border: '1px solid #bee3f8',
        }}>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#2b6cb0' }}>
            <strong>Atlas recommends:</strong> {model.recommendedSystem}
          </p>
        </div>
      )}
    </div>
  );
}
