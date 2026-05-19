import {
  VISUAL_EDUCATION_LEGACY_SURFACE_LINKS,
  VISUAL_EDUCATION_LIBRARY_QA_HUB,
  VISUAL_EDUCATION_LIBRARY_SURFACES,
} from '../../dev/visualEducationLibrary';

function RouteCard({
  title,
  description,
  routePath,
  queryFlag,
  badge,
  statusBadges,
}: {
  title: string;
  description: string;
  routePath: string;
  queryFlag: string;
  badge: string;
  statusBadges?: readonly string[];
}) {
  return (
    <article
      style={{
        background: '#fff',
        border: '1px solid #cbd5e1',
        borderRadius: 12,
        padding: '0.9rem',
        display: 'grid',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <span
            style={{
              fontSize: 11,
              color: '#1d4ed8',
              background: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: 999,
              padding: '2px 8px',
              fontWeight: 600,
            }}
          >
            {badge}
          </span>
          {statusBadges?.map((statusBadge) => (
            <span
              key={`${title}-${statusBadge}`}
              style={{
                fontSize: 11,
                color: '#92400e',
                background: '#fffbeb',
                border: '1px solid #f59e0b',
                borderRadius: 999,
                padding: '2px 8px',
                fontWeight: 600,
                textTransform: 'lowercase',
              }}
            >
              {statusBadge}
            </span>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>{description}</p>
      </div>
      <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
        <span><strong>Route:</strong> <code>{routePath}</code></span>
        <span><strong>Query flag:</strong> <code>?{queryFlag}</code></span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a className="chip-btn" href={routePath}>Open route</a>
        <a className="chip-btn" href={`/?${queryFlag}`}>Open query flag</a>
      </div>
    </article>
  );
}

export function VisualEducationLibraryQaHubPage() {
  return (
    <main
      data-testid="visual-education-library-qa-hub"
      style={{
        fontFamily: 'system-ui, sans-serif',
        color: '#0f172a',
        padding: '1rem',
        display: 'grid',
        gap: '1rem',
      }}
    >
      <header style={{ display: 'grid', gap: '0.65rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.35rem', fontSize: 24 }}>{VISUAL_EDUCATION_LIBRARY_QA_HUB.commonName}</h1>
          <p style={{ margin: 0, color: '#475569', fontSize: 13, maxWidth: '78ch' }}>
            This is the front door for the visual QA work. Use it to reach the primitive, topology, overlay, and customer explainer galleries, plus the older comparison fixtures, without guessing hidden URLs.
          </p>
        </div>
        <section
          style={{
            background: '#eff6ff',
            border: '1px solid #93c5fd',
            borderRadius: 12,
            padding: '0.85rem',
            display: 'grid',
            gap: 6,
          }}
        >
          <strong style={{ color: '#1e3a8a' }}>Use this hub for exports and debug captures</strong>
          <p style={{ margin: 0, fontSize: 12, color: '#1d4ed8' }}>
            If a PDF or screenshot capture still opens the concept backlog room first, start here instead and choose the exact gallery you want to capture.
          </p>
        </section>
      </header>

      <section style={{ display: 'grid', gap: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Current visual QA galleries</h2>
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {VISUAL_EDUCATION_LIBRARY_SURFACES.map((surface, index) => (
            <RouteCard
              key={surface.id}
              title={surface.commonName}
              description={surface.description}
              routePath={surface.routePath}
              queryFlag={surface.queryFlag}
              badge={`PR ${index + 1}`}
              statusBadges={surface.statusBadges}
            />
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gap: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Legacy comparison surfaces</h2>
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {VISUAL_EDUCATION_LEGACY_SURFACE_LINKS.map((surface) => (
            <RouteCard
              key={surface.label}
              title={surface.label}
              description={surface.description}
              routePath={surface.routePath}
              queryFlag={surface.queryFlag}
              badge="Legacy"
            />
          ))}
        </div>
      </section>
    </main>
  );
}

export default VisualEducationLibraryQaHubPage;
