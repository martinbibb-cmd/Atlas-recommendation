import type {
  EngineInputV2_3,
  BomItem,
  HydraulicResult,
  RedFlagResult,
} from '../schema/EngineInputV2_3';
import { applyWholesalerPricing } from './WholesalerPricingAdapter';

// Standard UK estimate: ~10 litres of system water per radiator
const RADIATOR_VOLUME_L_PER_RAD = 10;

// ASHP minimum system volume to prevent short cycling; industry threshold ≈ 6 L/kW.
// When radiator count is unknown, the proxy volume equals this threshold – meaning
// the buffer condition is not triggered (safe fallback: assume sufficient volume).
const ASHP_MIN_VOLUME_L_PER_KW = 6;

// Buffer tank sizing: 15 L/kW of heat loss when system volume is below ASHP threshold.
const BUFFER_TANK_L_PER_KW = 15;

// CWS loft tank: 90 litres per person (hostel standard, BS 6700)
const CWS_HOSTEL_STANDARD_L_PER_PERSON = 90;

export function generateBom(
  input: EngineInputV2_3,
  hydraulic: HydraulicResult,
  redFlags: RedFlagResult,
  includePricing: boolean = true,
): BomItem[] {
  const items: BomItem[] = [];

  // Cylinder sizing: 45L per person, minimum 150L
  const estimatedOccupants = input.bathroomCount * 2 + 1;
  const cylinderSizeL = Math.max(150, estimatedOccupants * 45);

  if (!redFlags.rejectCombi && input.preferCombi) {
    // Combi route
    const combiKw = Math.ceil(input.heatLossWatts / 1000 / 5) * 5;
    items.push({
      name: 'Combination Boiler',
      model: `Worcester Bosch Greenstar ${combiKw}i`,
      quantity: 1,
      notes: `${combiKw}kW output for ${(input.heatLossWatts / 1000).toFixed(1)}kW heat loss`,
    });
  } else {
    // System boiler + cylinder route
    const systemKw = Math.ceil(input.heatLossWatts / 1000 / 5) * 5;
    items.push({
      name: 'System Boiler',
      model: `Worcester Bosch Greenstar ${systemKw}i System`,
      quantity: 1,
      notes: `${systemKw}kW output`,
    });

    items.push({
      name: 'Hot Water Cylinder (Mixergy)',
      model: `Mixergy MX-${cylinderSizeL}-IND`,
      quantity: 1,
      notes: `${cylinderSizeL}L Mixergy smart cylinder (equivalent to ${Math.round(cylinderSizeL * 1.4)}L conventional)`,
    });

    // CWS loft tank for vented systems: 90 litres per person (hostel standard).
    // Only applicable when loft space is available (no loft conversion).
    if (!input.hasLoftConversion) {
      const cwsVolumeL = estimatedOccupants * CWS_HOSTEL_STANDARD_L_PER_PERSON;
      items.push({
        name: 'CWS Loft Tank',
        model: `Tricel Titan Cold Water Storage ${cwsVolumeL}L`,
        quantity: 1,
        notes: `${cwsVolumeL}L (${estimatedOccupants} occupants × ${CWS_HOSTEL_STANDARD_L_PER_PERSON} L/person – hostel standard)`,
      });
    }
  }

  // Pipework upgrade if hydraulic bottleneck
  if (hydraulic.isBottleneck || hydraulic.ashpRequires28mm) {
    items.push({
      name: 'Primary Pipework Upgrade',
      model: '28mm Copper Pipe (per metre)',
      quantity: 10,
      notes: 'Upgrade from 22mm to 28mm primary pipework to resolve hydraulic bottleneck',
    });
  }

  // Scale inhibitor for hard water
  items.push({
    name: 'Magnetic System Filter',
    model: 'Fernox TF1 Compact',
    quantity: 1,
    notes: 'Essential for all installations – removes magnetite and prevents sludge buildup',
  });

  items.push({
    name: 'Scale Inhibitor Dosing Unit',
    model: 'Fernox DS3 Scale Inhibitor',
    quantity: 1,
    notes: 'Annual dosing recommended; critical in hard water areas to prevent Silicate Tax decay',
  });

  // Buffer tank for ASHP: mandatory at 15 L/kW if system volume is below ASHP threshold.
  const heatLossKw = input.heatLossWatts / 1000;
  const systemVolumeL = input.radiatorCount > 0
    ? input.radiatorCount * RADIATOR_VOLUME_L_PER_RAD
    : heatLossKw * ASHP_MIN_VOLUME_L_PER_KW;
  if (redFlags.flagAshp && !redFlags.rejectCombi && systemVolumeL < heatLossKw * ASHP_MIN_VOLUME_L_PER_KW) {
    const bufferVolumeL = Math.round(heatLossKw * BUFFER_TANK_L_PER_KW);
    items.push({
      name: 'Buffer Vessel',
      model: `Gledhill Buffer Vessel ${bufferVolumeL}L`,
      quantity: 1,
      notes: `${bufferVolumeL}L buffer (${BUFFER_TANK_L_PER_KW} L/kW) – mandatory: system volume ${systemVolumeL}L is below ${Math.round(heatLossKw * ASHP_MIN_VOLUME_L_PER_KW)}L ASHP minimum threshold`,
    });
  }

  return includePricing ? applyWholesalerPricing(items) : items;
}
