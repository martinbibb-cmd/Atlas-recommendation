/**
 * HydraulicVelocityBar
 *
 * A horizontal bar showing hydraulic velocity in three colour-coded zones:
 *   Safe (0–1.5 m/s) · Caution (1.5–2.0 m/s) · Erosion risk (>2.0 m/s)
 *
 * An arrow marker shows the actual velocity so engineers and homeowners can
 * see at a glance whether the current pipe is in the safe zone.
 */

interface Props {
  /** Current pipe velocity in m/s */
  velocityMs: number;
}

/** Visual scale: bar represents 0 → MAX_DISPLAY_MS m/s */
const MAX_DISPLAY_MS = 3.0;
const SAFE_LIMIT_MS = 1.5;
const CAUTION_LIMIT_MS = 2.0;

export default function HydraulicVelocityBar({ velocityMs }: Props) {
  // Clamp display position so the marker never overflows
  const displayVelocity = Math.min(velocityMs, MAX_DISPLAY_MS);
  const markerPct = (displayVelocity / MAX_DISPLAY_MS) * 100;

  const safeWidthPct   = (SAFE_LIMIT_MS   / MAX_DISPLAY_MS) * 100;   // 50 %
  const cautionWidthPct = ((CAUTION_LIMIT_MS - SAFE_LIMIT_MS) / MAX_DISPLAY_MS) * 100; // ~16.67 %
  const erosionWidthPct = 100 - safeWidthPct - cautionWidthPct;       // ~33.3 %

  const isOverSafe    = velocityMs > SAFE_LIMIT_MS;
  const isOverCaution = velocityMs > CAUTION_LIMIT_MS;

  const zone = isOverCaution ? 'erosion' : isOverSafe ? 'caution' : 'safe';
  const zoneLabel = zone === 'safe' ? '✅ Safe Zone' : zone === 'caution' ? '⚠️ Caution Zone' : '🔴 Erosion Risk';
  const zoneColor = zone === 'safe' ? '#276749' : zone === 'caution' ? '#c05621' : '#e53e3e';

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Zone labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#718096', marginBottom: 2 }}>
        <span>Safe Zone</span>
        <span>Caution</span>
        <span>Erosion</span>
      </div>

      {/* Colour-coded bar */}
      <div style={{ position: 'relative', height: 14, borderRadius: 4, overflow: 'visible', display: 'flex' }}>
        {/* Safe zone */}
        <div style={{ width: `${safeWidthPct}%`, background: '#c6f6d5', borderRadius: '4px 0 0 4px' }} />
        {/* Caution zone */}
        <div style={{ width: `${cautionWidthPct}%`, background: '#fefcbf' }} />
        {/* Erosion zone */}
        <div style={{ width: `${erosionWidthPct}%`, background: '#fed7d7', borderRadius: '0 4px 4px 0' }} />

        {/* Velocity marker */}
        <div
          aria-label={`Current velocity: ${velocityMs.toFixed(2)} m/s`}
          style={{
            position: 'absolute',
            left: `${markerPct}%`,
            top: -3,
            transform: 'translateX(-50%)',
            width: 3,
            height: 20,
            background: zoneColor,
            borderRadius: 2,
          }}
        />
      </div>

      {/* Tick labels */}
      <div style={{ position: 'relative', height: 14, fontSize: '0.65rem', color: '#718096' }}>
        <span style={{ position: 'absolute', left: `${safeWidthPct}%`, transform: 'translateX(-50%)' }}>
          {SAFE_LIMIT_MS} m/s
        </span>
        <span style={{ position: 'absolute', left: `${safeWidthPct + cautionWidthPct}%`, transform: 'translateX(-50%)' }}>
          {CAUTION_LIMIT_MS} m/s
        </span>
        <span style={{ position: 'absolute', right: 0 }}>
          {MAX_DISPLAY_MS} m/s
        </span>
      </div>

      {/* Current value callout */}
      <div style={{ marginTop: 4, fontSize: '0.78rem', color: zoneColor, fontWeight: 600 }}>
        ▲ {velocityMs.toFixed(2)} m/s — {zoneLabel}
      </div>
    </div>
  );
}
