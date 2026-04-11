/**
 * AtlasPropertyHandoffHarness.tsx
 *
 * DEV-ONLY arrival surface for testing canonical AtlasPropertyV1 handoff.
 *
 * Allows loading a dev fixture or pasting raw JSON to inspect:
 *   - validation result
 *   - derived engine input
 *   - completeness summary
 *   - import warnings
 *   - visit seed metadata
 *
 * This component must NOT be included in production UX flows.
 * It is gated by the ?handoff=1 URL flag in App.tsx.
 */

import { useState, useCallback } from 'react';
import { importAtlasProperty } from '../importer/importAtlasProperty';
import { buildVisitSeedFromAtlasProperty } from '../importer/buildVisitSeedFromAtlasProperty';
import { buildPresentationSeedFromAtlasProperty } from '../importer/buildPresentationSeedFromAtlasProperty';
import type { AtlasPropertyImportResult } from '../types/atlasPropertyHandoff.types';

// ─── Dev fixture ───────────────────────────────────────────────────────────────

/**
 * Minimal valid AtlasPropertyV1 dev fixture for harness testing.
 * Represents a typical combi-boiler semi-detached property.
 */
const DEV_FIXTURE = {
  version: '1.0',
  propertyId: 'dev_handoff_fixture_01',
  createdAt: '2024-06-01T10:00:00Z',
  updatedAt: '2024-06-01T10:00:00Z',
  status: 'draft',
  sourceApps: ['atlas_scan'],
  property: {
    address1: '42 Atlas Lane',
    town: 'Bristol',
    postcode: 'BS1 5TR',
    uprn: '100012345678',
    propertyType: {
      value: 'semi_detached',
      source: 'atlas_scan',
      confidence: 'high',
    },
    buildEra: {
      value: '1950_to_1966',
      source: 'atlas_scan',
      confidence: 'medium',
    },
  },
  capture: {
    sessionId: 'session_dev_fixture_01',
  },
  building: {
    floors: [],
    rooms: [],
    zones: [],
    boundaries: [],
    openings: [],
    emitters: [],
    systemComponents: [],
  },
  household: {
    composition: {
      adultCount:                  { value: 2, source: 'customer_stated', confidence: 'high' },
      childCount0to4:              { value: 0, source: 'customer_stated', confidence: 'high' },
      childCount5to10:             { value: 1, source: 'customer_stated', confidence: 'high' },
      childCount11to17:            { value: 0, source: 'customer_stated', confidence: 'high' },
      youngAdultCount18to25AtHome: { value: 0, source: 'customer_stated', confidence: 'high' },
    },
    occupancyPattern: { value: 'steady_home', source: 'customer_stated', confidence: 'medium' },
    hotWaterUsage: {
      bathPresent:      { value: true,  source: 'engineer_entered', confidence: 'high' },
      showerPresent:    { value: true,  source: 'engineer_entered', confidence: 'high' },
      bathroomCount:    { value: 1,     source: 'engineer_entered', confidence: 'high' },
    },
  },
  currentSystem: {
    family: { value: 'combi', source: 'engineer_entered', confidence: 'high' },
    dhwType: { value: 'combi', source: 'engineer_entered', confidence: 'high' },
    heatSource: {
      ratedOutputKw: { value: 28, source: 'engineer_entered', confidence: 'high' },
      installYear:   { value: 2018, source: 'engineer_entered', confidence: 'high' },
    },
    distribution: {
      dominantPipeDiameterMm: { value: 22, source: 'engineer_entered', confidence: 'medium' },
    },
  },
  evidence: {
    photos: [],
    voiceNotes: [],
    textNotes: [],
    qaFlags: [],
    timeline: [],
  },
  derived: {
    heatLoss: {
      peakWatts: { value: 7200, source: 'derived', confidence: 'medium' },
    },
    hydraulics: {
      dynamicPressureBar: { value: 2.8, source: 'measured', confidence: 'high' },
      mainsFlowLpm:       { value: 16,  source: 'measured', confidence: 'high' },
    },
  },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 14, marginBottom: 8, marginTop: 0, color: '#1e293b' }}>
      {children}
    </h2>
  );
}

