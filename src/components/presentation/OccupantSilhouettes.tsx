/**
 * OccupantSilhouettes.tsx
 *
 * Renders a row of person silhouettes scaled by age group.
 * Used in the Home quadrant of the QuadrantDashboardPage (Page 1).
 *
 * Heights:
 *   Adults (26+)        → 44px
 *   Young adults 18–25  → 40px
 *   Teenagers 11–17     → 34px
 *   Children 5–10       → 28px
 *   Young children 0–4  → 20px
 *
 * Rules:
 *   - No Math.random() — deterministic.
 *   - All data from HouseholdComposition or fallback occupancyCount.
 *   - Max 8 silhouettes shown to avoid overflow.
 */

import type { HouseholdComposition } from '../../engine/schema/EngineInputV2_3';

interface OccupantSilhouettesProps {
  composition?: HouseholdComposition;
  /** Fallback when composition is absent — renders this many adult silhouettes. */
  occupancyCount?: number;
}

type SilhouetteSize = 44 | 40 | 34 | 28 | 20;

interface Silhouette {
  id: string;
  height: SilhouetteSize;
  label: string;
  colour: string;
}

function buildSilhouettes(
  composition: HouseholdComposition | undefined,
  fallbackCount: number,
): Silhouette[] {
  const list: Silhouette[] = [];

  if (composition) {
    const {
      adultCount,
      youngAdultCount18to25AtHome,
      childCount11to17,
      childCount5to10,
      childCount0to4,
    } = composition;

    for (let i = 0; i < adultCount; i++) {
      list.push({ id: `adult-${i}`, height: 44, label: 'Adult', colour: '#2b6cb0' });
    }
    for (let i = 0; i < youngAdultCount18to25AtHome; i++) {
      list.push({ id: `ya-${i}`, height: 40, label: 'Young adult', colour: '#3182ce' });
    }
    for (let i = 0; i < childCount11to17; i++) {
      list.push({ id: `teen-${i}`, height: 34, label: 'Teenager', colour: '#276749' });
    }
    for (let i = 0; i < childCount5to10; i++) {
      list.push({ id: `child-${i}`, height: 28, label: 'Child', colour: '#48bb78' });
    }
    for (let i = 0; i < childCount0to4; i++) {
      list.push({ id: `infant-${i}`, height: 20, label: 'Young child', colour: '#68d391' });
    }
  } else {
    const count = Math.max(1, Math.min(fallbackCount, 8));
    for (let i = 0; i < count; i++) {
      list.push({ id: `fallback-${i}`, height: 44, label: 'Occupant', colour: '#2b6cb0' });
    }
  }

  // Cap at 8 to keep layout tidy
  return list.slice(0, 8);
}

function PersonSvg({
  height,
  colour,
  label,
}: {
  height: SilhouetteSize;
  colour: string;
  label: string;
}) {
  // Scale all parts proportionally
  const scale = height / 44;
  const headR = 7 * scale;
  const headCy = headR + 1;
  const bodyTop = headCy + headR + 1;
  const bodyH = 14 * scale;
  const bodyW = 10 * scale;
  const legH = 10 * scale;
  const legW = 4 * scale;
  const totalH = bodyTop + bodyH + legH + 2;
  const cx = 12;

  return (
    <svg
      width={cx * 2}
      height={totalH}
      viewBox={`0 0 ${cx * 2} ${totalH}`}
      aria-label={label}
      role="img"
      style={{ flexShrink: 0 }}
    >
      {/* Head */}
      <circle cx={cx} cy={headCy} r={headR} fill={colour} />
      {/* Body */}
      <rect
        x={cx - bodyW / 2}
        y={bodyTop}
        width={bodyW}
        height={bodyH}
        rx={bodyW * 0.3}
        fill={colour}
      />
      {/* Left leg */}
      <rect
        x={cx - legW - 1}
        y={bodyTop + bodyH - 2}
        width={legW}
        height={legH}
        rx={legW * 0.4}
        fill={colour}
      />
      {/* Right leg */}
      <rect
        x={cx + 1}
        y={bodyTop + bodyH - 2}
        width={legW}
        height={legH}
        rx={legW * 0.4}
        fill={colour}
      />
    </svg>
  );
}

export default function OccupantSilhouettes({
  composition,
  occupancyCount = 1,
}: OccupantSilhouettesProps) {
  const silhouettes = buildSilhouettes(composition, occupancyCount);

  if (silhouettes.length === 0) return null;

  return (
    <div
      className="occ-silhouettes"
      aria-label={`${silhouettes.length} occupant${silhouettes.length !== 1 ? 's' : ''}`}
    >
      {silhouettes.map(s => (
        <PersonSvg key={s.id} height={s.height} colour={s.colour} label={s.label} />
      ))}
      <span className="occ-silhouettes__count" aria-hidden="true">
        {silhouettes.length}
      </span>
    </div>
  );
}
