import type {
  SurveySummaryInput,
  SummaryDataPack,
  HeatLossScheduleEntry,
  CommercialInsight,
  SurveyBomEntry,
} from '../schema/EngineInputV2_3';

// ─── Regional Silicate Detection ─────────────────────────────────────────────

// Postcode prefixes overlying high-silica geology where silicate-scaffolded
// scale is ~10× harder to remove than CaCO₃ alone.  Matches the
// HIGH_SILICA_PREFIXES set in RegionalHardness.ts.
// Key commercial hotspots: BH (Bournemouth) and DT (Dorset) – silica levels
// reach up to 364 ppm in these Jurassic chalk / limestone aquifer zones.
const HIGH_SILICA_PREFIXES = new Set([
  // Dorset Chalk / Jurassic limestone
  'BH', 'DT',
  // London Basin / Thames Estuary
  'E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC',
  'BR', 'CR', 'DA', 'EN', 'HA', 'IG', 'KT', 'RM', 'SM', 'TW', 'UB', 'WD',
  'SS', 'CM', 'CO',
]);

function getPostcodePrefix(postcode: string): string {
  return postcode.trim().toUpperCase().replace(/[0-9\s].*$/, '');
}

// ─── SPF Constants ────────────────────────────────────────────────────────────

// British Gas "Full Job": new oversized Type 22 radiators at 35°C flow → SPF ≈ 4.2
const FULL_JOB_FLOW_TEMP_C = 35;
const FULL_JOB_SPF = 4.2;

// Octopus "Fast Fit": existing radiators retained → 50°C flow → SPF ≈ 2.9
const FAST_FIT_FLOW_TEMP_C = 50;
const FAST_FIT_SPF = 2.9;

// Annual saving from choosing Full Job over Fast Fit (GBP/year)
const FULL_JOB_ANNUAL_SAVING_GBP = 180;

// Assumed heat pump system lifespan (years)
const SYSTEM_LIFESPAN_YEARS = 20;

// ─── BOM Constants ────────────────────────────────────────────────────────────

// Buffer tank: 15 L per kW of heat pump capacity (MCS MIS 3005)
const BUFFER_TANK_L_PER_KW = 15;

// Expansion vessel: 15% of primary circuit volume (BS 4814).
// Primary volume is estimated at 10 L per kW (≈ 1 radiator per kW × 10 L/rad).
const PRIMARY_VOLUME_L_PER_KW = 10;
const EXPANSION_VESSEL_FRACTION = 0.15;

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * SurveySummaryGenerator
 *
 * Aggregates engine results into a professional MCS-compliant design pack for
 * British Gas (Hive) and Worcester Bosch stakeholders.  Targets the MCS 003
 * Room-by-Room Schedule and the Technical Bill of Materials (BOM).
 *
 * Three commercial "closing" insights are produced:
 *  A. Silicate Tax  – flags BH/DT (and London Basin) high-silica geology.
 *  B. SPF Delta     – proves Full Job (35°C / SPF 4.2) vs Fast Fit (50°C / SPF 2.9).
 *  C. WB Softener Edge – triggers WB 8000+ warranty compatibility flag.
 */
