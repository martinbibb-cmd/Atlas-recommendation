/**
 * CylinderComparePanel.tsx
 *
 * Side-by-side comparison of standard vs Mixergy cylinder visuals.
 * Both visuals share the same charge-level slider so the distinction is
 * immediately obvious at any fill level.
 *
 * Used in:
 *   - PhysicsVisualGallery (dev gallery)
 *   - PresentationDeck "Go further" slide (in-room presentation)
 */

import { useState } from 'react';
import CylinderChargeVisual from './visuals/CylinderChargeVisual';
import './CylinderComparePanel.css';

export default function CylinderComparePanel() {
  const [fillLevel, setFillLevel] = useState(0.6);
  const [reducedMotion, setReducedMotion] = useState(false);

  return (
    <div className="ccp__panel">
      <div className="ccp__header">
        <h2 className="ccp__title">Cylinder type — side-by-side comparison</h2>
        <p className="ccp__subtitle">
          Same charge level, different physics. Standard: diffuse body warming, top first.
          Mixergy: sharp hot boundary descends from top as charge builds.
        </p>
      </div>

      <div className="ccp__controls">
        <label className="ccp__control-label">
          Charge level: {Math.round(fillLevel * 100)}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(fillLevel * 100)}
          onChange={(e) => setFillLevel(Number(e.target.value) / 100)}
          className="ccp__slider"
          aria-label="Shared charge level for cylinder comparison"
        />
        <label className="ccp__motion-label">
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(e) => setReducedMotion(e.target.checked)}
          />
          {' '}Simulate reduced motion
        </label>
      </div>

      <div className="ccp__row">
        <div className="ccp__col">
          <h3 className="ccp__col-title">Standard cylinder</h3>
          <p className="ccp__col-desc">
            Whole body warms progressively. Top becomes useful first — but no sharp
            hot/cold boundary.
          </p>
          <div className="ccp__visual-frame">
            <CylinderChargeVisual
              fillLevel={fillLevel}
              mixergyMode={false}
              reducedMotion={reducedMotion}
            />
          </div>
        </div>

        <div className="ccp__col">
          <h3 className="ccp__col-title">Mixergy cylinder</h3>
          <p className="ccp__col-desc">
            Usable hot zone builds from the top down. A sharp thermocline boundary
            marks where heat ends.
          </p>
          <div className="ccp__visual-frame">
            <CylinderChargeVisual
              fillLevel={fillLevel}
              mixergyMode={true}
              reducedMotion={reducedMotion}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
