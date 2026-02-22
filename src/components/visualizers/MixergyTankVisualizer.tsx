/**
 * MixergyTankVisualizer
 *
 * Animated 2D cross-section of a Mixergy smart cylinder showing its unique
 * "top-down" stratified heating model ("State of Charge").
 *
 * In a conventional cylinder the entire water volume must be heated to 60 °C.
 * Mixergy heats only from the top down, so a 150L Mixergy at 80% SoC delivers
 * the same usable hot water as a 210L conventional cylinder at 100%.
 */
import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Mixergy cylinder size in litres */
  mixergyLitres: number;
  /** Conventional equivalent size for comparison */
  conventionalLitres: number;
  /** State of Charge 0–100 (percent of useful hot water charged) */
  stateOfChargePct?: number;
  /** Whether to animate the SoC from 0 to stateOfChargePct on mount */
  animate?: boolean;
}

export default function MixergyTankVisualizer({
  mixergyLitres,
  conventionalLitres,
  stateOfChargePct = 80,
  animate = true,
}: Props) {
  const [displayedSoC, setDisplayedSoC] = useState(animate ? 0 : stateOfChargePct);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) return;
    let current = 0;
    const target = stateOfChargePct;
    const step = () => {
      current = Math.min(target, current + 1.5);
      setDisplayedSoC(current);
      if (current < target) {
        animFrameRef.current = requestAnimationFrame(step);
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    };
  }, [stateOfChargePct, animate]);

  const socToRender = animate ? displayedSoC : stateOfChargePct;

  const tankH = 160; // SVG tank height
  const tankW = 60;
  const hotH = (socToRender / 100) * tankH;
  const hotY = 0; // Mixergy heats top-down
  // Colour gradient: hot zone = warm orange→red, cold zone = cool blue
  const hotColor = `hsl(${30 - (socToRender / 100) * 20}, 90%, 55%)`;

  return (
    <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
      {/* Mixergy cylinder */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#276749', marginBottom: 4 }}>
          Mixergy {mixergyLitres}L
        </p>
        <svg width={tankW + 20} height={tankH + 30} role="img" aria-label="Mixergy cylinder">
          {/* Tank outline */}
          <rect x={10} y={0} width={tankW} height={tankH} rx={8} fill="#e2e8f0" stroke="#a0aec0" strokeWidth={2} />
          {/* Cold zone */}
          <rect
            x={11}
            y={hotH + 1}
            width={tankW - 2}
            height={Math.max(0, tankH - hotH - 2)}
            rx={2}
            fill="#bee3f8"
          />
          {/* Hot zone (top-down) */}
          <rect
            x={11}
            y={hotY + 1}
            width={tankW - 2}
            height={Math.max(0, hotH - 2)}
            rx={2}
            fill={hotColor}
          />
          {/* SoC label */}
          <text x={tankW / 2 + 10} y={tankH / 2 + 5} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#fff">
            {Math.round(socToRender)}%
          </text>
          {/* "Top-down" arrow */}
          <text x={tankW / 2 + 10} y={14} textAnchor="middle" fontSize={10} fill="#e53e3e">
            ↓ Top-down
          </text>
          {/* Volume label */}
          <text x={tankW / 2 + 10} y={tankH + 20} textAnchor="middle" fontSize={11} fill="#4a5568">
            {mixergyLitres} L
          </text>
        </svg>
      </div>

      {/* vs label */}
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#718096', paddingBottom: 28 }}>vs</div>

      {/* Conventional cylinder (always full to 100%) */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#744210', marginBottom: 4 }}>
          Conventional {conventionalLitres}L
        </p>
        <svg
          width={tankW + 20}
          height={((conventionalLitres / mixergyLitres) * tankH) + 30}
          role="img"
          aria-label="Conventional cylinder"
        >
          <rect
            x={10}
            y={0}
            width={tankW}
            height={(conventionalLitres / mixergyLitres) * tankH}
            rx={8}
            fill="#e2e8f0"
            stroke="#a0aec0"
            strokeWidth={2}
          />
          {/* Always fully heated */}
          <rect
            x={11}
            y={1}
            width={tankW - 2}
            height={(conventionalLitres / mixergyLitres) * tankH - 2}
            rx={2}
            fill="#fc8181"
          />
          <text
            x={tankW / 2 + 10}
            y={(conventionalLitres / mixergyLitres) * tankH / 2 + 5}
            textAnchor="middle"
            fontSize={13}
            fontWeight="bold"
            fill="#fff"
          >
            100%
          </text>
          <text
            x={tankW / 2 + 10}
            y={(conventionalLitres / mixergyLitres) * tankH + 20}
            textAnchor="middle"
            fontSize={11}
            fill="#4a5568"
          >
            {conventionalLitres} L
          </text>
        </svg>
      </div>

      {/* Space saving badge */}
      <div style={{ paddingBottom: 28 }}>
        <div style={{
          background: '#f0fff4',
          border: '1.5px solid #9ae6b4',
          borderRadius: 10,
          padding: '8px 14px',
          fontSize: '0.82rem',
          color: '#276749',
          fontWeight: 600,
        }}>
          💾 {Math.round((1 - mixergyLitres / conventionalLitres) * 100)}% space saving<br />
          <span style={{ fontWeight: 400, color: '#4a5568' }}>
            Same usable hot water
          </span>
        </div>
      </div>
    </div>
  );
}
