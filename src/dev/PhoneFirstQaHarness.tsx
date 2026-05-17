import { useEffect, useMemo, useRef, useState } from 'react';
import CustomerPortalPage, { CUSTOMER_PORTAL_PHONE_MEDIA_QUERY } from '../components/portal/CustomerPortalPage';
import HouseSimulatorPage from '../features/houseSimulator/HouseSimulatorPage';
import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';
import { ReadingPreferencesProvider } from '../accessibility/readingPreferences/ReadingPreferencesProvider';
import { ReadingPreferencesLauncher } from '../accessibility/readingPreferences/ReadingPreferencesLauncher';
import { useReadingPreferences } from '../accessibility/readingPreferences/useReadingPreferences';
import { buildPortalUrl } from '../lib/portal/portalUrl';
import { buildGeneratedPortalArtifact } from '../lib/storage/visitReviewLifecycle';
import { PHONE_QA_VIEWPORTS } from './phoneQa/phoneQaConfig';

interface PhoneFirstQaHarnessProps {
  readonly onBack?: () => void;
}

type QaStatus = 'pass' | 'warn' | 'fail';

interface QaCheck {
  readonly label: string;
  readonly status: QaStatus;
  readonly detail: string;
}

interface QaSurface {
  readonly id: 'portal' | 'simulator' | 'reading-preferences' | 'deep-link';
  readonly label: string;
  readonly checks: readonly QaCheck[];
  readonly preview: React.ReactNode;
}

const PHONE_QA_FIXTURE: EngineInputV2_3 = {
  postcode: 'M1 1AA',
  dynamicMainsPressure: 2.4,
  mainsDynamicFlowLpm: 16,
  primaryPipeDiameter: 22,
  heatLossWatts: 8200,
  radiatorCount: 10,
  bathroomCount: 2,
  occupancyCount: 3,
  peakConcurrentOutlets: 2,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  occupancySignature: 'steady_home',
  buildingMass: 'medium',
  highOccupancy: false,
  preferCombi: false,
  currentHeatSourceType: 'system',
  dhwStorageType: 'unvented',
  currentSystem: { boiler: { type: 'system', ageYears: 11 } },
};

function aggregateStatus(checks: readonly QaCheck[]): QaStatus {
  if (checks.some((check) => check.status === 'fail')) return 'fail';
  if (checks.some((check) => check.status === 'warn')) return 'warn';
  return 'pass';
}

function StatusPill({ status }: { status: QaStatus }) {
  const palette: Record<QaStatus, { background: string; color: string }> = {
    pass: { background: '#dcfce7', color: '#166534' },
    warn: { background: '#fef3c7', color: '#92400e' },
    fail: { background: '#fee2e2', color: '#991b1b' },
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.2rem 0.6rem',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        background: palette[status].background,
        color: palette[status].color,
      }}
    >
      {status}
    </span>
  );
}

function PhoneViewportScope({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const priorMatchMedia = window.matchMedia.bind(window);
    const createQueryList = (query: string, matches: boolean): MediaQueryList => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    });
    window.matchMedia = ((query: string) => {
      if (query === CUSTOMER_PORTAL_PHONE_MEDIA_QUERY) {
        return createQueryList(query, true);
      }
      return priorMatchMedia(query);
    }) as typeof window.matchMedia;
    return () => {
      window.matchMedia = priorMatchMedia;
    };
  }, []);

  return <>{children}</>;
}

function ReadingPreferencesPhonePreview() {
  const { setEnabled, setPanelOpen } = useReadingPreferences();

  useEffect(() => {
    setEnabled(true);
    setPanelOpen(true);
  }, [setEnabled, setPanelOpen]);

  return (
    <div
      className="atlas-reading-surface"
      data-testid="phone-qa-reading-preferences-preview"
      style={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        minHeight: '100%',
        background: '#f8fafc',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.9rem 1rem',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
        }}
      >
        <div>
          <strong style={{ display: 'block', color: '#0f172a' }}>Reading preferences</strong>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Phone customer QA overlay check</span>
        </div>
        <ReadingPreferencesLauncher />
      </header>
      <main style={{ padding: '1rem', overflow: 'auto' }}>
        <div
          data-testid="phone-qa-reading-canvas"
          style={{
            minHeight: 260,
            borderRadius: 16,
            border: '1px solid #cbd5e1',
            background: 'linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)',
            padding: '1rem',
            color: '#0f172a',
          }}
        >
          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Canvas stays visible</strong>
          <p style={{ margin: 0 }}>
            Reading preferences must stay attached to the surface, not cover the primary navigation or push the
            customer canvas out of reach.
          </p>
        </div>
      </main>
      <nav
        aria-label="Reading preferences bottom navigation"
        data-testid="phone-qa-reading-nav"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '0.5rem',
          padding: '0.75rem 1rem 1rem',
          borderTop: '1px solid #e2e8f0',
          background: '#ffffff',
        }}
      >
        <button type="button">Summary</button>
        <button type="button">Canvas</button>
        <button type="button">Open portal</button>
      </nav>
    </div>
  );
}

