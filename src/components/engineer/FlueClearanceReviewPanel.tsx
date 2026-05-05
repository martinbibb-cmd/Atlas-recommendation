/**
 * FlueClearanceReviewPanel.tsx
 *
 * Engineer-facing review panel for external flue clearance evidence.
 *
 * Allows engineers to review each external flue clearance scene captured
 * during the survey and record a judgement without automatic compliance
 * calculation.
 *
 * Rules:
 * - No pass/fail wording.
 * - No calculated compliance — engineer judgement only.
 * - Default status = needs_review when a scene exists.
 * - Customer outputs show summary only unless customerDetailEnabled is true.
 * - Review state is kept separately from the capture evidence.
 * - This panel is read/write; the capture panel (EngineerFlueClearancePanel)
 *   remains read-only.
 */

import { useState } from 'react';
import type { ExternalClearanceSceneV1 } from '../../contracts/spatial3dEvidence';
import type {
  FlueClearanceReviewV1,
  FlueClearanceReviewStatus,
} from '../../features/atlasProperty/types/flueClearanceReview.types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  scenes: ExternalClearanceSceneV1[];
}

// ─── Status config ────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  description: string;
}

const STATUS_CONFIG: Record<FlueClearanceReviewStatus, StatusConfig> = {
  not_reviewed: {
    label:       'Not reviewed',
    color:       '#4a5568',
    bg:          '#f7fafc',
    border:      '#e2e8f0',
    description: 'This scene has not yet been reviewed.',
  },
  needs_review: {
    label:       'Needs review',
    color:       '#7b341e',
    bg:          '#fffaf0',
    border:      '#fbd38d',
    description: 'Review required before proceeding.',
  },
  acceptable: {
    label:       'Acceptable',
    color:       '#276749',
    bg:          '#f0fff4',
    border:      '#9ae6b4',
    description: 'Clearance judged acceptable by engineer.',
  },
  concern: {
    label:       'Concern noted',
    color:       '#744210',
    bg:          '#fffff0',
    border:      '#fefcbf',
    description: 'A concern has been noted — follow-up may be required.',
  },
  blocked: {
    label:       'Blocked',
    color:       '#742a2a',
    bg:          '#fff5f5',
    border:      '#feb2b2',
    description: 'Clearance insufficient — do not proceed without resolution.',
  },
};

