import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  evaluateBuildingHeightMeasurement,
  generateMathBreakdown,
  type BuildingHeightConfidenceLevel,
} from '../../features/measurements/buildingHeight';
import './BuildingHeightCheck.css';

type CaptureMode = 'manual' | 'automatic';
type CameraStatus = 'idle' | 'starting' | 'active' | 'error';

interface DeviceOrientationEventConstructor {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

const ORIENTATION_QUARTER = 90;
const ORIENTATION_HALF = 180;
const ORIENTATION_THREE_QUARTER = 270;
const LEVEL_ROLL_TOLERANCE_DEG = 2;

function getScreenOrientationAngle(): number {
  if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') {
    return screen.orientation.angle;
  }
  const win = window as Window & { orientation?: number };
  if (typeof win.orientation === 'number') return win.orientation;
  return 0;
}

function getCameraPitch(event: DeviceOrientationEvent): number {
  const { beta, gamma } = event;
  if (beta == null || !Number.isFinite(beta)) return NaN;
  const normalized = ((getScreenOrientationAngle() % 360) + 360) % 360;
  if (normalized === ORIENTATION_QUARTER) return gamma != null && Number.isFinite(gamma) ? gamma : NaN;
  if (normalized === ORIENTATION_THREE_QUARTER) return gamma != null && Number.isFinite(gamma) ? -gamma : NaN;
  if (normalized === ORIENTATION_HALF) return -beta - ORIENTATION_QUARTER;
  return beta - ORIENTATION_QUARTER;
}

function getCameraRoll(event: DeviceOrientationEvent): number {
  const { beta, gamma } = event;
  if (gamma == null || !Number.isFinite(gamma)) return NaN;
  if (beta == null || !Number.isFinite(beta)) return NaN;
  const normalized = ((getScreenOrientationAngle() % 360) + 360) % 360;
  if (normalized === ORIENTATION_QUARTER) return beta - ORIENTATION_QUARTER;
  if (normalized === ORIENTATION_THREE_QUARTER) return -beta - ORIENTATION_QUARTER;
  if (normalized === ORIENTATION_HALF) return -gamma;
  return gamma;
}

function clampPitch(pitch: number): number {
  return Math.max(-89.9, Math.min(89.9, pitch));
}

function confidenceBadgeClass(confidenceLevel: BuildingHeightConfidenceLevel): string {
  if (confidenceLevel === 'high') return 'height-check__confidence height-check__confidence--high';
  if (confidenceLevel === 'medium') return 'height-check__confidence height-check__confidence--medium';
  return 'height-check__confidence height-check__confidence--low';
}

