/**
 * DevPortalFixturePage.tsx
 *
 * Dev-only route: /dev/portal-fixtures
 *
 * Provides a fixture launcher for the customer portal so portal features can be
 * tested without a live visit record or signed token.
 *
 * Each fixture button opens the real CustomerPortalPage (same
 * CustomerPortalPage / InsightPackDeck path) with a pre-built EngineInputV2_3
 * injected via the devFixtureInput prop, bypassing API and token validation.
 *
 * Production safety:
 *   - Route is registered only in DEV_ROUTE_REGISTRY as access: 'dev_only'.
 *   - No real tokens are generated.
 *   - No visit records are created or modified.
 *   - No persistence of fixture data.
 */

import { useState } from 'react';
import CustomerPortalPage from '../components/portal/CustomerPortalPage';
import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';
import { buildPortalJourneyPrintModel } from '../library/portal/pdf/buildPortalJourneyPrintModel';
import { PortalJourneyPrintPack } from '../library/portal/pdf/PortalJourneyPrintPack';
import './devPortalFixture.css';

// ─── Fixture definitions ──────────────────────────────────────────────────────

export type PortalFixtureId =
  | 'system_unvented_2bath'
  | 'combi_1bath'
  | 'heat_pump_low_temp'
  | 'water_pressure_constraint'
  | 'open_vented_to_sealed_unvented';

export interface PortalFixture {
  id: PortalFixtureId;
  label: string;
  description: string;
  engineInput: EngineInputV2_3;
}