const STATUS_ORDER: FlueClearanceReviewStatus[] = [
  'not_reviewed',
  'needs_review',
  'acceptable',
  'concern',
  'blocked',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDefaultReview(sceneId: string): FlueClearanceReviewV1 {
  return {
    sceneId,
    status:               'needs_review',
    notes:                '',
    reviewedByUserId:     undefined,
    reviewedAt:           undefined,
    customerDetailEnabled: false,
  };
}

function buildInitialReviews(
  scenes: ExternalClearanceSceneV1[],
): Map<string, FlueClearanceReviewV1> {
  const map = new Map<string, FlueClearanceReviewV1>();
  for (const scene of scenes) {
    map.set(scene.id, makeDefaultReview(scene.id));
  }
  return map;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FlueClearanceReviewStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display:      'inline-block',
        fontSize:     '0.72rem',
        fontWeight:   700,
        color:        cfg.color,
        background:   cfg.bg,
        border:       `1px solid ${cfg.border}`,
        padding:      '0.1rem 0.5rem',
        borderRadius: '999px',
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Per-scene review form ────────────────────────────────────────────────────

interface SceneReviewFormProps {
  scene:    ExternalClearanceSceneV1;
  review:   FlueClearanceReviewV1;
  onChange: (updated: FlueClearanceReviewV1) => void;
}

function SceneReviewForm({ scene, review, onChange }: SceneReviewFormProps) {
  const cfg = STATUS_CONFIG[review.status];

  return (
    <div
      data-testid={`flue-clearance-review-scene-${scene.id}`}
      style={{
        border:        `1px solid ${cfg.border}`,
        borderRadius:  '6px',
        overflow:      'hidden',
        marginBottom:  '0.75rem',
      }}
    >
      {/* Scene preview image */}
      {scene.evidence.previewImageUrl && (
        <div style={{ background: '#f7fafc' }}>
          <img
            src={scene.evidence.previewImageUrl}
            alt="Flue area"
            style={{
              width:      '100%',
              maxHeight:  '180px',
              objectFit:  'cover',
              display:    'block',
            }}
          />
        </div>
      )}

      <div style={{ padding: '0.75rem 0.875rem' }}>
        {/* Current status badge */}
        <div style={{ marginBottom: '0.5rem' }}>
          <StatusBadge status={review.status} />
        </div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: cfg.color }}>
          {cfg.description}
        </p>

        {/* Status selector */}
        <div style={{ marginBottom: '0.65rem' }}>
          <label
            htmlFor={`review-status-${scene.id}`}
            style={{
              display:      'block',
              fontSize:     '0.75rem',
              fontWeight:   600,
              color:        '#2d3748',
              marginBottom: '0.25rem',
            }}
          >
            Engineer judgement
          </label>
          <select
            id={`review-status-${scene.id}`}
            data-testid={`review-status-select-${scene.id}`}
            value={review.status}
            onChange={(e) =>
              onChange({
                ...review,
                status: e.target.value as FlueClearanceReviewStatus,
              })
            }
            style={{
              width:        '100%',
              fontSize:     '0.82rem',
              padding:      '0.35rem 0.5rem',
              borderRadius: '4px',
              border:       '1px solid #cbd5e0',
              background:   '#fff',
              color:        '#2d3748',
            }}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: '0.65rem' }}>
          <label
            htmlFor={`review-notes-${scene.id}`}
            style={{
              display:      'block',
              fontSize:     '0.75rem',
              fontWeight:   600,
              color:        '#2d3748',
              marginBottom: '0.25rem',
            }}
          >
            Notes
          </label>
          <textarea
            id={`review-notes-${scene.id}`}
            data-testid={`review-notes-${scene.id}`}
            value={review.notes ?? ''}
            onChange={(e) => onChange({ ...review, notes: e.target.value })}
            placeholder="Add any observations or follow-up notes…"
            rows={3}
            style={{
              width:        '100%',
              fontSize:     '0.82rem',
              padding:      '0.35rem 0.5rem',
              borderRadius: '4px',
              border:       '1px solid #cbd5e0',
              resize:       'vertical',
              boxSizing:    'border-box',
            }}
          />
        </div>

        {/* Customer detail toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            id={`customer-detail-${scene.id}`}
            data-testid={`customer-detail-toggle-${scene.id}`}
            checked={review.customerDetailEnabled}
            onChange={(e) =>
              onChange({ ...review, customerDetailEnabled: e.target.checked })
            }
          />
          <label
            htmlFor={`customer-detail-${scene.id}`}
            style={{ fontSize: '0.78rem', color: '#4a5568', cursor: 'pointer' }}
          >
            Show full review detail in customer outputs
          </label>
        </div>

        {!review.customerDetailEnabled && (
          <p
            data-testid={`customer-summary-notice-${scene.id}`}
            style={{
              margin:     '0.5rem 0 0',
              fontSize:   '0.72rem',
              color:      '#718096',
              fontStyle:  'italic',
            }}
          >
            Customer outputs will show a summary only.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FlueClearanceReviewPanel({ scenes }: Props) {
  const [reviews, setReviews] = useState<Map<string, FlueClearanceReviewV1>>(
    () => buildInitialReviews(scenes),
  );

  if (scenes.length === 0) return null;

  function updateReview(updated: FlueClearanceReviewV1) {
    setReviews((prev) => {
      const next = new Map(prev);
      next.set(updated.sceneId, updated);
      return next;
    });
  }

  const reviewList = scenes.map((s) => reviews.get(s.id) ?? makeDefaultReview(s.id));
  const hasBlocked = reviewList.some((r) => r.status === 'blocked');
  const hasConcern = reviewList.some((r) => r.status === 'concern');
  const allAcceptable = reviewList.every((r) => r.status === 'acceptable');

  const headerColor = hasBlocked ? '#742a2a' : hasConcern ? '#744210' : allAcceptable ? '#276749' : '#2d3748';
  const headerBg    = hasBlocked ? '#fff5f5' : hasConcern ? '#fffff0' : allAcceptable ? '#f0fff4' : '#f7fafc';
  const headerBorder = hasBlocked ? '#feb2b2' : hasConcern ? '#fefcbf' : allAcceptable ? '#9ae6b4' : '#e2e8f0';

  return (
    <div
      data-testid="flue-clearance-review-panel"
      style={{
        background:    '#fff',
        border:        `1px solid ${headerBorder}`,
        borderRadius:  '8px',
        padding:       '1rem 1.25rem',
        marginBottom:  '1rem',
      }}
    >
      {/* Panel header */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '0.5rem',
        background:   headerBg,
        margin:       '-1rem -1.25rem 0.85rem',
        padding:      '0.6rem 1.25rem',
        borderRadius: '7px 7px 0 0',
      }}>
        <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: headerColor, flex: 1 }}>
          🔍 Flue Clearance Review
        </h2>
        <span style={{
          fontSize:     '0.72rem',
          fontWeight:   700,
          color:        headerColor,
          padding:      '0.1rem 0.45rem',
          borderRadius: '999px',
          background:   'rgba(255,255,255,0.6)',
        }}>
          {scenes.length} scene{scenes.length !== 1 ? 's' : ''}
        </span>
      </div>

      <p style={{ margin: '0 0 0.85rem', fontSize: '0.8rem', color: '#4a5568' }}>
        Review each flue clearance scene and record your judgement.
        Your review is recorded separately from the captured evidence.
      </p>

      {scenes.map((scene) => (
        <SceneReviewForm
          key={scene.id}
          scene={scene}
          review={reviews.get(scene.id) ?? makeDefaultReview(scene.id)}
          onChange={updateReview}
        />
      ))}
    </div>
  );
}
