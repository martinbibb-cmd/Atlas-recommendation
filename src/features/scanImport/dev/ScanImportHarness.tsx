/**
 * ScanImportHarness.tsx
 *
 * DEV-ONLY import harness for testing scan bundle ingestion.
 *
 * Allows loading a fixture scan bundle (or pasting raw JSON) and inspecting:
 *   - validation result
 *   - import warnings / errors
 *   - mapped floor-plan entities
 *   - provenance markers
 *
 * This component must NOT be included in production UX flows.
 * It is gated by the ?scan-import=1 URL flag in App.tsx.
 */

import { useState, useCallback } from 'react';
import { importScanBundle } from '../importer/scanImporter';
import type { ScanImportResult } from '../importer/scanImporter';

// ─── Fixture names ─────────────────────────────────────────────────────────────

const FIXTURE_NAMES = [
  'valid-single-room',
  'valid-multi-room',
  'low-confidence',
  'partial-missing-openings',
  'invalid-schema',
  'unsupported-version',
] as const;

type FixtureName = (typeof FIXTURE_NAMES)[number];

async function loadFixture(name: FixtureName): Promise<unknown> {
  // Dynamic imports keep fixture JSON out of the production bundle
  const modules: Record<FixtureName, () => Promise<unknown>> = {
    'valid-single-room':       () => import('../fixtures/valid-single-room.json'),
    'valid-multi-room':        () => import('../fixtures/valid-multi-room.json'),
    'low-confidence':          () => import('../fixtures/low-confidence.json'),
    'partial-missing-openings':() => import('../fixtures/partial-missing-openings.json'),
    'invalid-schema':          () => import('../fixtures/invalid-schema.json'),
    'unsupported-version':     () => import('../fixtures/unsupported-version.json'),
  };
  return modules[name]();
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ScanImportResult['status'] }) {
  const colours: Record<ScanImportResult['status'], string> = {
    success:                    '#22c55e',
    success_with_warnings:      '#f59e0b',
    rejected_invalid:           '#ef4444',
    rejected_unsupported_version: '#8b5cf6',
  };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 4,
      background: colours[status],
      color: '#fff',
      fontWeight: 700,
      fontSize: 13,
      letterSpacing: '0.03em',
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function ScanImportHarness({ onBack }: Props) {
  const [rawJson, setRawJson] = useState('');
  const [result, setResult] = useState<ScanImportResult | null>(null);
  const [loadingFixture, setLoadingFixture] = useState(false);
  const [activeFixture, setActiveFixture] = useState<FixtureName | null>(null);

  const runImport = useCallback((input: unknown) => {
    setResult(importScanBundle(input));
  }, []);

  const handleJsonInput = useCallback((json: string) => {
    setRawJson(json);
    setResult(null);
    setActiveFixture(null);
  }, []);

  const handleImportRaw = useCallback(() => {
    try {
      const parsed = JSON.parse(rawJson);
      runImport(parsed);
    } catch {
      setResult({ status: 'rejected_invalid', errors: ['JSON parse error — input is not valid JSON'] });
    }
  }, [rawJson, runImport]);

  const handleLoadFixture = useCallback(async (name: FixtureName) => {
    setLoadingFixture(true);
    setActiveFixture(name);
    setResult(null);
    try {
      const fixture = await loadFixture(name);
      setRawJson(JSON.stringify(fixture, null, 2));
      runImport(fixture);
    } finally {
      setLoadingFixture(false);
    }
  }, [runImport]);

  return (
    <div style={{ fontFamily: 'monospace', maxWidth: 900, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={onBack} style={{ fontSize: 13, padding: '4px 12px' }}>← Back</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>🔬 Scan Import Dev Harness</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
            DEV-ONLY — not visible in production. Load a fixture or paste raw JSON.
          </p>
        </div>
      </div>

      {/* Fixture buttons */}
      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>Load fixture</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {FIXTURE_NAMES.map(name => (
            <button
              key={name}
              onClick={() => handleLoadFixture(name)}
              disabled={loadingFixture}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontFamily: 'monospace',
                border: activeFixture === name ? '2px solid #6366f1' : '1px solid #ccc',
                borderRadius: 4,
                background: activeFixture === name ? '#eef2ff' : '#fff',
                cursor: 'pointer',
              }}
            >
              {name}.json
            </button>
          ))}
        </div>
      </section>

      {/* Raw JSON editor */}
      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>Raw JSON input</h2>
        <textarea
          value={rawJson}
          onChange={e => handleJsonInput(e.target.value)}
          rows={12}
          style={{
            width: '100%',
            fontFamily: 'monospace',
            fontSize: 12,
            padding: 10,
            border: '1px solid #ccc',
            borderRadius: 4,
            boxSizing: 'border-box',
          }}
          placeholder="Paste a ScanBundleV1 JSON object here…"
        />
        <button
          onClick={handleImportRaw}
          disabled={!rawJson.trim()}
          style={{ marginTop: 8, padding: '6px 18px', fontSize: 13 }}
        >
          Run import
        </button>
      </section>

      {/* Result panel */}
      {result && (
        <section>
          <h2 style={{ fontSize: 14, marginBottom: 8 }}>
            Import result: <StatusBadge status={result.status} />
          </h2>

          {/* Errors */}
          {result.status === 'rejected_invalid' && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: 12 }}>
              <strong>Validation errors:</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, fontSize: 12 }}>
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {/* Unsupported version */}
          {result.status === 'rejected_unsupported_version' && (
            <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 6, padding: 12 }}>
              <p style={{ margin: 0, fontSize: 12 }}>
                Bundle version <code>{result.version}</code> is not supported.<br />
                Supported: {result.supportedVersions.join(', ')}
              </p>
            </div>
          )}

          {/* Warnings */}
          {(result.status === 'success_with_warnings') && result.warnings.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: 12, marginBottom: 12 }}>
              <strong>Warnings ({result.warnings.length}):</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, fontSize: 12 }}>
                {result.warnings.map((w, i) => (
                  <li key={i}>
                    <code style={{ color: '#92400e' }}>{w.code}</code>
                    {w.entityId && <code style={{ color: '#6b7280', marginLeft: 4 }}>[{w.entityId}]</code>}
                    {' — '}{w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Draft summary */}
          {(result.status === 'success' || result.status === 'success_with_warnings') && (
            <>
              {/* Provenance summary */}
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: 12, marginBottom: 12 }}>
                <strong>Provenance summary:</strong>
                <table style={{ marginTop: 8, fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    <tr>
                      <td style={{ paddingRight: 16, color: '#6b7280' }}>Bundle ID</td>
                      <td><code>{result.provenanceSummary.bundleId}</code></td>
                    </tr>
                    <tr>
                      <td style={{ paddingRight: 16, color: '#6b7280' }}>Bundle version</td>
                      <td><code>{result.provenanceSummary.bundleVersion}</code></td>
                    </tr>
                    <tr>
                      <td style={{ paddingRight: 16, color: '#6b7280' }}>Captured at</td>
                      <td>{result.provenanceSummary.capturedAt}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingRight: 16, color: '#6b7280' }}>Rooms</td>
                      <td>{result.provenanceSummary.totalRooms}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingRight: 16, color: '#6b7280' }}>Walls</td>
                      <td>{result.provenanceSummary.totalWalls}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingRight: 16, color: '#6b7280' }}>Openings</td>
                      <td>{result.provenanceSummary.totalOpenings}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingRight: 16, color: '#6b7280' }}>Confidence (H/M/L)</td>
                      <td>
                        <span style={{ color: '#22c55e' }}>▲ {result.provenanceSummary.highConfidenceCount}</span>
                        {' / '}
                        <span style={{ color: '#f59e0b' }}>● {result.provenanceSummary.mediumConfidenceCount}</span>
                        {' / '}
                        <span style={{ color: '#ef4444' }}>▼ {result.provenanceSummary.lowConfidenceCount}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Floor / room breakdown */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12 }}>
                <strong>Mapped floor-plan entities:</strong>
                {result.draft.floors.map(floor => (
                  <div key={floor.id} style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                      {floor.name} (level {floor.levelIndex})
                    </div>
                    {floor.rooms.map(room => (
                      <div key={room.id} style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 4,
                        padding: '6px 10px',
                        marginBottom: 6,
                        fontSize: 12,
                      }}>
                        <div>
                          <strong>{room.name}</strong>
                          {' '}
                          <code style={{ color: '#6366f1' }}>{room.roomType}</code>
                          {room.areaM2 != null && <span style={{ color: '#6b7280', marginLeft: 8 }}>{room.areaM2.toFixed(1)} m²</span>}
                        </div>
                        {room.provenance && (
                          <div style={{ color: '#6b7280', marginTop: 2 }}>
                            provenance: <code>{room.provenance.source}</code>
                            {' / '}confidence: <code>{room.provenance.confidenceBand ?? 'n/a'}</code>
                            {' / '}status: <code>{room.provenance.reviewStatus}</code>
                            {' / '}bundle: <code>{room.provenance.sourceBundleId}</code>
                          </div>
                        )}
                        <div style={{ marginTop: 4, color: '#6b7280' }}>
                          Walls: {floor.walls.filter(w => w.floorId === floor.id).length}
                          {' · '}Openings: {floor.openings.filter(o => o.floorId === floor.id).length}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