export const PORTAL_FIXTURES: PortalFixture[] = [
  {
    id: 'system_unvented_2bath',
    label: 'System boiler + unvented cylinder, 2 bathrooms',
    description: '4-person household with 2 bathrooms and peak concurrent demand — tests stored hot-water routing and PressureVsStoragePortalSection.',
    engineInput: {
      postcode: 'M1 1AA',
      dynamicMainsPressure: 2.5,
      mainsDynamicFlowLpm: 18,
      primaryPipeDiameter: 22,
      heatLossWatts: 9000,
      radiatorCount: 12,
      bathroomCount: 2,
      occupancyCount: 4,
      peakConcurrentOutlets: 2,
      hasLoftConversion: false,
      returnWaterTemp: 45,
      occupancySignature: 'professional',
      buildingMass: 'medium',
      highOccupancy: true,
      preferCombi: false,
      currentHeatSourceType: 'system',
      dhwStorageType: 'unvented',
      currentSystem: { boiler: { type: 'system', ageYears: 12 } },
    },
  },
  {
    id: 'combi_1bath',
    label: 'Combi replacement, 1 bathroom',
    description: '2-person household with a single bathroom — tests standard combi replacement path.',
    engineInput: {
      postcode: 'SW1A 1AA',
      dynamicMainsPressure: 1.8,
      mainsDynamicFlowLpm: 14,
      primaryPipeDiameter: 22,
      heatLossWatts: 7000,
      radiatorCount: 8,
      bathroomCount: 1,
      occupancyCount: 2,
      hasLoftConversion: false,
      returnWaterTemp: 50,
      occupancySignature: 'professional',
      buildingMass: 'medium',
      highOccupancy: false,
      preferCombi: true,
      currentHeatSourceType: 'combi',
      dhwStorageType: 'none',
    },
  },
  {
    id: 'heat_pump_low_temp',
    label: 'Heat pump, low-temperature radiators',
    description: 'Well-insulated 3-person home with outdoor space confirmed — tests heat-pump recommendation path.',
    engineInput: {
      postcode: 'EH1 1AA',
      dynamicMainsPressure: 2.0,
      mainsDynamicFlowLpm: 16,
      primaryPipeDiameter: 28,
      heatLossWatts: 5000,
      radiatorCount: 10,
      bathroomCount: 2,
      occupancyCount: 3,
      hasLoftConversion: false,
      returnWaterTemp: 40,
      occupancySignature: 'steady_home',
      buildingMass: 'heavy',
      highOccupancy: false,
      preferCombi: false,
      currentHeatSourceType: 'regular',
      hasOutdoorSpaceForHeatPump: true,
      productConstraints: { allowHeatPump: true },
      dhwStorageType: 'heat_pump_cylinder',
    },
  },
  {
    id: 'water_pressure_constraint',
    label: 'Water pressure constraint',
    description: 'Low dynamic mains pressure (0.8 bar) and low flow rate (7 L/min) — tests pressure-limiter portal section.',
    engineInput: {
      postcode: 'LS1 1AA',
      dynamicMainsPressure: 0.8,
      mainsDynamicFlowLpm: 7,
      primaryPipeDiameter: 22,
      heatLossWatts: 8000,
      radiatorCount: 10,
      bathroomCount: 1,
      occupancyCount: 2,
      hasLoftConversion: false,
      returnWaterTemp: 48,
      occupancySignature: 'professional',
      buildingMass: 'medium',
      highOccupancy: false,
      preferCombi: false,
      currentHeatSourceType: 'combi',
      dhwStorageType: 'none',
    },
  },
  {
    id: 'open_vented_to_sealed_unvented',
    label: 'Open-vented to sealed + unvented',
    description: 'Older regular boiler with open-vented circuit — tests sealed-system conversion portal path.',
    engineInput: {
      postcode: 'B1 1AA',
      dynamicMainsPressure: 2.2,
      mainsDynamicFlowLpm: 15,
      primaryPipeDiameter: 28,
      heatLossWatts: 10000,
      radiatorCount: 14,
      bathroomCount: 2,
      occupancyCount: 4,
      hasLoftConversion: false,
      returnWaterTemp: 60,
      occupancySignature: 'steady_home',
      buildingMass: 'heavy',
      highOccupancy: true,
      preferCombi: false,
      currentHeatSourceType: 'regular',
      dhwStorageType: 'vented',
      currentSystem: {
        boiler: { type: 'regular', ageYears: 18 },
        heatingSystemType: 'open_vented',
      },
    },
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FixtureCardProps {
  fixture: PortalFixture;
  onOpen: (fixture: PortalFixture, initialView?: 'insight' | 'presentation' | 'supporting_pdf') => void;
}

function FixtureCard({ fixture, onOpen }: FixtureCardProps) {
  const [copied, setCopied] = useState(false);

  const isOpenVented = fixture.id === 'open_vented_to_sealed_unvented';

  function handleCopyUrl() {
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/dev/portal-fixtures`
      : '/dev/portal-fixtures';
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="dev-portal-fixture__card" data-testid="fixture-card" data-fixture-id={fixture.id}>
      <div className="dev-portal-fixture__card-body">
        <h3 className="dev-portal-fixture__card-title">{fixture.label}</h3>
        <p className="dev-portal-fixture__card-desc">{fixture.description}</p>
      </div>
      <div className="dev-portal-fixture__card-actions">
        <button
          type="button"
          className="dev-portal-fixture__btn dev-portal-fixture__btn--primary"
          onClick={() => onOpen(fixture)}
          data-testid={`fixture-open-${fixture.id}`}
        >
          Open portal
        </button>
        <button
          type="button"
          className="dev-portal-fixture__btn"
          onClick={() => onOpen(fixture, 'insight')}
          data-testid={`fixture-insight-${fixture.id}`}
        >
          Open Insight
        </button>
        <button
          type="button"
          className="dev-portal-fixture__btn"
          onClick={() => onOpen(fixture, 'presentation')}
          data-testid={`fixture-presentation-${fixture.id}`}
        >
          Open In-room presentation
        </button>
        {isOpenVented ? (
          <button
            type="button"
            className="dev-portal-fixture__btn"
            onClick={() => onOpen(fixture, 'supporting_pdf')}
            data-testid={`fixture-supporting-pdf-${fixture.id}`}
          >
            Open supporting PDF preview
          </button>
        ) : null}
        <button
          type="button"
          className="dev-portal-fixture__btn dev-portal-fixture__btn--copy"
          onClick={handleCopyUrl}
          data-testid={`fixture-copy-url-${fixture.id}`}
        >
          {copied ? 'Copied!' : 'Copy portal URL'}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DevPortalFixturePageProps {
  onBack?: () => void;
}

interface ActiveFixture {
  fixture: PortalFixture;
  initialView?: 'insight' | 'presentation' | 'supporting_pdf';
}

/**
 * DevPortalFixturePage
 *
 * Dev-only fixture launcher for the customer portal.
 * Renders at /dev/portal-fixtures — not reachable from any customer route.
 */
export default function DevPortalFixturePage({ onBack }: DevPortalFixturePageProps) {
  const [active, setActive] = useState<ActiveFixture | null>(null);

  function handleOpen(fixture: PortalFixture, initialView?: 'insight' | 'presentation' | 'supporting_pdf') {
    setActive({ fixture, initialView });
  }

  function handleBackToLauncher() {
    setActive(null);
  }

  if (active !== null) {
    // Supporting PDF preview — renders PortalJourneyPrintPack directly
    if (active.initialView === 'supporting_pdf') {
      const printModel = buildPortalJourneyPrintModel({
        selectedSectionIds: ['CON_A01', 'CON_C02', 'CON_C01'],
        recommendationSummary: 'Sealed system with unvented cylinder — the right route for this home.',
        customerFacts: [
          `${active.fixture.engineInput.occupancyCount ?? 4}-person household`,
          `${active.fixture.engineInput.bathroomCount ?? 2} bathroom${(active.fixture.engineInput.bathroomCount ?? 2) !== 1 ? 's' : ''}`,
          'Regular boiler, open-vented circuit',
        ],
      });

      return (
        <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
          <div style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
            <button
              type="button"
              className="back-btn"
              onClick={handleBackToLauncher}
              data-testid="dev-fixture-back"
            >
              ← Back to fixtures
            </button>
            <span
              className="atlas-dev-notice"
              style={{ margin: 0 }}
              data-testid="dev-fixture-active-label"
            >
              🔬 Supporting PDF preview — not customer data · {active.fixture.label}
            </span>
          </div>
          <div
            style={{ padding: '2rem', background: '#e5e7eb' }}
            data-testid="dev-supporting-pdf-preview"
          >
            <PortalJourneyPrintPack model={printModel} />
          </div>
        </div>
      );
    }

    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
        <div style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
          <button
            type="button"
            className="back-btn"
            onClick={handleBackToLauncher}
            data-testid="dev-fixture-back"
          >
            ← Back to fixtures
          </button>
          <span
            className="atlas-dev-notice"
            style={{ margin: 0 }}
            data-testid="dev-fixture-active-label"
          >
            🔬 Dev fixture portal — not customer data · {active.fixture.label}
          </span>
        </div>
        <CustomerPortalPage
          reference="dev-fixture"
          devFixtureInput={active.fixture.engineInput}
          devInitialViewMode={active.initialView as 'insight' | 'presentation' | undefined}
          showDevTraceLabelsOverride={true}
        />
      </div>
    );
  }

  return (
    <div className="dev-portal-fixture" data-testid="dev-portal-fixture-launcher">
      <header className="dev-portal-fixture__header">
        {onBack && (
          <button type="button" className="back-btn" onClick={onBack} data-testid="dev-fixture-page-back">
            ← Back
          </button>
        )}
        <div className="dev-portal-fixture__banner" data-testid="dev-fixture-banner">
          <span aria-hidden="true">🔬</span>
          <strong>Dev fixture portal — not customer data</strong>
          <span>Select a fixture to open the real portal renderer with pre-built engine input. No tokens, no API calls, no persistence.</span>
        </div>
        <h1 className="dev-portal-fixture__heading">Portal Fixture Launcher</h1>
        <p className="dev-portal-fixture__subheading">
          Each fixture opens the real <code>CustomerPortalPage</code> / <code>InsightPackDeck</code> path using a fixed engine input.
          Use these to test portal features without a live visit or signed token.
        </p>
      </header>

      <ul className="dev-portal-fixture__list" role="list" data-testid="fixture-list">
        {PORTAL_FIXTURES.map((fixture) => (
          <li key={fixture.id}>
            <FixtureCard fixture={fixture} onOpen={handleOpen} />
          </li>
        ))}
      </ul>
    </div>
  );
}
