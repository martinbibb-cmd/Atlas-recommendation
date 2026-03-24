/**
 * StoryCanvas.tsx — Presentation Layer v1.
 *
 * The main story canvas — three stacked sections:
 *   A. "What happens in your home" — EventTimelineStrip
 *   B. "Why this happens" — CauseCards
 *   C. ModeToggle (current ↔ proposed)
 *
 * Props bind directly to engine outputs: SystemStateTimeline, events,
 * LimiterLedger, and the current recommendation.
 *
 * Colour tone:
 *   current  → neutral/amber (problem framing)
 *   proposed → green/stable  (solution framing)
 */

import type { DerivedSystemEventSummary } from '../../engine/timeline/DerivedSystemEvent';
import type { LimiterLedger } from '../../engine/limiter/LimiterLedger';
import type { SelectableFamily } from '../family-view/useSelectedFamilyData';
import type { PresentationMode } from './presentationTypes';
import EventTimelineStrip from './EventTimelineStrip';
import CauseCards from './CauseCards';
import ModeToggle from './ModeToggle';
import './StoryCanvas.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  events: DerivedSystemEventSummary;
  limiterLedger: LimiterLedger;
  family: SelectableFamily;
  mode: PresentationMode;
  onModeChange: (mode: PresentationMode) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StoryCanvas({
  events,
  limiterLedger,
  family,
  mode,
  onModeChange,
}: Props) {
  return (
    <div className={`story-canvas story-canvas--${mode}`} aria-label="System story">
      {/* A — What happens in your home */}
      <EventTimelineStrip events={events} family={family} mode={mode} />

      <hr className="story-canvas__divider" />

      {/* B — Why this happens / Why this works */}
      <CauseCards limiterLedger={limiterLedger} mode={mode} maxCards={3} />

      <hr className="story-canvas__divider" />

      {/* C — Mode toggle */}
      <div className="story-canvas__toggle-row">
        <ModeToggle mode={mode} onToggle={onModeChange} />
      </div>
    </div>
  );
}
