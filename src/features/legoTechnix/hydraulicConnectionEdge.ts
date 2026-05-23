import type { LegoTechnixDomain } from './domains';
import type { LegoTechnixConnectionV1 } from './types';

/**
 * Domains that carry water as their physical medium.
 * Only these domains require pipe-geometry assumptions (bore, length) and
 * contribute water volume to hydraulic system totals.
 */
const WATER_CARRYING_DOMAINS: ReadonlySet<LegoTechnixDomain> = new Set<LegoTechnixDomain>([
  'primary_heating',
  'domestic_cold',
  'domestic_hot',
  'tank_fed_domestic',
  'safety_discharge',
  'solar_thermal',
]);

/**
 * Returns true when the domain carries water as its physical medium.
 * Non-hydraulic domains (room_air, electric_control, gas, etc.) return false.
 */
export function isWaterCarryingDomain(domain: LegoTechnixDomain): boolean {
  return WATER_CARRYING_DOMAINS.has(domain);
}

/**
 * Derive pipe water volume in litres from pipe geometry.
 *
 * Formula: V = π × (ID/2)² × L
 *   where ID is the internal diameter in metres and L is the length in metres.
 * Result is converted to litres (×1000).
 *
 * @param lengthM           - Measured or estimated pipe run length in metres.
 * @param internalDiameterMm - Internal bore diameter in millimetres.
 * @returns Water volume in litres.
 */
export function deriveWaterVolumeLitres(lengthM: number, internalDiameterMm: number): number {
  const radiusM = (internalDiameterMm / 2) / 1000;
  return Math.PI * radiusM * radiusM * lengthM * 1000;
}

/**
 * Sum the declared water volume (litres) across all connections in a given domain.
 *
 * Only connections that:
 *   - match the specified domain, AND
 *   - have an explicit numeric `waterVolumeLitres` value
 * contribute to the total.  Connections with undefined water volume are skipped
 * (they are missing-assumption candidates, flagged by validation separately).
 *
 * This gives the pipe-circuit contribution to total hydraulic system volume,
 * which must then be added to vessel/component volumes for a full system total.
 *
 * @param connections - All connections in the graph.
 * @param domain      - The hydraulic domain to sum.
 * @returns Total edge water volume in litres.
 */
export function sumHydraulicDomainEdgeVolumes(
  connections: LegoTechnixConnectionV1[],
  domain: LegoTechnixDomain,
): number {
  let total = 0;
  for (const connection of connections) {
    if (
      connection.domain === domain
      && typeof connection.physical.waterVolumeLitres === 'number'
    ) {
      total += connection.physical.waterVolumeLitres;
    }
  }
  return total;
}
