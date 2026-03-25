/**
 * StoryCanvas.tsx — Presentation Layer v1.
 *
 * The main story canvas — three stacked sections:
 *   A. "What happens now" — EventTimelineStrip
 *   B. "Why" — CauseCards
 *   C. ModeToggle (your home now ↔ with this system)
 *
 * Props bind directly to engine outputs: SystemStateTimeline, events,
 * LimiterLedger, and the current recommendation.
 *
 * Colour tone:
 *   current  → neutral/amber (problem framing)
 *   proposed → green/stable  (solution framing)
 *
 * Staged reveal:
 *   The three sections fade in with a staggered delay so the story unfolds
 *   step by step (demand → system response → cause → toggle).
 *
 * "Wow" interaction:
 *   Clicking a problem event in the timeline highlights the matching cause card.
 *   The highlight auto-clears after 3 seconds.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { DerivedSystemEventSummary } from '../../engine/timeline/DerivedSystemEvent';
import type { LimiterLedger } from '../../engine/limiter/LimiterLedger';
import type { SelectableFamily } from '../family-view/useSelectedFamilyData';
import type { PresentationMode } from './presentationTypes';
import type { HouseholdContext } from './limiterHumanLanguage';
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
  /** Household context used to tailor cause-card copy. */
  householdContext?: HouseholdContext;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StoryCanvas({
  events,
  limiterLedger,
  family,
  mode,
  onModeChange,
  householdContext,
}: Props) {
  // ── "Wow" interaction — event click → cause card highlight ────────────
  const [activeLimiterId, setActiveLimiterId] = useState<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEventClick = useCallback((limiterId: string) => {
    // Toggle off if tapping the same limiter twice
    if (activeLimiterId === limiterId) {
      setActiveLimiterId(null);
      if (clearTimerRef.current != null) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
      return;
    }
    setActiveLimiterId(limiterId);
    if (clearTimerRef.current != null) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      setActiveLimiterId(null);
      clearTimerRef.current = null;
    }, 3000);
  }, [activeLimiterId]);

  // Clear the timer on unmount
  useEffect(() => {
    return () => {
      if (clearTimerRef.current != null) clearTimeout(clearTimerRef.current);
    };
  }, []);

  // Only surface the active limiter in 'current' mode — the highlight is
  // meaningless in the proposed view and naturally disappears on toggle.
  const effectiveLimiterId = mode === 'current' ? activeLimiterId : null;

  return (
    <div className={`story-canvas story-canvas--${mode}`} aria-label="System story">
      {/* A — What happens in your home (staged step 1) */}
      <div className="story-canvas__section story-canvas__section--step1">
        <EventTimelineStrip
          events={events}
          family={family}
          mode={mode}
          onEventClick={mode === 'current' ? handleEventClick : undefined}
          activeLimiterId={effectiveLimiterId}
        />
      </div>

      <hr className="story-canvas__divider" />

      {/* B — Why this happens / Why this works (staged step 2) */}
      <div className="story-canvas__section story-canvas__section--step2">
        <CauseCards
          limiterLedger={limiterLedger}
          mode={mode}
          maxCards={3}
          householdContext={householdContext}
          activeLimiterId={effectiveLimiterId}
        />
      </div>

      <hr className="story-canvas__divider" />

      {/* C — Mode toggle (staged step 3) */}
      <div className="story-canvas__section story-canvas__section--step3">
        <div className="story-canvas__toggle-row">
          <ModeToggle mode={mode} onToggle={onModeChange} />
        </div>
      </div>
    </div>
  );
}
