/**
 * EducationalAssetRenderer.tsx
 *
 * Bridge wrapper that renders any registered educational asset by its id.
 *
 * Consumers provide an assetId and a rendering mode. The component looks up
 * both the asset metadata (for accessibility/motion/print constraints) and
 * the mapped React component, then applies the appropriate guard:
 *
 *   digital        — render the component as-is (default interactive mode)
 *   reduced_motion — skip animation-only assets; show warning placeholder
 *   print          — skip animation-only assets that have no print equivalent
 *
 * A `fallback` prop overrides the built-in placeholder for any guarded case.
 *
 * This component does not redesign or rewrite any underlying visual.
 */

import type { ReactNode } from 'react';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import { educationalComponentRegistry } from '../registry/educationalComponentRegistry';

export type EducationalRenderMode = 'digital' | 'print' | 'reduced_motion';

export interface EducationalAssetRendererProps {
  /** Must match an `id` in educationalAssetRegistry. */
  assetId: string;
  /** Rendering context that governs which guard rules apply. */
  mode: EducationalRenderMode;
  /** Custom fallback rendered when the asset cannot be shown in the given mode. */
  fallback?: ReactNode;
}

// ─── Built-in placeholders ────────────────────────────────────────────────────

function ReducedMotionPlaceholder({ assetId }: { assetId: string }) {
  return (
    <div
      role="status"
      aria-label={`Animation unavailable — reduced motion requested (${assetId})`}
      style={{ padding: '1rem', border: '1px dashed currentColor', borderRadius: '4px' }}
    >
      <p>
        <strong>Animation not shown</strong> — reduced-motion mode is active.
      </p>
      <p>Please refer to the written description for this topic.</p>
    </div>
  );
}

function PrintPlaceholder({ assetId }: { assetId: string }) {
  return (
    <div
      role="note"
      aria-label={`Animation omitted in print (${assetId})`}
      style={{ padding: '1rem', border: '1px dashed currentColor', borderRadius: '4px' }}
    >
      <p>
        <strong>Interactive visual</strong> — scan the QR code or visit the digital
        version to view this animation.
      </p>
    </div>
  );
}

function UnknownAssetPlaceholder({ assetId }: { assetId: string }) {
  return (
    <div role="alert" aria-label={`Unknown educational asset: ${assetId}`}>
      <p>Educational asset &ldquo;{assetId}&rdquo; is not registered.</p>
    </div>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

/**
 * Renders a registered educational asset in the requested mode.
 *
 * Guard rules (in priority order):
 * 1. If the asset is unknown → render UnknownAssetPlaceholder (or fallback).
 * 2. If mode is `reduced_motion` and the asset has motion and does not support
 *    reduced motion → render ReducedMotionPlaceholder (or fallback).
 * 3. If mode is `print` and the asset is an animation without a print
 *    equivalent → render PrintPlaceholder (or fallback).
 * 4. Otherwise → render the mapped component.
 */
export default function EducationalAssetRenderer({
  assetId,
  mode,
  fallback,
}: EducationalAssetRendererProps) {
  const asset = educationalAssetRegistry.find((a) => a.id === assetId);
  const Component = educationalComponentRegistry[assetId];

  if (!asset || !Component) {
    return <>{fallback ?? <UnknownAssetPlaceholder assetId={assetId} />}</>;
  }

  // Guard: reduced-motion mode — block high/medium motion animations that
  // don't declare reduced-motion support.
  if (
    mode === 'reduced_motion'
    && asset.motionIntensity !== 'none'
    && !asset.supportsReducedMotion
  ) {
    return <>{fallback ?? <ReducedMotionPlaceholder assetId={assetId} />}</>;
  }

  // Guard: print mode — block animation assets that have no print equivalent.
  if (mode === 'print' && asset.assetType === 'animation' && !asset.hasPrintEquivalent) {
    return <>{fallback ?? <PrintPlaceholder assetId={assetId} />}</>;
  }

  return <Component />;
}
