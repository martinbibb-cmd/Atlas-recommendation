import { educationalAnimationRegistry } from './educationalAnimationRegistry';

const LEGACY_ANIMATION_ID_ALIASES: Record<string, string> = {
  'anim-pressure-volume': 'stored_hot_water_recovery',
  'anim-charge-shift': 'stored_hot_water_recovery',
  'anim-peak-demand-options': 'shower_overlap_reserve',
  'anim-overlap-flow-drop': 'water_main_bottleneck',
  'anim-bore-vs-flow': 'water_main_bottleneck',
  'anim-input-limit': 'water_main_bottleneck',
  'anim-steady-vs-burst-heat': 'warm_radiator_steady_heat',
  'anim-continuous-low-temp': 'warm_radiator_steady_heat',
  'anim-emitter-size-compare': 'warm_radiator_steady_heat',
  'anim-weather-response': 'weather_compensation_day',
  'anim-consistent-vs-overrides': 'weather_compensation_day',
  'anim-tundish-events': 'cylinder_safety_path',
};

export function resolveEducationalAnimationId(animationId: string): string | undefined {
  const normalized = animationId.trim();
  const resolved = LEGACY_ANIMATION_ID_ALIASES[normalized] ?? normalized;
  return educationalAnimationRegistry.some((entry) => entry.animationId === resolved) ? resolved : undefined;
}

export function getEducationalAnimationById(animationId: string) {
  const resolvedAnimationId = resolveEducationalAnimationId(animationId) ?? animationId;
  return educationalAnimationRegistry.find((entry) => entry.animationId === resolvedAnimationId);
}

export function getEducationalAnimationsByConceptId(conceptId: string) {
  return educationalAnimationRegistry.filter((entry) => entry.conceptIds.includes(conceptId));
}

export function getRegisteredEducationalAnimationIds(): string[] {
  return educationalAnimationRegistry.map((entry) => entry.animationId);
}