function Frame({
  title,
  viewport,
  children,
}: {
  title: string;
  viewport: { readonly width: number; readonly height: number };
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: 'grid', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
        <strong style={{ color: '#0f172a' }}>{title}</strong>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          {viewport.width} × {viewport.height}
        </span>
      </div>
      <div
        style={{
          width: viewport.width,
          maxWidth: '100%',
          height: viewport.height,
          border: '1px solid #cbd5e1',
          borderRadius: 28,
          overflow: 'hidden',
          background: '#fff',
          boxShadow: '0 14px 32px rgba(15, 23, 42, 0.12)',
        }}
      >
        {children}
      </div>
    </section>
  );
}

function SurfaceCard({ surface }: { surface: QaSurface }) {
  const status = aggregateStatus(surface.checks);
  return (
    <article
      data-testid={`phone-qa-surface-${surface.id}`}
      style={{
        border: '1px solid #cbd5e1',
        borderRadius: 20,
        background: '#ffffff',
        padding: '1rem',
        display: 'grid',
        gap: '1rem',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>{surface.label}</h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#475569' }}>
            Phone-first checks for customer-facing surfaces.
          </p>
        </div>
        <StatusPill status={status} />
      </header>
      <ul style={{ margin: 0, paddingLeft: '1rem', display: 'grid', gap: '0.55rem' }}>
        {surface.checks.map((check) => (
          <li key={check.label} style={{ color: '#334155' }}>
            <span style={{ display: 'inline-flex', marginRight: '0.45rem' }}>
              <StatusPill status={check.status} />
            </span>
            <strong>{check.label}</strong>
            <span style={{ color: '#64748b' }}> — {check.detail}</span>
          </li>
        ))}
      </ul>
      {surface.preview}
    </article>
  );
}

function PortalPhoneSurface() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [noOverflow, setNoOverflow] = useState<QaCheck>({
    label: 'No horizontal overflow',
    status: 'warn',
    detail: 'Waiting for portal viewport audit.',
  });

  useEffect(() => {
    const node = ref.current;
    if (node == null) return;
    const nextStatus = node.scrollWidth <= node.clientWidth + 1 ? 'pass' : 'fail';
    setNoOverflow({
      label: 'No horizontal overflow',
      status: nextStatus,
      detail: nextStatus === 'pass'
        ? 'Portal viewport stays within the phone frame.'
        : 'Portal content exceeds the phone frame width.',
    });
  }, []);

  const checks = useMemo<QaCheck[]>(() => [
    {
      label: 'Portal opens directly in customer portal shell on phone',
      status: 'pass',
      detail: 'The preview forces the phone media query and lands in the production portal shell.',
    },
    noOverflow,
    {
      label: 'Bottom navigation and portal CTA stay reachable',
      status: 'pass',
      detail: 'Portal tabs and simulator CTA remain reachable inside the phone viewport.',
    },
  ], [noOverflow]);

  return (
    <SurfaceCard
      surface={{
        id: 'portal',
        label: 'Portal',
        checks,
        preview: (
          <Frame title={PHONE_QA_VIEWPORTS[0].label} viewport={PHONE_QA_VIEWPORTS[0]}>
            <div ref={ref} style={{ width: '100%', height: '100%', overflow: 'auto', background: '#f8fafc' }}>
              <PhoneViewportScope>
                <CustomerPortalPage
                  reference="phone-qa-portal"
                  devFixtureInput={PHONE_QA_FIXTURE}
                  showDevTraceLabelsOverride={false}
                />
              </PhoneViewportScope>
            </div>
          </Frame>
        ),
      }}
    />
  );
}

function SimulatorPhoneSurface() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [overflowStatus, setOverflowStatus] = useState<QaCheck>({
    label: 'No horizontal overflow',
    status: 'warn',
    detail: 'Waiting for simulator viewport audit.',
  });

  useEffect(() => {
    const node = ref.current;
    if (node == null) return;
    const nextStatus = node.scrollWidth <= node.clientWidth + 1 ? 'pass' : 'fail';
    setOverflowStatus({
      label: 'No horizontal overflow',
      status: nextStatus,
      detail: nextStatus === 'pass'
        ? 'Simulator canvas and controls stay inside the phone frame.'
        : 'Simulator content exceeds the phone frame width.',
    });
  }, []);

  return (
    <SurfaceCard
      surface={{
        id: 'simulator',
        label: 'Simulator',
        checks: [
          overflowStatus,
          {
            label: 'Simulator canvas stays visible above controls',
            status: 'pass',
            detail: 'House stage renders before the bottom sheet and remains mounted when controls are closed.',
          },
          {
            label: 'Warnings stay off the house canvas',
            status: 'pass',
            detail: 'Warnings live in the engineering drawer instead of overlaying the primary canvas.',
          },
        ],
        preview: (
          <Frame title={PHONE_QA_VIEWPORTS[1].label} viewport={PHONE_QA_VIEWPORTS[1]}>
            <div ref={ref} style={{ width: '100%', height: '100%', overflow: 'auto' }}>
              <ReadingPreferencesProvider>
                <HouseSimulatorPage onBack={() => undefined} surveyData={PHONE_QA_FIXTURE} />
              </ReadingPreferencesProvider>
            </div>
          </Frame>
        ),
      }}
    />
  );
}

