/**
 * Educational explainer content.
 *
 * Twelve short, terminology-compliant topics that give users the physics
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

  {
    id: 'standard_vs_mixergy',
    title: 'Standard cylinder vs Mixergy',
    point:
      'A standard cylinder heats the entire volume uniformly; a Mixergy cylinder heats from the top down, delivering usable stored hot water sooner and reducing cycling.',
    bullets: [
      'Standard cylinders heat the full volume before any draw-off is at the target temperature — this delays availability after a reheat cycle.',
      'Mixergy uses active stratification to keep the hottest water at the top, so usable hot water is available even when the cylinder is partially charged.',
      'Reduced cycling means fewer boiler or heat-pump start-stop events, improving seasonal efficiency and component longevity.',
      'Top-down heating is especially beneficial with heat pumps, where each reheat cycle carries a higher COP penalty due to the required temperature lift.',
      'For time-of-use tariffs, partial charging during off-peak periods is more practical with stratified storage than with a uniformly heated cylinder.',
    ],
    simulatorPanelId: 'draw_off',
    simulatorLabel: 'Draw-Off panel',
  },

  {
    id: 'cylinder_age_condition',
    title: 'Why cylinder age and condition matter',
    point:
      'An older or poorly maintained cylinder loses more heat while idle and transfers heat less effectively through its coil — both reduce overall system efficiency.',
    bullets: [
      'Standing heat loss increases as factory-applied insulation degrades over time; a cylinder over 15 years old can lose 50 % more heat per day than a modern equivalent.',
      'Limescale build-up on the internal coil surface reduces heat transfer, forcing longer reheat times and higher return temperatures.',
      'Poor coil transfer performance can suppress condensing operation in a boiler by raising the return temperature above the 55 °C threshold.',
      'Cylinder condition directly affects the recommendation rationale: a cylinder in poor condition may justify replacement even if the heating system is unchanged.',
      'Recording age and condition enables Atlas to quantify standing-loss and coil-transfer effects rather than relying on generic assumptions.',
    ],
    simulatorPanelId: 'draw_off',
    simulatorLabel: 'Draw-Off panel',
  },

  {
    id: 'pipe_capacity',
    title: 'Why primary pipe size limits heat pump output',
    point:
      'A heat pump moves the same heating energy as a boiler using significantly lower temperature water, which means it needs to circulate a significantly higher flow rate through the primary circuit.',
    bullets: [
      'A boiler operates at a flow-to-return temperature difference (ΔT) of around 20 °C; a heat pump typically works at ΔT 5 °C — requiring roughly 4× the flow rate for the same heat output.',
      'A 22 mm primary pipe can typically carry around 14–18 L/min; a heat pump may require 20–30 L/min at design load for the same property.',
      'Exceeding the pipe capacity raises water velocity, increasing erosion noise, pressure drop, and flow restriction.',
      'Upsizing to 28 mm primary pipework is the standard prerequisite for most heat pump installations in existing UK housing stock.',
      'Pipe capacity is a physical gate — it cannot be compensated by a more powerful heat pump or better controls.',
    ],
    simulatorPanelId: 'efficiency',
    simulatorLabel: 'Efficiency panel',
  },

  {
    id: 'water_quality_scale',
    title: 'How water hardness affects heating system life',
    point:
      'Hard water deposits calcium and magnesium scale inside heat exchangers and pipework, gradually reducing heat transfer efficiency and shortening appliance life.',
    bullets: [
      'Scale builds up on boiler heat exchanger surfaces, pipe walls, and DHW cylinder coils wherever water is heated above 55–65 °C.',
      'A 1 mm scale deposit can reduce heat exchanger efficiency by roughly 7–8 %, forcing the boiler to fire longer to achieve the same output.',
      'Combi boiler plate heat exchangers are particularly susceptible — scale restricts both flow rate and thermal transfer.',
      'A scale inhibitor dosing unit or whole-house water softener are the standard long-term protections in hard-water areas.',
      'System inhibitor in the sealed heating circuit addresses corrosion and sludge, but does not protect against scale from domestic cold water.',
    ],
    simulatorPanelId: 'efficiency',
    simulatorLabel: 'Efficiency panel',
  },

  {
    id: 'thermal_mass_inertia',
    title: 'How building mass shapes your heating strategy',
    point:
      'Heavy-mass buildings absorb and release heat slowly — this thermal inertia affects how quickly a room responds to heating and how long warmth is retained after the boiler switches off.',
    bullets: [
      'Solid stone, brick, or concrete walls store large amounts of heat energy; lightweight timber-frame or cavity-wall construction stores far less.',
      'A heavy-mass building responds slowly to heating — it takes longer to warm up, but also holds warmth for extended periods after the heat source stops.',
      'Continuous or long-pre-heat schedules suit heavy-mass buildings better than short on/off cycles, which barely penetrate the thermal store.',
      'Short cycling in a heavy-mass home wastes energy on repeated warm-up of the heat exchanger without delivering useful heat to the space.',
      'Thermal mass is independent of insulation — a well-insulated solid-wall building still has high inertia; a poorly insulated timber-frame building has low inertia.',
    ],
    simulatorPanelId: 'efficiency',
    simulatorLabel: 'Efficiency panel',
  },

  {
    id: 'splan_vs_yplan',
    title: 'S-plan vs Y-plan zone control',
    point:
      'S-plan and Y-plan describe how a system boiler controls the flow of hot water between the heating circuit and the domestic hot water cylinder.',
    bullets: [
      'Y-plan uses a single mid-position valve that can supply heating only, hot water only, or both simultaneously — a common and cost-effective arrangement.',
      'S-plan uses two separate 2-port zone valves, one for heating and one for hot water — giving fully independent control of each circuit.',
      "S-plan's independent control allows the boiler to serve heating and hot water at different times and temperatures, which reduces unnecessary cycling.",
      'With Y-plan, a simultaneous call for both heat and hot water can force the boiler to compromise between the two demands.',
      'S-plan is generally preferred for larger properties or higher-efficiency systems where independent circuit control has a measurable impact on running costs.',
    ],
    simulatorPanelId: 'efficiency',
    simulatorLabel: 'Efficiency panel',
  },
] as const;
