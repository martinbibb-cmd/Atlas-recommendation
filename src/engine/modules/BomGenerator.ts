import type {
  EngineInputV2_3,
  BomItem,
  HydraulicResult,
  RedFlagResult,
} from '../schema/EngineInputV2_3';
import { applyWholesalerPricing } from './WholesalerPricingAdapter';

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

  // Buffer tank for ASHP
  if (redFlags.flagAshp && !redFlags.rejectCombi) {
    const bufferVolumeL = Math.max(50, Math.round(input.heatLossWatts / 200));
    items.push({
      name: 'Buffer Vessel',
      model: `Gledhill Buffer Vessel ${bufferVolumeL}L`,
      quantity: 1,
      notes: `${bufferVolumeL}L buffer to meet minimum system volume for ASHP operation`,
    });
  }

  return includePricing ? applyWholesalerPricing(items) : items;
}
