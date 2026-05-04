/**
 * FlueSegmentEditor.tsx
 *
 * Segment list editor for the flue route builder.
 *
 * Lets the engineer:
 *   - Add a new segment from a picker of standard kinds.
 *   - Enter a physical length for straight segments.
 *   - Remove a segment by index.
 *
 * Design rules:
 *   - Pure presentational: receives segment list + callbacks from parent.
 *   - Does not call the calculator — parent is responsible for recalculation.
 *   - Does not output customer-facing copy.
 */

import { useState } from 'react';
import type { QuoteFlueSegmentV1, FlueSegmentKind } from '../../calculators/quotePlannerTypes';

// ─── Segment kind display metadata ────────────────────────────────────────────

interface SegmentKindMeta {
  kind:    FlueSegmentKind;
  label:   string;
  icon:    string;
  /** Whether this kind requires the engineer to enter a physical length. */
  hasLength: boolean;
}

const SEGMENT_KINDS: SegmentKindMeta[] = [
  { kind: 'straight',            label: 'Straight section',      icon: '━',  hasLength: true  },
  { kind: 'elbow_90',            label: '90° elbow',             icon: '↰',  hasLength: false },
  { kind: 'elbow_45',            label: '45° elbow',             icon: '↗',  hasLength: false },
  { kind: 'offset',              label: 'Offset',                icon: '↔',  hasLength: false },
  { kind: 'plume_kit',           label: 'Plume management kit',  icon: '💨', hasLength: false },
  { kind: 'horizontal_terminal', label: 'Horizontal terminal',   icon: '🔲', hasLength: false },
  { kind: 'vertical_terminal',   label: 'Vertical terminal',     icon: '🔝', hasLength: false },
  { kind: 'roof_flashing',       label: 'Roof flashing',         icon: '🏠', hasLength: false },
];

const SEGMENT_KIND_LABEL: Partial<Record<FlueSegmentKind, string>> = Object.fromEntries(
  SEGMENT_KINDS.map(({ kind, label }) => [kind, label]),
) as Partial<Record<FlueSegmentKind, string>>;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FlueSegmentEditorProps {
  /** Current ordered segment list. */
  segments: QuoteFlueSegmentV1[];
  /** Called when the engineer adds a new segment. */
  onAddSegment: (segment: QuoteFlueSegmentV1) => void;
  /** Called when the engineer removes a segment by index. */
  onRemoveSegment: (index: number) => void;
  /**
   * Called when the engineer taps the flip button on an elbow segment.
   * Only fired for elbow_90 and elbow_45 segments.
   * The index is the 0-based position in the segments array.
   */
  onFlipSegment?: (index: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FlueSegmentEditor({
  segments,
  onAddSegment,
  onRemoveSegment,
  onFlipSegment,
}: FlueSegmentEditorProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<FlueSegmentKind | null>(null);
  const [lengthInput, setLengthInput] = useState('');
  const [lengthError, setLengthError] = useState('');

  // ── Picking a kind ─────────────────────────────────────────────────────────

  function handlePickKind(meta: SegmentKindMeta) {
    if (meta.hasLength) {
      setPendingKind(meta.kind);
      setLengthInput('');
      setLengthError('');
    } else {
      onAddSegment({ kind: meta.kind });
      setAddOpen(false);
    }
  }

  // ── Confirming a straight segment with a length ────────────────────────────

  function handleConfirmLength() {
    const parsed = parseFloat(lengthInput);
    if (isNaN(parsed) || parsed <= 0) {
      setLengthError('Enter a positive length in metres (e.g. 1.5).');
      return;
    }
    onAddSegment({ kind: pendingKind!, physicalLengthM: parsed });
    setPendingKind(null);
    setLengthInput('');
    setLengthError('');
    setAddOpen(false);
  }

  function handleCancelLength() {
    setPendingKind(null);
    setLengthInput('');
    setLengthError('');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flue-segment-editor" data-testid="flue-segment-editor">
      {/* Segment list */}
      {segments.length === 0 ? (
        <p className="flue-segment-editor__empty">
          No segments added yet. Add a segment below.
        </p>
      ) : (
        <ol className="flue-segment-list" aria-label="Flue segments">
          {segments.map((seg, idx) => {
            const isElbow = seg.kind === 'elbow_90' || seg.kind === 'elbow_45';
            const flipDir = seg.flipDirection ?? 'right';
            return (
              <li
                key={idx}
                className="flue-segment-item"
                data-testid={`flue-segment-item-${idx}`}
              >
                <span className="flue-segment-item__label">
                  {SEGMENT_KIND_LABEL[seg.kind] ?? seg.kind}
                  {seg.physicalLengthM != null && (
                    <span className="flue-segment-item__length">
                      {' — '}{seg.physicalLengthM} m
                    </span>
                  )}
                  {isElbow && (
                    <span className="flue-segment-item__flip-dir" aria-hidden="true">
                      {' '}({flipDir})
                    </span>
                  )}
                </span>
                <div className="flue-segment-item__actions">
                  {isElbow && onFlipSegment != null && (
                    <button
                      type="button"
                      className="flue-segment-item__flip"
                      aria-label={`Flip ${SEGMENT_KIND_LABEL[seg.kind] ?? seg.kind} at position ${idx + 1} — currently ${flipDir}`}
                      onClick={() => onFlipSegment(idx)}
                    >
                      ↺ Flip
                    </button>
                  )}
                  <button
                    type="button"
                    className="flue-segment-item__remove"
                    aria-label={`Remove ${SEGMENT_KIND_LABEL[seg.kind] ?? seg.kind} at position ${idx + 1}`}
                    onClick={() => onRemoveSegment(idx)}
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Length-entry prompt for straight sections */}
      {pendingKind != null && (
        <div className="flue-segment-length-prompt" data-testid="flue-length-prompt">
          <p className="flue-segment-length-prompt__label">
            Enter straight length (metres):
          </p>
          <input
            type="number"
            className="flue-segment-length-prompt__input"
            aria-label="Straight length in metres"
            value={lengthInput}
            min="0.1"
            step="0.1"
            onChange={(e) => {
              setLengthInput(e.target.value);
              setLengthError('');
            }}
          />
          {lengthError && (
            <p className="flue-segment-length-prompt__error" role="alert">
              {lengthError}
            </p>
          )}
          <div className="flue-segment-length-prompt__actions">
            <button
              type="button"
              className="flue-segment-length-prompt__confirm"
              onClick={handleConfirmLength}
            >
              Add
            </button>
            <button
              type="button"
              className="flue-segment-length-prompt__cancel"
              onClick={handleCancelLength}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add-segment picker */}
      {!pendingKind && (
        <div className="flue-add-bar">
          <button
            type="button"
            className="flue-add-bar__toggle"
            aria-expanded={addOpen}
            onClick={() => setAddOpen((v) => !v)}
          >
            {addOpen ? 'Cancel' : '+ Add segment'}
          </button>

          {addOpen && (
            <div className="flue-add-bar__grid" role="group" aria-label="Segment type picker">
              {SEGMENT_KINDS.map((meta) => (
                <button
                  key={meta.kind}
                  type="button"
                  className="flue-add-bar__kind-btn"
                  onClick={() => handlePickKind(meta)}
                >
                  <span aria-hidden="true">{meta.icon}</span> {meta.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
