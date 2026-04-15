import { useEffect, useMemo, useState } from 'react';
import {
  evaluateBuildingHeightMeasurement,
  type BuildingHeightConfidenceLevel,
} from '../../features/measurements/buildingHeight';
import './BuildingHeightCheck.css';

type MotionPermissionState = 'unknown' | 'granted' | 'denied' | 'not-supported';

interface DeviceOrientationEventConstructor {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

function clampPitch(beta: number): number {
  return Math.max(-89.9, Math.min(89.9, beta));
}

function confidenceBadgeClass(confidenceLevel: BuildingHeightConfidenceLevel): string {
  if (confidenceLevel === 'high') return 'height-check__confidence height-check__confidence--high';
  if (confidenceLevel === 'medium') return 'height-check__confidence height-check__confidence--medium';
  return 'height-check__confidence height-check__confidence--low';
}

export default function BuildingHeightCheck({ onBack }: { onBack: () => void }) {
  const [distanceInput, setDistanceInput] = useState('');
  const [baseAngleInput, setBaseAngleInput] = useState('');
  const [topAngleInput, setTopAngleInput] = useState('');
  const [baseCapturedDeg, setBaseCapturedDeg] = useState<number | null>(null);
  const [topCapturedDeg, setTopCapturedDeg] = useState<number | null>(null);
  const [livePitchDeg, setLivePitchDeg] = useState<number | null>(null);
  const [permissionState, setPermissionState] = useState<MotionPermissionState>('unknown');
  const [showResult, setShowResult] = useState(false);

  const sensorSupported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

  useEffect(() => {
    if (!sensorSupported || permissionState !== 'granted') return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (typeof event.beta !== 'number' || Number.isNaN(event.beta)) return;
      setLivePitchDeg(clampPitch(event.beta));
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [permissionState, sensorSupported]);

  const measurement = useMemo(() => {
    return evaluateBuildingHeightMeasurement({
      distanceMeters: Number(distanceInput),
      baseAngleDeg: baseCapturedDeg ?? Number(baseAngleInput),
      topAngleDeg: topCapturedDeg ?? Number(topAngleInput),
      usedSensorCapture: baseCapturedDeg != null && topCapturedDeg != null,
    });
  }, [distanceInput, baseAngleInput, topAngleInput, baseCapturedDeg, topCapturedDeg]);

  async function enableAngleCapture() {
    if (!sensorSupported) {
      setPermissionState('not-supported');
      return;
    }
    const orientationEventCtor = window.DeviceOrientationEvent as unknown as DeviceOrientationEventConstructor;
    if (typeof orientationEventCtor.requestPermission !== 'function') {
      setPermissionState('granted');
      return;
    }
    try {
      const permission = await orientationEventCtor.requestPermission();
      setPermissionState(permission === 'granted' ? 'granted' : 'denied');
    } catch {
      setPermissionState('denied');
    }
  }

  function captureBaseAngle() {
    if (livePitchDeg == null) return;
    const rounded = Math.round(livePitchDeg * 10) / 10;
    setBaseCapturedDeg(rounded);
    setBaseAngleInput(String(rounded));
  }

  function captureTopAngle() {
    if (livePitchDeg == null) return;
    const rounded = Math.round(livePitchDeg * 10) / 10;
    setTopCapturedDeg(rounded);
    setTopAngleInput(String(rounded));
  }

  return (
    <div className="height-check">
      <div className="height-check__header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h1>Building Height Check</h1>
        <p>Crosshair method with manual distance to wall.</p>
      </div>

      <div className="height-check__panel">
        <h2>Use guidance</h2>
        <ol>
          <li>Enter horizontal distance to the base of the wall.</li>
          <li>Aim the crosshair at the wall base and capture base angle.</li>
          <li>Aim the crosshair at the apex and capture top angle.</li>
          <li>Calculate estimated building height.</li>
        </ol>
      </div>

      <div className="height-check__panel">
        <label htmlFor="distance-input">Distance to base of wall (m)</label>
        <input
          id="distance-input"
          type="number"
          min="0"
          step="0.1"
          value={distanceInput}
          onChange={(event) => setDistanceInput(event.target.value)}
          placeholder="e.g. 12.5"
        />
      </div>

      <div className="height-check__panel">
        <h2>Angle capture</h2>
        <button className="height-check__btn" onClick={() => { void enableAngleCapture(); }}>
          Enable angle capture
        </button>
        <div className="height-check__crosshair">＋</div>
        <p className="height-check__live">
          Live pitch: {livePitchDeg == null ? 'Not available' : `${livePitchDeg.toFixed(1)}°`}
        </p>
        <p className="height-check__status">
          {permissionState === 'granted' && 'Angle capture enabled.'}
          {permissionState === 'denied' && 'Angle capture permission denied. Use manual angle entry.'}
          {permissionState === 'not-supported' && 'Device angle sensor not supported. Use manual angle entry.'}
          {permissionState === 'unknown' && 'Enable angle capture, then aim and capture each point.'}
        </p>
        <div className="height-check__capture-row">
          <button className="height-check__btn" onClick={captureBaseAngle} disabled={livePitchDeg == null}>
            Capture base angle
          </button>
          <span>{baseCapturedDeg == null ? '—' : `${baseCapturedDeg.toFixed(1)}°`}</span>
        </div>
        <div className="height-check__capture-row">
          <button className="height-check__btn" onClick={captureTopAngle} disabled={livePitchDeg == null}>
            Capture top angle
          </button>
          <span>{topCapturedDeg == null ? '—' : `${topCapturedDeg.toFixed(1)}°`}</span>
        </div>
      </div>

      <div className="height-check__panel">
        <h2>Manual angle entry (fallback)</h2>
        <div className="height-check__manual-grid">
          <label htmlFor="base-angle-input">
            Base angle (°)
            <input
              id="base-angle-input"
              type="number"
              step="0.1"
              value={baseAngleInput}
              onChange={(event) => setBaseAngleInput(event.target.value)}
            />
          </label>
          <label htmlFor="top-angle-input">
            Top angle (°)
            <input
              id="top-angle-input"
              type="number"
              step="0.1"
              value={topAngleInput}
              onChange={(event) => setTopAngleInput(event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="height-check__actions">
        <button className="cta-btn height-check__calculate" onClick={() => setShowResult(true)}>
          Calculate height
        </button>
      </div>

      {showResult && (
        <div className="height-check__panel">
          <h2>Result</h2>
          {measurement.valid && measurement.heightMeters != null ? (
            <>
              <p className="height-check__result-value">{measurement.heightMeters.toFixed(2)} m</p>
              <p className={confidenceBadgeClass(measurement.confidenceLevel)}>
                Confidence: {measurement.confidenceLevel}
              </p>
              <ul className="height-check__result-list">
                <li>Distance: {Number(distanceInput).toFixed(2)} m</li>
                <li>Base angle: {(baseCapturedDeg ?? Number(baseAngleInput)).toFixed(1)}°</li>
                <li>Top angle: {(topCapturedDeg ?? Number(topAngleInput)).toFixed(1)}°</li>
                <li>Angle separation: {(measurement.angleSeparationDeg ?? 0).toFixed(1)}°</li>
                <li>Capture mode: {baseCapturedDeg != null && topCapturedDeg != null ? 'Device angle capture' : 'Manual angle entry'}</li>
              </ul>
            </>
          ) : (
            <p className="height-check__error">Please fix validation errors before calculating height.</p>
          )}

          {measurement.issues.length > 0 && (
            <ul className="height-check__issues">
              {measurement.issues.map(issue => (
                <li key={issue.code} className={issue.severity === 'error' ? 'height-check__issue--error' : 'height-check__issue--warn'}>
                  {issue.message}
                </li>
              ))}
            </ul>
          )}

          <h3>Measurement notes</h3>
          <ul className="height-check__notes">
            {measurement.notes.map(note => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
