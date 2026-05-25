import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { CanonicalRecommendationSnapshotV1 } from './visitReviewLifecycle';

function toSafeDownloadBaseName(value: string): string {
  const trimmed = value.trim();
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe.length > 0 ? safe : 'atlas-visit';
}

export function buildCanonicalRecommendationSnapshot(input: {
  readonly visitId: string;
  readonly sourceVisitRevision: string;
  readonly selectedScenarioId?: string;
  readonly decision?: AtlasDecisionV1;
  readonly customerSummary?: CustomerSummaryV1;
  readonly regeneratedFrom?: string;
  readonly createdAt: string;
}): CanonicalRecommendationSnapshotV1 {
  const material = JSON.stringify({
    visitId: input.visitId,
    sourceVisitRevision: input.sourceVisitRevision,
    selectedScenarioId: input.selectedScenarioId ?? null,
    decisionScenarioId: input.decision?.recommendedScenarioId ?? null,
    summaryScenarioId: input.customerSummary?.recommendedScenarioId ?? null,
    regeneratedFrom: input.regeneratedFrom ?? null,
    createdAt: input.createdAt,
  });
  let hash = 0x811c9dc5;
  for (let i = 0; i < material.length; i += 1) {
    hash ^= material.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const checksum = `fnv1a32-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  return {
    snapshotId: `${toSafeDownloadBaseName(input.visitId)}-${(hash >>> 0).toString(16).padStart(8, '0')}`,
    createdAt: input.createdAt,
    regeneratedFrom: input.regeneratedFrom,
    sourceVisitRevision: input.sourceVisitRevision,
    checksum,
  };
}