function InfoBox({
  children,
  colour = '#f8fafc',
  border = '#e2e8f0',
}: {
  children: React.ReactNode;
  colour?: string;
  border?: string;
}) {
  return (
    <div style={{
      background: colour,
      border: `1px solid ${border}`,
      borderRadius: 6,
      padding: 12,
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function CompletenessRow({
  label,
  ok,
}: {
  label: string;
  ok: boolean;
}) {
  return (
    <tr>
      <td style={{ paddingRight: 16, fontSize: 12, color: '#6b7280', paddingBottom: 4 }}>{label}</td>
      <td style={{ fontSize: 12, paddingBottom: 4 }}>
        {ok
          ? <span style={{ color: '#22c55e', fontWeight: 700 }}>✓ present</span>
          : <span style={{ color: '#ef4444', fontWeight: 700 }}>✗ missing</span>}
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function AtlasPropertyHandoffHarness({ onBack }: Props) {
  const [rawJson, setRawJson] = useState('');
  const [result, setResult] = useState<AtlasPropertyImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [fixtureLoaded, setFixtureLoaded] = useState(false);

  const runHandoff = useCallback((input: unknown) => {
    setParseError(null);
    setImportError(null);
    setResult(null);
    try {
      const imported = importAtlasProperty(input, 'dev_fixture');
      setResult(imported);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleLoadFixture = useCallback(() => {
    const json = JSON.stringify(DEV_FIXTURE, null, 2);
    setRawJson(json);
    setFixtureLoaded(true);
    runHandoff(DEV_FIXTURE);
  }, [runHandoff]);

  const handleRunRaw = useCallback(() => {
    setFixtureLoaded(false);
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      runHandoff(parsed);
    } catch {
      setParseError('JSON parse error — input is not valid JSON.');
    }
  }, [rawJson, runHandoff]);

  const handleJsonChange = useCallback((value: string) => {
    setRawJson(value);
    setResult(null);
    setParseError(null);
    setImportError(null);
    setFixtureLoaded(false);
  }, []);

  // Derive visit seed and presentation seed when a result is available
  const visitSeed = result
    ? buildVisitSeedFromAtlasProperty(result.atlasProperty, result.completeness)
    : null;

  const presentationSeed = result
    ? buildPresentationSeedFromAtlasProperty(result)
    : null;

  return (
    <div style={{ fontFamily: 'monospace', maxWidth: 960, margin: '0 auto', padding: 24 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={onBack} style={{ fontSize: 13, padding: '4px 12px' }}>← Back</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>🏠 Canonical Handoff Dev Harness</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
            DEV-ONLY — not visible in production. Test canonical AtlasPropertyV1 handoff arrival.
          </p>
        </div>
      </div>

      {/* ── Fixture loader ──────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 20 }}>
        <SectionHeading>Load dev fixture</SectionHeading>
        <button
          onClick={handleLoadFixture}
          style={{
            padding: '6px 16px',
            fontSize: 12,
            fontFamily: 'monospace',
            border: fixtureLoaded ? '2px solid #6366f1' : '1px solid #ccc',
            borderRadius: 4,
            background: fixtureLoaded ? '#eef2ff' : '#fff',
            cursor: 'pointer',
          }}
        >
          dev_handoff_fixture_01.json
        </button>
        <span style={{ marginLeft: 10, fontSize: 11, color: '#9ca3af' }}>
          Semi-detached, combi, 2 adults + 1 child, BS1 5TR
        </span>
      </section>

      {/* ── Raw JSON input ──────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 20 }}>
        <SectionHeading>Raw AtlasPropertyV1 JSON</SectionHeading>
        <textarea
          value={rawJson}
          onChange={e => handleJsonChange(e.target.value)}
          rows={12}
          style={{
            width: '100%',
            fontFamily: 'monospace',
            fontSize: 11,
            padding: 10,
            border: '1px solid #ccc',
            borderRadius: 4,
            boxSizing: 'border-box',
          }}
          placeholder='Paste an AtlasPropertyV1 JSON object here…'
        />
        <button
          onClick={handleRunRaw}
          disabled={!rawJson.trim()}
          style={{ marginTop: 8, padding: '6px 18px', fontSize: 13 }}
        >
          Run handoff import
        </button>
      </section>

      {/* ── Error states ────────────────────────────────────────────────────── */}
      {parseError && (
        <InfoBox colour='#fef2f2' border='#fca5a5'>
          <strong style={{ color: '#b91c1c' }}>⚠ JSON parse error</strong>
          <p style={{ margin: '6px 0 0', fontSize: 12 }}>{parseError}</p>
        </InfoBox>
      )}

      {importError && (
        <InfoBox colour='#fef2f2' border='#fca5a5'>
          <strong style={{ color: '#b91c1c' }}>⚠ Import validation failed</strong>
          <p style={{ margin: '6px 0 0', fontSize: 12, wordBreak: 'break-word' }}>{importError}</p>
        </InfoBox>
      )}

      {/* ── Result panels ───────────────────────────────────────────────────── */}
      {result && (
        <>
          {/* Completeness summary */}
          <section style={{ marginBottom: 20 }}>
            <SectionHeading>
              Completeness summary
              {' '}
              {result.completeness.readyForSimulation
                ? <span style={{ color: '#22c55e', fontSize: 13 }}>✓ ready for simulation</span>
                : <span style={{ color: '#f59e0b', fontSize: 13 }}>⚠ not ready for simulation</span>}
            </SectionHeading>
            <InfoBox colour={result.completeness.readyForSimulation ? '#f0fdf4' : '#fffbeb'}
              border={result.completeness.readyForSimulation ? '#86efac' : '#fcd34d'}>
              <table style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  <CompletenessRow label='Property (postcode)' ok={result.completeness.sections.property} />
                  <CompletenessRow label='Household composition' ok={result.completeness.sections.household} />
                  <CompletenessRow label='Current system' ok={result.completeness.sections.currentSystem} />
                  <CompletenessRow label='Building rooms' ok={result.completeness.sections.building} />
                  <CompletenessRow label='Heat loss figure' ok={result.completeness.sections.heatLoss} />
                  <CompletenessRow label='Hydraulic measurements' ok={result.completeness.sections.hydraulics} />
                </tbody>
              </table>
              {result.completeness.missingFields.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong style={{ fontSize: 12 }}>Missing fields:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 11, color: '#92400e' }}>
                    {result.completeness.missingFields.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
            </InfoBox>
          </section>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <section style={{ marginBottom: 20 }}>
              <SectionHeading>Import warnings ({result.warnings.length})</SectionHeading>
              <InfoBox colour='#fffbeb' border='#fcd34d'>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#92400e' }}>
                  {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </InfoBox>
            </section>
          )}

          {/* Visit seed */}
          {visitSeed && (
            <section style={{ marginBottom: 20 }}>
              <SectionHeading>Visit seed</SectionHeading>
              <InfoBox>
                <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    <tr>
                      <td style={{ paddingRight: 16, color: '#6b7280', paddingBottom: 4 }}>Address</td>
                      <td style={{ paddingBottom: 4 }}>{visitSeed.address ?? <em style={{ color: '#9ca3af' }}>—</em>}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingRight: 16, color: '#6b7280', paddingBottom: 4 }}>Reference</td>
                      <td style={{ paddingBottom: 4 }}><code>{visitSeed.reference}</code></td>
                    </tr>
                    <tr>
                      <td style={{ paddingRight: 16, color: '#6b7280', paddingBottom: 4 }}>Display title</td>
                      <td style={{ paddingBottom: 4 }}>{visitSeed.displayTitle ?? <em style={{ color: '#9ca3af' }}>—</em>}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingRight: 16, color: '#6b7280', paddingBottom: 4 }}>Status hint</td>
                      <td style={{ paddingBottom: 4 }}><code>{visitSeed.statusHint}</code></td>
                    </tr>
                  </tbody>
                </table>
              </InfoBox>
            </section>
          )}

          {/* Derived engine input */}
          <section style={{ marginBottom: 20 }}>
            <SectionHeading>Derived engine input (partial EngineInputV2_3)</SectionHeading>
            <InfoBox>
              <pre style={{ margin: 0, fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(result.engineInput, null, 2)}
              </pre>
            </InfoBox>
          </section>

          {/* CTA */}
          {result.completeness.readyForSimulation && (
            <section style={{ marginBottom: 20 }}>
              <SectionHeading>Next step</SectionHeading>
              <InfoBox colour='#f0fdf4' border='#86efac'>
                <p style={{ margin: 0, fontSize: 13 }}>
                  ✓ This property is ready for simulation. In a live flow, the presentation seed
                  (source: <code>{presentationSeed?.source}</code>) would be passed into the Atlas Mind
                  simulator via route state.
                </p>
                <details style={{ marginTop: 10 }}>
                  <summary style={{ fontSize: 12, cursor: 'pointer', color: '#16a34a' }}>
                    View presentation seed JSON
                  </summary>
                  <pre style={{ marginTop: 8, fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(presentationSeed, null, 2)}
                  </pre>
                </details>
              </InfoBox>
            </section>
          )}

          {!result.completeness.readyForSimulation && (
            <section style={{ marginBottom: 20 }}>
              <InfoBox colour='#fffbeb' border='#fcd34d'>
                <p style={{ margin: 0, fontSize: 13 }}>
                  ⚠ Property is not yet ready for simulation. Resolve the missing fields above
                  before launching the simulator.
                </p>
              </InfoBox>
            </section>
          )}
        </>
      )}
    </div>
  );
}
