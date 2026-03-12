/**
 * VerdictCard.tsx
 *
 * Compact decision card — verdict title, one supporting note, confidence badge.
 * Avoids repeating the full reasons list or prose blocks visible elsewhere.
 *
 * Data flows from VerdictV1 only — no re-derivation.
 */
import type { VerdictV1 } from '../../contracts/EngineOutputV1';
import { AtlasPanel } from '../ui/AtlasPanel';

interface Props {
  verdict?: VerdictV1;
  /** Verdict from the unmodified base survey. When provided and the status
   *  differs, a "Compared with base" delta line is shown. */
  baseVerdict?: VerdictV1;
}

const STATUS_BADGE: Record<VerdictV1['status'], string> = {
  good:    'atlas-badge--success',
  caution: 'atlas-badge--warning',
  fail:    'atlas-badge--danger',
};

const STATUS_LABELS: Record<VerdictV1['status'], string> = {
  good:    'Recommended',
  caution: 'Caution',
  fail:    'Not suitable',
};

export default function VerdictCard({ verdict, baseVerdict }: Props) {
  if (!verdict) {
    return (
      <AtlasPanel className="behaviour-console__kpi">
        <div className="panel-title">Verdict</div>
        <div className="behaviour-console__subtle">No verdict available</div>
      </AtlasPanel>
    );
  }

  const firstReason = verdict.reasons[0];
  const confidenceLabel =
    verdict.confidence.level.charAt(0).toUpperCase() + verdict.confidence.level.slice(1);

  const statusChanged = baseVerdict && baseVerdict.status !== verdict.status;

  return (
    <AtlasPanel className="behaviour-console__kpi">
      <div className="panel-title">Verdict</div>
      <div className="verdict-card__header">
        <span className={`atlas-badge ${STATUS_BADGE[verdict.status]}`}>
          {STATUS_LABELS[verdict.status]}
        </span>
      </div>
      <div className="verdict-card__title">{verdict.title}</div>
      {firstReason && (
        <div className="verdict-card__note">{firstReason}</div>
      )}
      <div className="verdict-card__confidence">{confidenceLabel} confidence</div>
      {statusChanged && (
        <div className="verdict-card__delta">
          Compared with base: {STATUS_LABELS[baseVerdict!.status]} → {STATUS_LABELS[verdict.status]}
        </div>
      )}
    </AtlasPanel>
  );
}
