import type { EngineerJobPackItemV1, EngineerJobPackV1 } from '../../specification/handover';

interface Props {
  jobPack: EngineerJobPackV1;
}

interface SectionDefinition {
  readonly key: keyof EngineerJobPackV1;
  readonly title: string;
}

const SECTION_DEFINITIONS: readonly SectionDefinition[] = [
  { key: 'jobSummary', title: 'Job summary' },
  { key: 'fitThis', title: 'Fit this' },
  { key: 'removeThis', title: 'Remove this' },
  { key: 'checkThis', title: 'Check this' },
  { key: 'discussWithCustomer', title: 'Discuss with customer' },
  { key: 'locationsAndRoutes', title: 'Locations and routes' },
  { key: 'commissioning', title: 'Commissioning' },
  { key: 'unresolvedBeforeInstall', title: 'Unresolved before install' },
  { key: 'doNotMiss', title: 'Do not miss' },
];

function confidenceBadgeColor(confidence: EngineerJobPackItemV1['confidence']): string {
  if (confidence === 'confirmed') return '#0f766e';
  if (confidence === 'inferred') return '#475569';
  return '#b45309';
}

function renderItem(item: EngineerJobPackItemV1, index: number, sectionKey: string) {
  return (
    <li
      key={`${sectionKey}-${index}-${item.text}`}
      style={{
        listStyle: 'none',
        padding: '0.45rem 0.55rem',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        background: '#fff',
        display: 'grid',
        gap: '0.35rem',
      }}
    >
      <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start' }}>
        <span aria-hidden="true" style={{ fontSize: 13, color: '#0f172a', lineHeight: 1.4 }}>☐</span>
        <span style={{ fontSize: 13, color: '#0f172a' }}>{item.text}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        <span
          style={{
            fontSize: 11,
            color: '#fff',
            background: confidenceBadgeColor(item.confidence),
            borderRadius: 999,
            padding: '0.15rem 0.45rem',
          }}
        >
          {item.confidence}
        </span>
        {item.location ? (
          <span
            style={{
              fontSize: 11,
              color: '#0f172a',
              background: '#e2e8f0',
              borderRadius: 999,
              padding: '0.15rem 0.45rem',
            }}
          >
            {item.location}
          </span>
        ) : null}
        {item.mustConfirmOnSite ? (
          <span
            style={{
              fontSize: 11,
              color: '#991b1b',
              background: '#fee2e2',
              borderRadius: 999,
              padding: '0.15rem 0.45rem',
            }}
          >
            Must confirm on site
          </span>
        ) : null}
      </div>
    </li>
  );
}

export default function EngineerJobPackPreviewPanel({ jobPack }: Props) {
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }} data-testid="engineer-job-pack-preview-panel">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        {SECTION_DEFINITIONS.map((section) => {
          const items = jobPack[section.key];
          if (!Array.isArray(items)) return null;
          return (
            <section
              key={section.key}
              style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.65rem', background: '#f8fafc' }}
              data-testid={`engineer-job-pack-section-${section.key}`}
            >
              <h3 style={{ margin: '0 0 0.45rem', fontSize: '0.88rem' }}>{section.title}</h3>
              {items.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, display: 'grid', gap: '0.35rem' }}>
                  {items.map((item, index) => renderItem(item, index, section.key))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No items.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
