/**
 * SystemRealWorldImage.tsx
 *
 * A compact, accessible real-world photo/schematic that supports the
 * SystemArchitectureVisualiser without replacing it.
 *
 * Rules:
 * - Always rendered below (never instead of) the Lego visualiser.
 * - Compact size — does not push key content off-screen on mobile.
 * - No image if src is null.
 * - No caption text added here; callers may add their own labels.
 */

import type { CSSProperties } from 'react';
import type { SystemImageInfo } from '../../ui/systemImages/systemImageMap';

interface Props {
  image: SystemImageInfo;
  /** Optional data-testid for targeted testing. */
  testId?: string;
}

const containerStyle: CSSProperties = {
  marginTop: '0.5rem',
  borderRadius: '6px',
  overflow: 'hidden',
  border: '1px solid #e2e8f0',
  display: 'inline-block',
  maxWidth: '100%',
};

const imgStyle: CSSProperties = {
  display: 'block',
  maxWidth: '100%',
  height: 'auto',
  maxHeight: '180px',
  objectFit: 'cover',
};

export function SystemRealWorldImage({ image, testId }: Props) {
  return (
    <div style={containerStyle} data-testid={testId ?? 'system-real-world-image'}>
      <img
        src={image.src}
        alt={image.alt}
        style={imgStyle}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