export const generateSurveySummary = (input: SurveySummaryInput): SummaryDataPack => {
  // 1. MCS 003 Room-by-Room Heat Loss Schedule
  // Formula: Q_total = Σ(Area × U × ΔT) + 0.33 × n × V × ΔT  (BS EN 12831)
  const heatLossSchedule: HeatLossScheduleEntry[] = input.rooms.map(room => {
    const deltaT = room.targetTemp - input.outsideDesignTemp;
    const fabricLoss = room.surfaces.reduce(
      (acc, s) => acc + s.area * s.uValue * deltaT,
      0,
    );
    const ventilationLoss = 0.33 * room.airChangesPerHour * room.volume * deltaT;
    const totalWatts = Math.round(fabricLoss + ventilationLoss);
    return {
      roomName: room.name,
      designTemp: room.targetTemp,
      totalWatts,
      isCompliant: totalWatts <= room.emitterOutputWatts,
    };
  });

  // 2. Commercial "Technical Truth" Insights
  const postcodePrefix = getPostcodePrefix(input.postcode);
  const silicateTaxActive = HIGH_SILICA_PREFIXES.has(postcodePrefix);

  const commercialInsights: CommercialInsight[] = [];

  // A. Silicate Tax Table (Regional Calibration)
  if (silicateTaxActive) {
    commercialInsights.push({
      title: 'Local Geochemical Profile: Silicate Tax Active',
      detail:
        'Local geochemical profile detected: Silica-scaffolded scale is present. ' +
        'Standard chemical descalers may fail; Powerflush recommended.',
      status: 'warn',
    });
  } else {
    commercialInsights.push({
      title: 'Local Geochemical Profile',
      detail:
        `No silicate-scaffold risk detected for postcode ${postcodePrefix}. ` +
        'Standard inhibitor dosing applies.',
      status: 'pass',
    });
  }

  // B. SPF Efficiency Delta (Full Job vs Fast Fit)
  commercialInsights.push({
    title: 'SPF Efficiency: Full Job vs Fast Fit',
    detail:
      `Full Job (${FULL_JOB_FLOW_TEMP_C}°C flow): SPF ≈ ${FULL_JOB_SPF} vs ` +
      `Fast Fit (${FAST_FIT_FLOW_TEMP_C}°C flow): SPF ≈ ${FAST_FIT_SPF}. ` +
      `The BG Full Job installation saves £${FULL_JOB_ANNUAL_SAVING_GBP}/year more than ` +
      `a fast-fit retrofit over the ${SYSTEM_LIFESPAN_YEARS}-year lifespan of the heat pump.`,
    status: 'info',
  });

  // C. Worcester Bosch "Softener Edge" Warranty
  if (input.hasSoftener) {
    commercialInsights.push({
      title: 'WB 8000+ Softener Warranty: Compatible ✅',
      detail:
        'Worcester Bosch heat exchangers are uniquely compatible with salt-water softeners ' +
        'for DHW protection without voiding the warranty. ' +
        '⚠️ Vaillant: softened water on the DHW circuit is not permitted and would void the warranty.',
      status: 'pass',
    });
  } else {
    commercialInsights.push({
      title: 'WB 8000+ Softener Warranty',
      detail:
        'No softener fitted. Consider a dedicated DHW-side softener to unlock ' +
        'Worcester Bosch 8000+ warranty compatibility and clear the DHW scale penalty.',
      status: 'info',
    });
  }

  // 3. Technical Bill of Materials (BOM)
  const heatPumpKw = (input.heatLossWatts / 1000).toFixed(1);
  const primaryVolumeL = (input.heatLossWatts / 1000) * PRIMARY_VOLUME_L_PER_KW;
  const expansionVesselL = (primaryVolumeL * EXPANSION_VESSEL_FRACTION).toFixed(1);

  const bom: SurveyBomEntry[] = [
    {
      component: 'Air Source Heat Pump',
      detail: `${heatPumpKw}kW rated output (sized to design heat loss)`,
    },
    {
      component: 'Expansion Vessel',
      detail: `Min. ${expansionVesselL}L (BS 4814: 15% of ${primaryVolumeL.toFixed(0)}L estimated primary circuit volume)`,
    },
  ];

  if (input.requiresBufferVessel) {
    bom.push({
      component: 'Buffer Vessel',
      detail: `${Math.round(input.heatLossWatts / 1000 * BUFFER_TANK_L_PER_KW)}L (MCS MIS 3005: 15L/kW threshold)`,
    });
  }

  // 4. Maintenance ROI
  const flushPaybackYears = input.specEdge.flushPaybackYears;
  const paybackYears = flushPaybackYears != null ? flushPaybackYears.toFixed(1) : 'N/A';
  const annualCostGbp = (
    input.sludgeVsScale.primarySludgeCostGbp + input.sludgeVsScale.dhwScaleCostGbp
  ).toFixed(0);

  return {
    customerRef: input.postcode,
    totalHeatLoadKw: (input.heatLossWatts / 1000).toFixed(1),
    heatLossSchedule,
    commercialInsights,
    bom,
    maintenanceROI: {
      paybackYears,
      copy:
        flushPaybackYears != null
          ? `A professional HomeCare flush will pay for itself in ${paybackYears} years through efficiency restoration, saving £${annualCostGbp}/year in wasted energy.`
          : `Water quality cost of inaction: £${annualCostGbp}/year in wasted energy. A professional flush is recommended.`,
    },
  };
};
