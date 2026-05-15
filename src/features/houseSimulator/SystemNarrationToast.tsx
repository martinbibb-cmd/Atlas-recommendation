/**
 * SystemNarrationToast — top live-phase narration toast for the House Simulator.
 *
 * Shows the current simulation phase (heating active, on-demand hot water, idle,
 * etc.) as a persistent top banner with an optional warning notice when a
 * physics limiter is active.
 *
 * All content comes from buildHouseSimulatorViewModel — no physics logic here.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SystemNarrationToastProps {
  /** Phase emoji icon, e.g. "🔥", "💧", "💤". */
  icon: string;
  /** One-line phase description, e.g. "Space heating active". */
  phase: string;
  /** Optional warning text surfaced from the active limiter. */
  warningText?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SystemNarrationToast({
  icon,
  phase,
  warningText,
}: SystemNarrationToastProps) {
  return (
    <div
      className="hs-toast"
      role="status"
      aria-live="polite"
      aria-label={`System status: ${phase}${warningText ? '. Warning: ' + warningText : ''}`}
    >
      <span className="hs-toast__icon" aria-hidden="true">{icon}</span>
      <strong className="hs-toast__phase">{phase}</strong>
      {warningText != null && warningText !== '' && (
        <span className="hs-toast__warn">
          <span aria-hidden="true">⚠</span>
          {warningText}
        </span>
      )}
    </div>
  );
}
