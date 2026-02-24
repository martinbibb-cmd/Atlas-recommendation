import type { AssumptionId } from '../contracts/assumptions.ids';

export const ASSUMPTION_CATALOG: Record<AssumptionId, {
  title: string;
  detail: string;
  improveBy?: string;
}> = {
  'boiler.gc_missing': {
    title: 'GC number not provided',
    detail: 'Boiler efficiency is estimated from manufacturer band defaults, not a direct SEDBUK database lookup.',
    improveBy: 'Add the GC number from the boiler data plate.',
  },
  'boiler.gc_invalid': {
    title: 'GC number not recognised',
    detail: 'The GC number provided could not be matched in the SEDBUK database. Manufacturer band defaults are used instead.',
    improveBy: 'Check the GC number on the boiler data plate and re-enter it.',
  },
  'boiler.age_missing': {
    title: 'Boiler age not provided',
    detail: 'Age-related efficiency degradation has been estimated using a typical mid-range age band.',
    improveBy: 'Enter the boiler installation year or approximate age.',
  },
  'boiler.nominal_output_defaulted': {
    title: 'Boiler nominal output not provided',
    detail: 'A type-default output (24 kW for combi, 18 kW for system/regular) has been assumed for sizing calculations.',
    improveBy: 'Enter the rated kW output from the boiler data plate or manual.',
  },
  'boiler.peak_heatloss_missing': {
    title: 'Peak heat loss not provided',
    detail: 'The oversize ratio between boiler output and building demand cannot be calculated. Cycling loss modelling is weaker without this.',
    improveBy: 'Run a heat loss calculation or enter the estimated peak demand in kW.',
  },
  'water.flow_missing': {
    title: 'Flow-at-pressure measurement missing',
    detail: 'Cold-water supply quality is unknown without a dynamic flow measurement (L/min at pressure). Combi and unvented eligibility relies on modelled estimates.',
    improveBy: 'Measure mains flow rate at the stopcock (L/min) using a flow bag.',
  },
  'water.static_missing': {
    title: 'Static mains pressure not measured',
    detail: 'Pressure drop between static and dynamic conditions cannot be determined. Supply quality classification is based on dynamic pressure alone.',
    improveBy: 'Measure static pressure at the stopcock with flow closed off.',
  },
  'timeline.default_dhw_schedule': {
    title: 'Default daily hot-water schedule used',
    detail: 'Hot-water events (morning shower, evening bath) follow a typical UK household day. Dishwasher and washing machine are modelled as cold-mains flow events — not thermal loads. Your actual pattern may differ.',
    improveBy: 'Paint your actual daily schedule to improve timeline accuracy.',
  },
  'timeline.tau_slider_derived': {
    title: 'Thermal response (τ) inferred from building mass',
    detail: 'The thermal time constant is estimated from your selected building mass rather than measured from real thermostat telemetry.',
    improveBy: 'Connect Hive telemetry to derive τ from measured temperature decay.',
  },
  'general.modelled_estimate': {
    title: 'Modelled estimate',
    detail: 'This value is derived from a physical model rather than a direct measurement.',
  },
};