export default function BuildingHeightCheck({ onBack }: { onBack: () => void }) {
  const [captureMode, setCaptureMode] = useState<CaptureMode>('manual');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [distanceInput, setDistanceInput] = useState('');
  const [baseAngleInput, setBaseAngleInput] = useState('');
  const [topAngleInput, setTopAngleInput] = useState('');
  const [baseCapturedDeg, setBaseCapturedDeg] = useState<number | null>(null);
  const [topCapturedDeg, setTopCapturedDeg] = useState<number | null>(null);
  const [livePitchDeg, setLivePitchDeg] = useState<number | null>(null);
  const [liveRollDeg, setLiveRollDeg] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showMathBreakdown, setShowMathBreakdown] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const pitch = getCameraPitch(event);
    const roll = getCameraRoll(event);
    if (Number.isFinite(pitch)) setLivePitchDeg(clampPitch(pitch));
    if (Number.isFinite(roll)) setLiveRollDeg(roll);
  }, []);

  useEffect(() => {
    if (!motionEnabled) return;
    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [motionEnabled, handleOrientation]);

  const isLevelOk = liveRollDeg != null && Math.abs(liveRollDeg) <= LEVEL_ROLL_TOLERANCE_DEG;

  async function enableMotion(): Promise<boolean> {
    if (motionEnabled) return true;
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return false;
    const orientationEventCtor = window.DeviceOrientationEvent as unknown as DeviceOrientationEventConstructor;
    if (typeof orientationEventCtor.requestPermission === 'function') {
      try {
        const permission = await orientationEventCtor.requestPermission();
        if (permission !== 'granted') return false;
      } catch {
        return false;
      }
    }
    setMotionEnabled(true);
    return true;
  }

  async function startAutomaticCapture() {
    setCameraError(null);
    const motionReady = await enableMotion();
    if (!motionReady) {
      setCameraError('Motion permission denied. Use manual entry.');
      setCaptureMode('manual');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera capture is not supported by this browser. Use manual entry.');
      setCaptureMode('manual');
      return;
    }
    setCameraStatus('starting');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraStatus('active');
    } catch (error) {
      let message = 'Could not start camera. Use manual entry.';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') message = 'Camera permission denied. Use manual entry.';
        else if (error.name === 'NotFoundError') message = 'No camera found on this device. Use manual entry.';
        else if (error.name === 'NotSupportedError') message = 'Camera capture is not supported. Use manual entry.';
      }
      setCameraError(message);
      setCaptureMode('manual');
      setCameraStatus('idle');
    }
  }

  function switchToManual() {
    setCaptureMode('manual');
    stopCamera();
    setCameraStatus('idle');
    setCameraError(null);
  }

  function switchToAutomatic() {
    setCaptureMode('automatic');
    void startAutomaticCapture();
  }

  function captureBaseAngle() {
    if (livePitchDeg == null) return;
    const rounded = Math.round(livePitchDeg * 100) / 100;
    setBaseCapturedDeg(rounded);
    setBaseAngleInput(String(rounded));
  }

  function captureTopAngle() {
    if (livePitchDeg == null) return;
    const rounded = Math.round(livePitchDeg * 100) / 100;
    setTopCapturedDeg(rounded);
    setTopAngleInput(String(rounded));
  }

  const measurement = useMemo(() => {
    return evaluateBuildingHeightMeasurement({
      distanceMeters: Number(distanceInput),
      baseAngleDeg: baseCapturedDeg ?? Number(baseAngleInput),
      topAngleDeg: topCapturedDeg ?? Number(topAngleInput),
      usedSensorCapture: baseCapturedDeg != null && topCapturedDeg != null,
    });
  }, [distanceInput, baseAngleInput, topAngleInput, baseCapturedDeg, topCapturedDeg]);

  function doCalculate() {
    setShowResult(true);
    setShowMathBreakdown(false);
    if (captureMode === 'automatic' && measurement.valid) {
      stopCamera();
      setCameraStatus('idle');
      setCaptureMode('manual');
    }
  }

  function resetAll() {
    setDistanceInput('');
    setBaseAngleInput('');
    setTopAngleInput('');
    setBaseCapturedDeg(null);
    setTopCapturedDeg(null);
    setLivePitchDeg(null);
    setLiveRollDeg(null);
    setShowResult(false);
    setShowMathBreakdown(false);
    stopCamera();
    setCameraStatus('idle');
    setCameraError(null);
    setCaptureMode('manual');
  }

  const mathBreakdown = useMemo(() => {
    if (!measurement.valid || measurement.heightMeters == null) return null;
    return generateMathBreakdown(
      Number(distanceInput),
      baseCapturedDeg ?? Number(baseAngleInput),
      topCapturedDeg ?? Number(topAngleInput),
      measurement.heightMeters,
    );
  }, [measurement, distanceInput, baseAngleInput, topAngleInput, baseCapturedDeg, topCapturedDeg]);

  const cameraOpen = captureMode === 'automatic' && cameraStatus === 'active';

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
          step="0.01"
          value={distanceInput}
          onChange={(event) => setDistanceInput(event.target.value)}
          placeholder="e.g. 12.5"
        />
      </div>

      <div className="height-check__panel">
        <h2>Angle capture</h2>
        <div className="height-check__mode-row">
          <button
            className={`height-check__mode-btn${captureMode === 'manual' ? ' height-check__mode-btn--active' : ''}`}
            onClick={switchToManual}
            type="button"
          >
            Manual entry
          </button>
          <button
            className={`height-check__mode-btn${captureMode === 'automatic' ? ' height-check__mode-btn--active' : ''}`}
            onClick={switchToAutomatic}
            type="button"
          >
            Automatic camera
          </button>
        </div>

        {cameraError && <p className="height-check__error">{cameraError}</p>}

        <div
          className={`height-check__camera-wrap${cameraOpen ? ' height-check__camera-wrap--fullscreen' : ' height-check__camera-wrap--hidden'}`}
        >
          <video
            ref={videoRef}
            className="height-check__camera-video"
            autoPlay
            playsInline
            muted
          />
          <div
            className="height-check__camera-overlay"
            role="img"
            aria-label="Camera view with centre crosshairs"
          >
            <div className="height-check__scope-ring" />
            <div className="height-check__scope-line-v" />
            <div className="height-check__scope-line-h" />
            <div className="height-check__scope-dot" />
          </div>
          {cameraOpen && (
            <div className="height-check__camera-controls">
              <button
                className={`height-check__capture-btn${baseCapturedDeg != null ? ' height-check__capture-btn--stored' : ''}`}
                onClick={captureBaseAngle}
                type="button"
              >
                {baseCapturedDeg != null ? `Recapture base (${baseCapturedDeg.toFixed(2)}°)` : 'Store base'}
              </button>
              <button
                className={`height-check__capture-btn${topCapturedDeg != null ? ' height-check__capture-btn--stored' : ''}`}
                onClick={captureTopAngle}
                type="button"
              >
                {topCapturedDeg != null ? `Recapture target (${topCapturedDeg.toFixed(2)}°)` : 'Store target'}
              </button>
              <button
                className="height-check__camera-calc-btn"
                onClick={doCalculate}
                type="button"
              >
                Calculate
              </button>
            </div>
          )}
        </div>

        <p className="height-check__live" aria-label="Live sensor readings">
          <span aria-label="Live pitch angle">{`Live pitch: ${livePitchDeg == null ? '—' : `${livePitchDeg.toFixed(2)}°`}`}</span>
          <span className="height-check__live-sep" aria-hidden="true" />
          <span aria-label="Live roll angle">{`Live roll: ${liveRollDeg == null ? '—' : `${liveRollDeg.toFixed(2)}°`}`}</span>
          {liveRollDeg != null && (
            <span className={`height-check__level-indicator${isLevelOk ? ' height-check__level-indicator--ok' : ''}`}>
              {isLevelOk ? 'Level' : 'Hold level'}
            </span>
          )}
        </p>

        <div className="height-check__capture-row">
          <button
            className={`height-check__btn${baseCapturedDeg != null ? ' height-check__btn--stored' : ''}`}
            onClick={captureBaseAngle}
            disabled={livePitchDeg == null}
            type="button"
          >
            Capture base angle
          </button>
          <span>{baseCapturedDeg == null ? '—' : `${baseCapturedDeg.toFixed(2)}°`}</span>
        </div>
        <div className="height-check__capture-row">
          <button
            className={`height-check__btn${topCapturedDeg != null ? ' height-check__btn--stored' : ''}`}
            onClick={captureTopAngle}
            disabled={livePitchDeg == null}
            type="button"
          >
            Capture top angle
          </button>
          <span>{topCapturedDeg == null ? '—' : `${topCapturedDeg.toFixed(2)}°`}</span>
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
              step="0.01"
              value={baseAngleInput}
              onChange={(event) => {
                setBaseAngleInput(event.target.value);
                setBaseCapturedDeg(null);
              }}
            />
          </label>
          <label htmlFor="top-angle-input">
            Top angle (°)
            <input
              id="top-angle-input"
              type="number"
              step="0.01"
              value={topAngleInput}
              onChange={(event) => {
                setTopAngleInput(event.target.value);
                setTopCapturedDeg(null);
              }}
            />
          </label>
        </div>
      </div>

      <div className="height-check__actions">
        <button className="height-check__btn height-check__reset-btn" onClick={resetAll} type="button">
          Reset
        </button>
        <button className="cta-btn height-check__calculate" onClick={doCalculate} type="button">
          Calculate height
        </button>
        <button
          className="height-check__btn height-check__help-btn"
          onClick={() => setShowMathBreakdown(prev => !prev)}
          type="button"
          aria-label="Toggle formula breakdown"
          title="Show / hide formula breakdown"
        >
          ?
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
                <li>Base angle: {(baseCapturedDeg ?? Number(baseAngleInput)).toFixed(2)}°</li>
                <li>Top angle: {(topCapturedDeg ?? Number(topAngleInput)).toFixed(2)}°</li>
                <li>Angle separation: {(measurement.angleSeparationDeg ?? 0).toFixed(2)}°</li>
                <li>Capture mode: {baseCapturedDeg != null && topCapturedDeg != null ? 'Device angle capture' : 'Manual angle entry'}</li>
              </ul>

              {measurement.ladderLengthMeters != null && measurement.ladderBaseDistanceMeters != null && (
                <div className="height-check__ladder">
                  <p className="height-check__ladder-label">Ladder safe use (1-in-4 rule)</p>
                  <ul className="height-check__result-list">
                    <li>Ladder length: {measurement.ladderLengthMeters.toFixed(2)} m</li>
                    <li>Distance from wall: {measurement.ladderBaseDistanceMeters.toFixed(2)} m</li>
                  </ul>
                </div>
              )}
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

      {showMathBreakdown && (
        <div className="height-check__panel">
          <h3>Formula breakdown</h3>
          {mathBreakdown != null ? (
            <pre className="height-check__math">{mathBreakdown}</pre>
          ) : (
            <p className="height-check__muted">Press Calculate to generate the formula breakdown.</p>
          )}
        </div>
      )}
    </div>
  );
}
