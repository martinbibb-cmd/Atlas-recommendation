/**
 * RecoveryStepsPanel
 *
 * Contextual recovery-step list for the performance band ladder.
 * Always shows the four core maintenance / upgrade steps.
 *
 * Conditionally adds a HYDRAULICS step when:
 *   (systemAType === 'ashp' OR systemBType === 'ashp')
 *   AND (velocityPenalty > 0.1 OR ashpRisk !== 'pass')
 *
 * Props wire directly from HydraulicModuleV1Result so there is no
 * implicit coupling to the UI state.
 *
 * The "highlight" prop (from marker hover on the ladder) lightly
 * emphasises the step(s) most relevant to that marker.
 */

import type { HydraulicModuleV1Result } from '../engine/schema/EngineInputV2_3';
import { BASE_ASHP_COP } from '../engine/modules/HydraulicModule';

// ── Types ──────────────────────────────────────────────────────────────────────

export type SystemType = 'ashp' | 'gshp' | 'boiler' | 'stored_water' | 'on_demand' | string;

export interface RecoveryStepsPanelProps {
  systemAType?: SystemType;
  systemBType?: SystemType;
  hydraulic: HydraulicModuleV1Result;
  /** Marker key currently hovered on the band ladder (from onMarkerHover). */
  highlightedMarker?: string | null;
}

// ── Step definitions ──────────────────────────────────────────────────────────

interface Step {
  id: string;
  icon: string;
  title: string;
  body: string;
  /** Marker keys that should highlight this step. */
  linkedMarkers: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true when the hydraulics step should be shown.
 * Gate: one side is ASHP AND (velocity penalty meaningful OR ashpRisk not passing).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function shouldShowHydraulics(
  systemAType: SystemType | undefined,
  systemBType: SystemType | undefined,
  hydraulic: HydraulicModuleV1Result,
): boolean {
  const eitherIsAshp =
    systemAType === 'ashp' || systemBType === 'ashp' ||
    systemAType === 'gshp' || systemBType === 'gshp';

  if (!eitherIsAshp) return false;

  return (
    hydraulic.velocityPenalty > 0.1 ||
    hydraulic.verdict.ashpRisk !== 'pass'
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RecoveryStepsPanel({
  systemAType,
  systemBType,
  hydraulic,
  highlightedMarker,
}: RecoveryStepsPanelProps) {

  const showHydraulics = shouldShowHydraulics(systemAType, systemBType, hydraulic);

  const coreSteps: Step[] = [
    {
      id: 'annual_service',
      icon: '🔍',
      title: 'Annual service',
      body: 'A gas-safe combustion check keeps the appliance running safely and maintains the manufacturer warranty. This is not a circuit clean — it addresses the burner, heat exchanger, and controls.',
      linkedMarkers: [],
    },
    {
      id: 'clean_protect',
      icon: '🧲',
      title: 'Clean & protect on replacement',
      body: 'Power-flush, full inhibitor dose, and inline magnetic filter. Removes accumulated magnetite and scale that reduce flow, increase ΔT, and force the boiler to cycle more aggressively.',
      linkedMarkers: ['current', 'restored'],
    },
    {
      id: 'controls',
      icon: '🎛️',
      title: 'Controls that reduce cycling',
      body: 'Load compensation or weather compensation slows unnecessary on/off cycling, which accounts for a significant share of in-service efficiency loss in residential systems.',
      linkedMarkers: ['current'],
    },
    {
      id: 'new_plant',
      icon: '🏭',
      title: 'New plant baseline',
      body: 'A current-standard condensing boiler enters service at or above 92 % SEDBUK seasonal — the band A/B threshold. This alone closes the gap between the "likely current" and "new baseline" markers.',
      linkedMarkers: ['new_baseline', 'as_manufactured'],
    },
  ];

  const hydraulicsStep: Step = {
    id: 'hydraulics',
    icon: '💧',
    title: 'Primary circuit: design-flow compliance',
    body: buildHydraulicsBody(hydraulic),
    linkedMarkers: ['current'],
  };

  const steps = showHydraulics ? [...coreSteps, hydraulicsStep] : coreSteps;

  return (
    <div>
      {steps.map(step => {
        const isHighlighted =
          highlightedMarker != null &&
          step.linkedMarkers.includes(highlightedMarker);
        return (
          <div
            key={step.id}
            style={{
              marginBottom: 10,
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${isHighlighted ? '#3182ce' : '#e2e8f0'}`,
              background: isHighlighted ? '#ebf8ff' : '#f7fafc',
              transition: 'border-color 0.2s, background 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: '1rem', lineHeight: 1.4, flexShrink: 0 }}>
                {step.icon}
              </span>
              <div>
                <div style={{
                  fontSize: '0.82rem', fontWeight: 700,
                  color: '#2d3748', marginBottom: 3,
                }}>
                  {step.title}
                  {step.id === 'hydraulics' && (
                    <span style={{
                      marginLeft: 6, fontSize: '0.68rem',
                      background: '#bee3f8', color: '#2c5282',
                      padding: '1px 5px', borderRadius: 4, fontWeight: 600,
                    }}>
                      Heat pump relevant
                    </span>
                  )}
                </div>
                <p style={{
                  fontSize: '0.78rem', color: '#4a5568',
                  margin: 0, lineHeight: 1.5,
                }}>
                  {step.body}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Hydraulics body builder ────────────────────────────────────────────────────

function buildHydraulicsBody(hydraulic: HydraulicModuleV1Result): string {
  const { velocityPenalty, effectiveCOP, verdict, ashp } = hydraulic;
  const velocityMs = ashp.velocityMs.toFixed(2);
  const risk = verdict.ashpRisk;

  if (risk === 'fail' || velocityPenalty > 0.3) {
    const copLoss = ((1 - effectiveCOP / BASE_ASHP_COP) * 100).toFixed(0);
    return (
      `Heat pumps need stable design flow. Your current primary circuit is operating above ` +
      `the recommended velocity band (${velocityMs} m/s), which reduces COP and can limit output. ` +
      `The velocity penalty is reducing seasonal performance by approximately ${copLoss}%. ` +
      `Upgrading primary to 28 mm (where required) restores compliant flow and stabilises COP.`
    );
  }

  if (risk === 'warn' || velocityPenalty > 0.1) {
    return (
      `Heat pumps operate most efficiently within the 0.8–1.5 m/s velocity band. ` +
      `Your circuit is currently at ${velocityMs} m/s — marginally above the recommended range. ` +
      `This results in a small COP reduction (effective COP: ${effectiveCOP.toFixed(1)}). ` +
      `Upgrading primary pipework to 28 mm would bring flow into compliance and reduce cycling.`
    );
  }

  // Fallback — ashpRisk !== 'pass' but velocity is low (capacity-limited)
  return (
    `The current primary circuit diameter may limit the ASHP flow capacity needed for ` +
    `stable low-temperature operation. A 28 mm primary (where accessible) provides the ` +
    `headroom for compliant ASHP flow rates without compromising velocity limits.`
  );
}
