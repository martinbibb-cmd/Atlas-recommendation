import type { HydraulicRuleCategory } from './types';

export interface CanonicalHydraulicRule {
  id: string;
  category: HydraulicRuleCategory;
  rule: string;
}

export const CANONICAL_HYDRAULIC_RULES: readonly CanonicalHydraulicRule[] = [
  { id: 'placement:pipes-reach-ports', category: 'component_placement', rule: 'Pipe routes must terminate at explicit component ports with hydraulic intent.' },
  { id: 'flow:return-distinct', category: 'flow_return', rule: 'Flow and return paths must remain visually distinct and traceable.' },
  { id: 'openvent:close-coupled', category: 'close_coupling', rule: 'Open vent and cold feed tees are close coupled and must not be decoratively separated.' },
  { id: 'sealed:pressure-circuit', category: 'pressure', rule: 'Expansion vessel, gauge, and filling loop belong to the sealed primary circuit.' },
  { id: 'stratification:matrix', category: 'stratification', rule: 'Standard vented/unvented cylinders are uniform warm; Mixergy requires a sharp thermocline; thermal stores are primary-water thermal mass.' },
  { id: 'waterpaths:separation', category: 'potable_primary_separation', rule: 'Potable and primary paths must remain permanently separate and never merge visually.' },
  { id: 'g3:discharge-routing', category: 'g3_safety_routing', rule: 'Unvented safety discharge must show D1 to tundish, visible air gap, then larger D2 with continuous fall.' },
  { id: 'pump:inline', category: 'pump_placement', rule: 'Circulators must be visibly inline and positioned for hydraulic function, not symmetry.' },
  { id: 'abv:bridge-position', category: 'abv_placement', rule: 'ABV bridges flow/return after pump and before restrictions/zone valves.' },
  { id: 'magfilter:return-before-boiler', category: 'magnetic_filter_placement', rule: 'Magnetic filter sits on primary return as final component before boiler and includes service logic.' },
  { id: 'fillingloop:disconnected-default', category: 'filling_loop', rule: 'Filling loop must default to temporary/disconnected visual state.' },
] as const;
