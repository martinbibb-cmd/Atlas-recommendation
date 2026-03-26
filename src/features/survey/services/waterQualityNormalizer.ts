/**
 * waterQualityNormalizer.ts
 *
 * Maps the UI-level WaterQualityState into a canonical structured object
 * suitable for later binding into engine degradation / longevity modelling.
 *
 * This is a first-pass normalizer — the output shape is a plain object
 * (not wired into EngineInputV2_3 yet) so it can be inspected in dev output
 * before full engine wiring.
 */

import type { WaterQualityState } from './waterQualityTypes';

// ─── Canonical output shape ────────────────────────────────────────────────────

export type NormalisedServicesWaterQuality = {
  services: {
    waterQuality: {
      source: 'lookup' | 'user' | 'assumed' | 'unknown';
      hardnessBand: 'soft' | 'moderate' | 'hard' | 'very_hard' | 'unknown';
      hardnessPpm: number | null;
      limescaleRisk: 'low' | 'medium' | 'high' | 'unknown';
      silicateRisk: 'low' | 'medium' | 'high' | 'unknown';
    };
  };
};

// ─── Normalizer ───────────────────────────────────────────────────────────────

/**
 * Produce a canonical services water-quality object from raw WaterQualityState.
 *
 * - source='unknown' is preserved as-is (surveyor has not yet provided data)
 * - hardnessBand='unknown' indicates no measurement or lookup was possible
 * - Null hardnessPpm means the ppm level is not available
 */
export function normaliseWaterQuality(state: WaterQualityState): NormalisedServicesWaterQuality {
  return {
    services: {
      waterQuality: {
        source: state.source,
        hardnessBand: state.hardnessBand,
        hardnessPpm: state.hardnessPpm,
        limescaleRisk: state.limescaleRisk,
        silicateRisk: state.silicateRisk,
      },
    },
  };
}
