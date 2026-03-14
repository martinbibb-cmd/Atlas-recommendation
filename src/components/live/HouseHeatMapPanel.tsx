/**
 * HouseHeatMapPanel
 *
 * Graphic 1 — House Heating Map.
 *
 * Displays room design temperatures (BS EN 12831 reference values) alongside
 * the fabric heat-loss band derived by the engine.  Together these demonstrate
 * that system sizing is intentional and physics-based, not a best guess.
 *
 * Design temperatures are fixed standards values; the heat-loss band comes
 * from FabricModelV1Result.
 */

import type { OutputHubSection } from '../../live/printSections.model';

interface RoomTemp {
  room: string;
  tempC: number;
}

const HEAT_LOSS_LABEL: Record<string, string> = {
  very_high: 'Very High',
  high:      'High',
  moderate:  'Moderate',
  low:       'Low',
  very_low:  'Very Low',
  unknown:   'Not assessed',
};

const HEAT_LOSS_TONE: Record<string, string> = {
  very_high: '#e53e3e',
  high:      '#dd6b20',
  moderate:  '#d69e2e',
  low:       '#38a169',
  very_low:  '#3182ce',
  unknown:   '#718096',
};

const THERMAL_MASS_LABEL: Record<string, string> = {
  light:   'Light — fast response',
  medium:  'Medium — balanced',
  heavy:   'Heavy — slow response',
  unknown: 'Not assessed',
};

interface Props {
  section: OutputHubSection;
}

export default function HouseHeatMapPanel({ section }: Props) {
  const c = section.content as {
    roomDesignTemps: RoomTemp[];
    heatLossBand:    string;
    thermalMassBand: string;
    driftTauHours:   number | null;
    notes:           string[];
  };

  const heatLossColour = HEAT_LOSS_TONE[c.heatLossBand] ?? HEAT_LOSS_TONE.unknown;

  return (
    <div className="hub-graphic hub-graphic--heatmap" aria-label="House heating map">
      <h3 className="hub-graphic__title">🏠 House Heating Map</h3>
      <p className="hub-graphic__intro">
        Design temperatures used for heat-loss calculation (BS EN 12831).
        Sizing is based on these comfort targets — not a rough guess.
      </p>

      {/* Room temperature table */}
      <div className="hub-heatmap__room-grid">
        {c.roomDesignTemps.map(rt => (
          <div key={rt.room} className="hub-heatmap__room-row">
            <span className="hub-heatmap__room-name">{rt.room}</span>
            <span className="hub-heatmap__room-bar-wrap">
              <span
                className="hub-heatmap__room-bar"
                style={{ width: `${((rt.tempC - 15) / 10) * 100}%` }}
                aria-hidden="true"
              />
            </span>
            <span className="hub-heatmap__room-temp">{rt.tempC}°C</span>
          </div>
        ))}
      </div>

      {/* Fabric heat-loss badge */}
      <div className="hub-heatmap__meta">
        <div className="hub-heatmap__badge" style={{ borderColor: heatLossColour, color: heatLossColour }}>
          <span className="hub-heatmap__badge-label">Heat loss</span>
          <span className="hub-heatmap__badge-value">{HEAT_LOSS_LABEL[c.heatLossBand] ?? '—'}</span>
        </div>
        <div className="hub-heatmap__badge hub-heatmap__badge--neutral">
          <span className="hub-heatmap__badge-label">Thermal mass</span>
          <span className="hub-heatmap__badge-value">{THERMAL_MASS_LABEL[c.thermalMassBand] ?? '—'}</span>
        </div>
        {c.driftTauHours != null && (
          <div className="hub-heatmap__badge hub-heatmap__badge--neutral">
            <span className="hub-heatmap__badge-label">Drift constant</span>
            <span className="hub-heatmap__badge-value">{c.driftTauHours.toFixed(1)} h</span>
          </div>
        )}
      </div>

      {c.notes.length > 0 && (
        <ul className="hub-graphic__notes" aria-label="Heat map notes">
          {c.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}
