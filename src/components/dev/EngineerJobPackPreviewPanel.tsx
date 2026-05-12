import { useMemo, useState } from 'react';
import type { EngineerJobPackItemV1, EngineerJobPackV1, EngineerJobWalkthroughV1 } from '../../specification/handover';
import { buildEngineerJobWalkthrough } from '../../specification/handover';

interface Props {
  jobPack: EngineerJobPackV1;
}

type ViewMode = 'by_section' | 'by_location' | 'job_walkthrough';

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
  { key: 'locationsToConfirm', title: 'Locations to confirm' },
];

const WALKTHROUGH_SECTION_KEYS: ReadonlyArray<keyof EngineerJobWalkthroughV1> = [
  'unresolvedBeforeInstall',
  'beforeStarting',
  'loft',
  'cylinderArea',
  'plantArea',
  'externalWorks',
  'radiatorsAndRooms',
  'commissioning',
  'customerHandover',
];

function confidenceBadgeColor(confidence: EngineerJobPackItemV1['confidence']): string {
  if (confidence === 'confirmed') return '#0f766e';
  if (confidence === 'inferred') return '#475569';
  return '#b45309';
}

function renderSectionCard(
  sectionKey: string,
  title: string,
  items: readonly EngineerJobPackItemV1[],
  badge?: React.ReactNode,
) {
  return (
    <section
      key={sectionKey}
      style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.65rem', background: '#f8fafc' }}
      data-testid={`engineer-job-pack-section-${sectionKey}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.45rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.88rem' }}>{title}</h3>
        {badge}
      </div>
      {items.length > 0 ? (
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: '0.35rem' }}>
          {items.map((item, index) => renderItem(item, index, sectionKey))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No items.</p>
      )}
    </section>
  );
}

function ViewToggle({ viewMode, onChange }: { viewMode: ViewMode; onChange: (v: ViewMode) => void }) {
  const options: Array<{ value: ViewMode; label: string }> = [
    { value: 'by_section', label: 'By section' },
    { value: 'by_location', label: 'By location' },
    { value: 'job_walkthrough', label: 'Job walkthrough' },
  ];
  return (
    <div style={{ display: 'flex', gap: '0.35rem' }} role="group" aria-label="View mode">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: 999,
            padding: '0.2rem 0.65rem',
            background: viewMode === opt.value ? '#0f172a' : '#f8fafc',
            color: viewMode === opt.value ? '#fff' : '#0f172a',
            fontSize: 12,
            cursor: 'pointer',
            fontWeight: viewMode === opt.value ? 600 : 400,
          }}
          aria-pressed={viewMode === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
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
            {item.location?.label}
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
  const [viewMode, setViewMode] = useState<ViewMode>('by_section');
  const [locationFilter, setLocationFilter] = useState<'all' | 'needs_survey' | `location:${string}`>('all');
  const locationChips = useMemo(() => {
    const allItems = SECTION_DEFINITIONS.flatMap((section) => {
      const items = jobPack[section.key];
      return Array.isArray(items) ? items : [];
    });
    const unique = new Map<string, string>();
    let hasNeedsSurvey = false;
    for (const item of allItems) {
      const location = item.location;
      if (!location) continue;
      unique.set(location.locationId, location.label);
      if (location.confidence === 'needs_survey') hasNeedsSurvey = true;
    }
    return {
      locations: Array.from(unique.entries()).map(([locationId, label]) => ({ locationId, label })),
      hasNeedsSurvey,
    };
  }, [jobPack]);

  const walkthrough = useMemo(() => buildEngineerJobWalkthrough(jobPack), [jobPack]);

  const matchesFilter = (item: EngineerJobPackItemV1): boolean => {
    if (locationFilter === 'all') return true;
    if (locationFilter === 'needs_survey') return item.location?.confidence === 'needs_survey';
    return locationFilter.startsWith('location:')
      ? item.location?.locationId === locationFilter.slice('location:'.length)
      : false;
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }} data-testid="engineer-job-pack-preview-panel">
      <ViewToggle viewMode={viewMode} onChange={setViewMode} />

      {(viewMode === 'by_section' || viewMode === 'by_location') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          <button
            type="button"
            onClick={() => setLocationFilter('all')}
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: 999,
              padding: '0.2rem 0.5rem',
              background: locationFilter === 'all' ? '#0f172a' : '#f8fafc',
              color: locationFilter === 'all' ? '#fff' : '#0f172a',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            All locations
          </button>
          {locationChips.locations.map((chip) => (
            <button
              key={chip.locationId}
              type="button"
              onClick={() => setLocationFilter(`location:${chip.locationId}`)}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: 999,
                padding: '0.2rem 0.5rem',
                background: locationFilter === `location:${chip.locationId}` ? '#0f172a' : '#f8fafc',
                color: locationFilter === `location:${chip.locationId}` ? '#fff' : '#0f172a',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {chip.label}
            </button>
          ))}
          {locationChips.hasNeedsSurvey ? (
            <button
              type="button"
              onClick={() => setLocationFilter('needs_survey')}
              style={{
                border: '1px solid #fecaca',
                borderRadius: 999,
                padding: '0.2rem 0.5rem',
                background: locationFilter === 'needs_survey' ? '#991b1b' : '#fff1f2',
                color: locationFilter === 'needs_survey' ? '#fff' : '#991b1b',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Needs survey
            </button>
          ) : null}
        </div>
      )}

      {viewMode === 'by_section' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {SECTION_DEFINITIONS.map((section) => {
            const items = jobPack[section.key];
            if (!Array.isArray(items)) return null;
            const filteredItems = items.filter(matchesFilter);
            return renderSectionCard(section.key, section.title, filteredItems);
          })}
        </div>
      )}

      {viewMode === 'by_location' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {locationChips.locations.map((chip) => {
            const allItems = SECTION_DEFINITIONS.flatMap((section) => {
              const items = jobPack[section.key];
              return Array.isArray(items) ? items : [];
            });
            const locationItems = allItems.filter(
              (item) => item.location?.locationId === chip.locationId && matchesFilter(item),
            );
            const deduped = locationItems.filter(
              (item, index, arr) =>
                arr.findIndex(
                  (other) =>
                    other.text === item.text
                    && (other.sourceLineId ?? '') === (item.sourceLineId ?? '')
                    && (other.relatedRiskId ?? '') === (item.relatedRiskId ?? ''),
                ) === index,
            );
            return renderSectionCard(`loc_${chip.locationId}`, chip.label, deduped);
          })}
          {(locationFilter === 'all' || locationFilter === 'needs_survey') && (() => {
            const allItems = SECTION_DEFINITIONS.flatMap((section) => {
              const items = jobPack[section.key];
              return Array.isArray(items) ? items : [];
            });
            const unlocated = allItems.filter((item) => !item.location && matchesFilter(item));
            const deduped = unlocated.filter(
              (item, index, arr) =>
                arr.findIndex(
                  (other) =>
                    other.text === item.text
                    && (other.sourceLineId ?? '') === (item.sourceLineId ?? '')
                    && (other.relatedRiskId ?? '') === (item.relatedRiskId ?? ''),
                ) === index,
            );
            return deduped.length > 0 ? renderSectionCard('loc_unlocated', 'No location', deduped) : null;
          })()}
        </div>
      )}

      {viewMode === 'job_walkthrough' && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {WALKTHROUGH_SECTION_KEYS.map((key) => {
            const wSection = walkthrough[key];
            if (typeof wSection !== 'object' || !('items' in wSection)) return null;
            const badge =
              wSection.mustConfirmCount > 0 ? (
                <span
                  style={{
                    fontSize: 11,
                    color: '#991b1b',
                    background: '#fee2e2',
                    borderRadius: 999,
                    padding: '0.15rem 0.45rem',
                  }}
                >
                  {wSection.mustConfirmCount} to confirm
                </span>
              ) : null;
            return renderSectionCard(`walkthrough_${key}`, wSection.title, wSection.items, badge);
          })}
        </div>
      )}
    </div>
  );
}
