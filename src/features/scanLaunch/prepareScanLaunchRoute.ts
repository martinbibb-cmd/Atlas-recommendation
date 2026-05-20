import type { ScanLaunchPayloadV1 } from './ScanLaunchPayloadV1';

export interface ScanLaunchRouteV1 {
  readonly route: string;
  readonly encodedPayload: string;
  readonly deepLink: string;
}

export interface PrepareScanLaunchRouteOptions {
  /** Atlas Scan route segment after the scheme, defaults to "visit-launch". */
  readonly route?: string;
}

export function prepareScanLaunchRoute(
  payload: ScanLaunchPayloadV1,
  options: PrepareScanLaunchRouteOptions = {},
): ScanLaunchRouteV1 {
  const route = options.route ?? 'visit-launch';
  const encodedPayload = encodeURIComponent(JSON.stringify(payload));
  return {
    route,
    encodedPayload,
    deepLink: `atlas-scan://${route}?payload=${encodedPayload}`,
  };
}
