/**
 * Educational explainer content.
 *
 * Six short, terminology-compliant topics that give users the physics
 * background needed to understand Atlas recommendations.
 *
 * Language rules (docs/atlas-terminology.md §8):
 *   - "on-demand hot water" (not "instantaneous hot water")
 *   - "stored hot water" (not "unlimited hot water")
 *   - "tank-fed supply" (not "gravity system" / "low pressure system")
 *   - "mains-fed supply" (not "high pressure system")
 *   - "thermal capacity / recovery time" (not "high performance")
 */

import type { EducationalExplainer } from './types';

export const EDUCATIONAL_EXPLAINERS: readonly EducationalExplainer[] = [
  {
    id: 'on_demand_vs_stored',
    title: 'On-demand vs stored hot water',
    point:
      'On-demand hot water heats water as you draw it; stored hot water pre-heats and holds a reserve in a cylinder.',
    bullets: [
      'On-demand (combi boiler) has no cylinder — output is limited by the heat exchanger plate area, typically 10–15 L/min.',
      'Stored systems can supply multiple outlets simultaneously up to the stored volume before recovery is needed.',
      'On-demand systems have no standing losses; stored systems lose heat from the cylinder continuously, even when idle.',
      'Recovery time — how quickly a cylinder reheats after draw-off — limits back-to-back demand for stored systems.',
      'Right-sizing stored volume to occupancy avoids both under-supply and excessive standing losses.',
    ],
    simulatorPanelId: 'draw_off',
    simulatorLabel: 'Draw-Off panel',
  },

  {
    id: 'pressure_vs_flow',
    title: 'Pressure and flow rate',
    point:
      'Pressure drives water into the system; flow rate is how much water actually moves — the two are related but not the same.',
    bullets: [
      'Mains supply pressure is typically 1–3 bar; flow rate at the outlet (L/min) depends on pipe diameter and fittings resistance.',
      'A high mains pressure can still deliver low flow if pipework is undersized or partially obstructed.',
      'Thermostatic mixer valves (TMVs) blend hot and cold to a safe temperature, which can reduce the net flow rate at the outlet.',
      'Tank-fed supply relies on gravity head from the cold water storage tank — typically much lower pressure than mains-fed supply.',
      'Shower performance depends on flow rate at the head, not inlet pressure alone.',
    ],
    simulatorPanelId: 'draw_off',
    simulatorLabel: 'Draw-Off panel',
  },

  {
    id: 'multiple_taps',
    title: 'Why simultaneous outlets matter',
    point:
      'When two outlets draw hot water at the same time, combined demand can exceed what a single on-demand source can supply.',
    bullets: [
      'A combi boiler delivers ~10–15 L/min total; two simultaneous showers can demand 16–20 L/min.',
      'With a stored cylinder, simultaneous draw pulls from the reserve volume — individual outlet flow is maintained until the cylinder is depleted.',
      'Peak concurrent outlet count is the key variable in DHW system sizing, not average daily use alone.',
      'Bath fills are short peak events; simultaneous showers are sustained — these are different demand profiles and must be assessed separately.',
      'Households with two or more bathrooms face a higher simultaneous-demand risk from a single on-demand source.',
    ],
    simulatorPanelId: 'draw_off',
    simulatorLabel: 'Draw-Off panel',
  },

  {
    id: 'cycling_efficiency',
    title: 'Why boiler cycling hurts efficiency',
    point:
      'A boiler that fires, reaches its set point quickly, and switches off — then repeats — wastes energy in repeated warm-up losses.',
    bullets: [
      'Each ignition event must heat the heat exchanger from ambient to operating temperature before useful heat reaches the system.',
      'Short cycling happens when the boiler is oversized relative to the actual heat loss of the building.',
      'A correctly sized boiler runs in longer, fewer bursts — more efficient than many short bursts at the same total output.',
      'Modulating burners reduce cycling by turning down the firing rate to match lower loads rather than switching fully on and off.',
      'Cycling frequency is a key indicator of oversizing — it is visible in the Efficiency panel of the simulator.',
    ],
    simulatorPanelId: 'efficiency',
    simulatorLabel: 'Efficiency panel',
  },

  {
    id: 'condensing_return_temp',
    title: 'Why condensing mode needs a low return temperature',
    point:
      'A condensing boiler only recovers latent heat — its efficiency advantage — when the return water temperature stays below roughly 55 °C.',
    bullets: [
      'Below 55 °C return temperature, water vapour in the flue gases condenses, releasing latent heat back into the system.',
      'High flow temperatures (70–80 °C) push return temperatures above 55 °C and suppress condensing mode.',
      'Lowering flow temperature to 55–60 °C allows more condensing operation and improves seasonal efficiency.',
      'Undersized radiators force higher flow temperatures to reach the same room temperature, which defeats condensing mode.',
      'Weather compensation — reducing flow temperature on mild days — maximises the time spent in condensing mode.',
    ],
    simulatorPanelId: 'efficiency',
    simulatorLabel: 'Efficiency panel',
  },

  {
    id: 'heat_pump_flow_temp',
    title: 'Why heat pumps prefer low flow temperatures',
    point:
      'Heat pump efficiency (Coefficient of Performance, COP) rises sharply as the target flow temperature falls.',
    bullets: [
      'Moving heat from 5 °C outside air to a 35 °C flow temperature can yield COP 3–4; raising the target to 55 °C can drop COP below 2.',
      'Underfloor heating typically runs at 35–45 °C — well-matched to heat pump operating ranges.',
      'Oversized radiators can also run at low flow temperatures, making them compatible with heat pump operation.',
      'Domestic hot water must reach 60 °C periodically for Legionella control — this high-temperature lift reduces COP for that circuit.',
      'Every 1 °C rise in flow temperature costs roughly 2–3 % in COP for an air-source heat pump.',
    ],
    simulatorPanelId: 'efficiency',
    simulatorLabel: 'Efficiency panel',
  },
] as const;
