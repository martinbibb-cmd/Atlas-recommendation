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
import { assessSupportingPdfReadiness } from '../library/portal/pdf/supportingPdfReadiness';
import { sectionsForMode } from '../features/insightPack/canonicalSections';
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

// eslint-disable-next-line react-refresh/only-export-components
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
  onOpen: (fixture: PortalFixture, initialView?: 'insight' | 'presentation' | 'pdf_comparison') => void;
}

const ENABLE_LIBRARY_SUPPORTING_PDF_DEV_REPLACEMENT = import.meta.env.DEV;
const INSIGHT_PRINT_SECTIONS_PER_PAGE = 2;
const OPEN_VENTED_RECOMMENDATION_SUMMARY = 'Sealed system with unvented cylinder — the right route for this home.';

function isOpenVentedFixture(fixture: PortalFixture): boolean {
  return fixture.id === 'open_vented_to_sealed_unvented';
}

function FixtureCard({ fixture, onOpen }: FixtureCardProps) {
  const [copied, setCopied] = useState(false);

  const isOpenVented = isOpenVentedFixture(fixture);
  const showSupportingPdfPreviewAction = ENABLE_LIBRARY_SUPPORTING_PDF_DEV_REPLACEMENT && isOpenVented;

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
        {showSupportingPdfPreviewAction ? (
          <button
            type="button"
            className="dev-portal-fixture__btn"
            onClick={() => onOpen(fixture, 'pdf_comparison')}
            data-testid={`fixture-pdf-comparison-${fixture.id}`}
          >
            Open PDF comparison
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
  initialView?: 'insight' | 'presentation' | 'pdf_comparison';
}

type SupportingPdfPreviewMode = 'current_insight_pdf' | 'library_supporting_pdf';

function buildOpenVentedSupportingPdfModel(fixture: PortalFixture) {
  const bathroomCount = fixture.engineInput.bathroomCount ?? 2;
  return buildPortalJourneyPrintModel({
    selectedSectionIds: ['CON_A01', 'CON_C02', 'CON_C01'],
    recommendationSummary: OPEN_VENTED_RECOMMENDATION_SUMMARY,
    customerFacts: [
      `${fixture.engineInput.occupancyCount ?? 4}-person household`,
      `${bathroomCount} bathroom${bathroomCount !== 1 ? 's' : ''}`,
      'Regular boiler, open-vented circuit',
    ],
  });
}

/**
 * DevPortalFixturePage
 *
 * Dev-only fixture launcher for the customer portal.
 * Renders at /dev/portal-fixtures — not reachable from any customer route.
 */
export default function DevPortalFixturePage({ onBack }: DevPortalFixturePageProps) {
  const [active, setActive] = useState<ActiveFixture | null>(null);
  const [previewMode, setPreviewMode] = useState<SupportingPdfPreviewMode>('current_insight_pdf');

  function handleOpen(fixture: PortalFixture, initialView?: 'insight' | 'presentation' | 'pdf_comparison') {
    const shouldOpenComparisonShell =
      ENABLE_LIBRARY_SUPPORTING_PDF_DEV_REPLACEMENT
      && isOpenVentedFixture(fixture)
      && (initialView === 'insight' || initialView === 'pdf_comparison');
    if (shouldOpenComparisonShell) {
      setPreviewMode(initialView === 'pdf_comparison' ? 'library_supporting_pdf' : 'current_insight_pdf');
    }
    setActive({ fixture, initialView });
  }

  function handleBackToLauncher() {
    setActive(null);
  }

  function handleLibraryPreviewPrint() {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  }

  if (active !== null) {
    const showInsightPdfComparison =
      ENABLE_LIBRARY_SUPPORTING_PDF_DEV_REPLACEMENT
      && isOpenVentedFixture(active.fixture)
      && (active.initialView === 'insight' || active.initialView === 'pdf_comparison');

    // Supporting PDF preview — toggles between current Insight print path and
    // the library-driven supporting PDF preview for safe dev comparison.
    if (showInsightPdfComparison) {
      const printModel = buildOpenVentedSupportingPdfModel(active.fixture);
      const currentInsightEstimatedPages = Math.ceil(
        sectionsForMode('in-room').length / INSIGHT_PRINT_SECTIONS_PER_PAGE,
      );
      const readiness = assessSupportingPdfReadiness({
        model: printModel,
        expectedRecommendationSummary: OPEN_VENTED_RECOMMENDATION_SUMMARY,
        maxCustomerPages: printModel.pageEstimate.maxPages,
        requiredDiagramSectionIds: ['what_changes', 'pressure_vs_storage', 'unvented_safety'],
        printSafeLayoutPass: true,
        accessibilityBasicsPass: true,
        insightFallbackAvailable: true,
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
              🔬 Insight PDF dev comparison — not customer data · {active.fixture.label}
            </span>
          </div>

          <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
            <section
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}
              data-testid="dev-insight-pdf-toggle"
            >
              <button
                type="button"
                className="dev-portal-fixture__btn"
                onClick={() => setPreviewMode('current_insight_pdf')}
                aria-pressed={previewMode === 'current_insight_pdf'}
                data-testid="dev-insight-pdf-toggle-current"
              >
                Current Insight PDF
              </button>
              <button
                type="button"
                className="dev-portal-fixture__btn"
                onClick={() => setPreviewMode('library_supporting_pdf')}
                aria-pressed={previewMode === 'library_supporting_pdf'}
                data-testid="dev-insight-pdf-toggle-library"
              >
                Library Supporting PDF preview
              </button>
              {previewMode === 'library_supporting_pdf' ? (
                <button
                  type="button"
                  className="dev-portal-fixture__btn dev-portal-fixture__btn--primary"
                  onClick={handleLibraryPreviewPrint}
                  data-testid="dev-supporting-pdf-print"
                >
                  Browser print preview
                </button>
              ) : null}
            </section>

            <section
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem' }}
              data-testid="dev-insight-pdf-comparison-panel"
            >
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Insight PDF comparison</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '0.35rem' }}>Metric</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '0.35rem' }}>Current Insight PDF</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '0.35rem' }}>Library Supporting PDF preview</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>Page count (in-room print estimate)</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>{currentInsightEstimatedPages}</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>{printModel.pageEstimate.usedPages}</td>
                  </tr>
                  <tr>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>Raw engine text present</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>Yes</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>No</td>
                  </tr>
                  <tr>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>Diagrams present</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>Yes</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>Yes</td>
                  </tr>
                  <tr>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>Content pending</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>No</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>No</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.35rem' }}>Customer readability notes</td>
                    <td style={{ padding: '0.35rem' }}>Rich but dense; carries legacy Insight layout and terminology.</td>
                    <td style={{ padding: '0.35rem' }}>Short pages, plain language, and consistent journey sequencing.</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem' }}
              data-testid="dev-supporting-pdf-readiness-panel"
            >
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Replacement readiness</h2>
              <p style={{ margin: '0 0 0.5rem' }}>
                Ready to replace:{' '}
                <strong data-testid="dev-supporting-pdf-ready-value">{readiness.ready ? 'Yes' : 'No'}</strong>
              </p>

              <h3 style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>Blocking reasons</h3>
              {readiness.blockingReasons.length > 0 ? (
                <ul style={{ margin: '0 0 0.5rem', paddingLeft: '1.1rem' }} data-testid="dev-supporting-pdf-blocking-reasons">
                  {readiness.blockingReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: '0 0 0.5rem' }} data-testid="dev-supporting-pdf-blocking-reasons-none">None</p>
              )}

              <h3 style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>Warnings</h3>
              {readiness.warnings.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }} data-testid="dev-supporting-pdf-warnings">
                  {readiness.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0 }} data-testid="dev-supporting-pdf-warnings-none">None</p>
              )}
            </section>

            {previewMode === 'current_insight_pdf' ? (
              <CustomerPortalPage
                reference="dev-fixture"
                devFixtureInput={active.fixture.engineInput}
                devInitialViewMode="insight"
                showDevTraceLabelsOverride={true}
              />
            ) : (
              <div
                style={{ padding: '2rem', background: '#e5e7eb' }}
                data-testid="dev-supporting-pdf-preview"
              >
                <PortalJourneyPrintPack model={printModel} />
              </div>
            )}
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