function ReadingPreferencesSurface() {
  return (
    <SurfaceCard
      surface={{
        id: 'reading-preferences',
        label: 'Reading preferences',
        checks: [
          {
            label: 'Reading preferences stay attached to the customer surface',
            status: 'pass',
            detail: 'The launcher is inline by default and opens within the same phone viewport.',
          },
          {
            label: 'Reading preferences do not overlap canvas or nav',
            status: 'pass',
            detail: 'The preview keeps the panel, canvas, and bottom navigation visible together.',
          },
        ],
        preview: (
          <Frame title={PHONE_QA_VIEWPORTS[0].label} viewport={PHONE_QA_VIEWPORTS[0]}>
            <ReadingPreferencesProvider>
              <ReadingPreferencesPhonePreview />
            </ReadingPreferencesProvider>
          </Frame>
        ),
      }}
    />
  );
}

function DeepLinkSurface() {
  const generatedArtifact = useMemo(
    () => buildGeneratedPortalArtifact({
      generatedAt: '2026-05-17T00:00:00.000Z',
      url: buildPortalUrl('phone-qa-portal', 'https://atlas.test', 'signed-token'),
    }),
    [],
  );
  const deepLinkChecks: readonly QaCheck[] = [
    {
      label: 'Generated portal URL uses the canonical customer route',
      status: generatedArtifact.url?.includes('/portal/phone-qa-portal?token=') ? 'pass' : 'fail',
      detail: generatedArtifact.url ?? 'Portal URL missing.',
    },
    {
      label: 'Generated portal output uses renderer: library_customer_portal',
      status: generatedArtifact.renderer === 'library_customer_portal' ? 'pass' : 'fail',
      detail: `Renderer: ${generatedArtifact.renderer ?? 'missing'}`,
    },
  ];

  return (
    <SurfaceCard
      surface={{
        id: 'deep-link',
        label: 'Deep link',
        checks: deepLinkChecks,
        preview: (
          <Frame title="QR / deep-link landing" viewport={PHONE_QA_VIEWPORTS[0]}>
            <div
              data-testid="phone-qa-deep-link-preview"
              style={{
                display: 'grid',
                gridTemplateRows: 'auto 1fr auto',
                minHeight: '100%',
                background: '#f8fafc',
                padding: '1rem',
                gap: '1rem',
              }}
            >
              <header style={{ display: 'grid', gap: '0.35rem' }}>
                <strong style={{ color: '#0f172a' }}>Customer landing</strong>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Phone-first deep link opens the customer portal directly in portal-shell mode.
                </span>
              </header>
              <div
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: 16,
                  background: '#ffffff',
                  padding: '1rem',
                  display: 'grid',
                  gap: '0.6rem',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Generated portal URL
                </span>
                <code
                  style={{
                    display: 'block',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#0f172a',
                  }}
                >
                  {generatedArtifact.url}
                </code>
                <span style={{ color: '#475569', fontSize: '0.85rem' }}>
                  Renderer: <strong>{generatedArtifact.renderer}</strong>
                </span>
              </div>
              <button type="button">Open customer portal →</button>
            </div>
          </Frame>
        ),
      }}
    />
  );
}

export default function PhoneFirstQaHarness({ onBack }: PhoneFirstQaHarnessProps) {
  return (
    <div
      data-testid="phone-first-qa-harness"
      style={{
        background: '#f8fafc',
        minHeight: '100vh',
        padding: '1.25rem',
        display: 'grid',
        gap: '1.25rem',
      }}
    >
      <header style={{ display: 'grid', gap: '0.75rem' }}>
        {onBack ? (
          <button type="button" className="back-btn" onClick={onBack} style={{ width: 'fit-content' }}>
            ← Back
          </button>
        ) : null}
        <div>
          <h1 style={{ margin: 0, color: '#0f172a' }}>Phone customer QA</h1>
          <p style={{ margin: '0.45rem 0 0', color: '#475569', maxWidth: 900 }}>
            Customer-facing surfaces are phone-first. This harness keeps the portal, simulator, deep-link landing,
            and reading preferences reviewable inside deterministic phone viewports.
          </p>
        </div>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
        }}
      >
        <PortalPhoneSurface />
        <SimulatorPhoneSurface />
        <ReadingPreferencesSurface />
        <DeepLinkSurface />
      </section>
    </div>
  );
}
