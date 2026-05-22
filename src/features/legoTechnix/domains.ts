export const LEGO_TECHNIX_DOMAINS = [
  'primary_heating',
  'domestic_cold',
  'domestic_hot',
  'tank_fed_domestic',
  'safety_discharge',
  'gas',
  'electric_control',
  'condensate',
  'solar_thermal',
  'room_air',
  'outside_environment',
] as const;

export type LegoTechnixDomain = (typeof LEGO_TECHNIX_DOMAINS)[number];
