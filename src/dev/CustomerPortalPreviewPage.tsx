import { useMemo, useState } from 'react';
import CustomerPortalPage from '../components/portal/CustomerPortalPage';
import { PORTAL_FIXTURES, type PortalFixtureId } from './DevPortalFixturePage';

interface CustomerPortalPreviewPageProps {
  onBack?: () => void;
}

export default function CustomerPortalPreviewPage({ onBack }: CustomerPortalPreviewPageProps) {
  const [fixtureId, setFixtureId] = useState<PortalFixtureId>(PORTAL_FIXTURES[0].id);
  const fixture = useMemo(
    () => PORTAL_FIXTURES.find((candidate) => candidate.id === fixtureId) ?? PORTAL_FIXTURES[0],
    [fixtureId],
  );

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }} data-testid="customer-portal-preview-page">
      <div style={{ padding: '0.75rem 1rem', display: 'grid', gap: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
        {onBack ? (
          <button type="button" className="back-btn" onClick={onBack} data-testid="customer-portal-preview-back">
            ← Back
          </button>
        ) : null}
        <div className="atlas-dev-notice" data-testid="customer-portal-preview-banner">
          <strong>Customer portal preview (production-like)</strong>
          <span>Renders canonical <code>CustomerPortalPage</code> in production portal mode using fixture engine input.</span>
        </div>
        <div data-testid="customer-portal-preview-route-labels">
          <p style={{ margin: 0 }}><strong>Production portal:</strong> <code>/portal/:reference</code></p>
          <p style={{ margin: 0 }}><strong>Dev production-like preview:</strong> <code>/dev/customer-portal-preview</code></p>
          <p style={{ margin: 0 }}><strong>Legacy fixture diagnostics:</strong> <code>/dev/portal-fixtures</code></p>
        </div>
        <label htmlFor="customer-portal-preview-fixture">Fixture</label>
        <select
          id="customer-portal-preview-fixture"
          data-testid="customer-portal-preview-fixture"
          value={fixtureId}
          onChange={(event) => setFixtureId(event.target.value as PortalFixtureId)}
        >
          {PORTAL_FIXTURES.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
        </select>
      </div>
      <CustomerPortalPage
        reference={`customer-portal-preview-${fixture.id}`}
        productionPreviewInput={fixture.engineInput}
        showDevTraceLabelsOverride
      />
    </div>
  );
}
