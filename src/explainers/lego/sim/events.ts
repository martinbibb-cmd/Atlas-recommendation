// src/explainers/lego/sim/events.ts
//
// Comfort event flags emitted by the simulation.
//
// These are topology-aware consequence flags that describe what the user
// actually experiences, rather than raw simulation values.  They are designed
// to sit on top of the physics and drive future UI reactions (speech bubbles,
// alerts, explainer text) without replacing the underlying simulation.
//
// Design rule: populate these in simulation results when the relevant condition
// is detected.  The UI layer is responsible for translating them into human-
// readable copy using the Atlas controlled vocabulary (docs/atlas-terminology.md).
//
// Example future UI mapping:
//   temperature_drop + active shower outlet →
//     customer mode:  "Shower temperature may drop if another tap is used."
//     demo/fun mode:  "STOP USING TAPS!!!"

// ─── Comfort event type ───────────────────────────────────────────────────────

/**
 * A comfort event is a consequence flag emitted when the simulation detects a
 * condition that would noticeably affect the user's experience.
 *
 * temperature_drop   — delivered water temperature is falling below target
 *                      (e.g. combi thermal capacity exceeded, TMV saturated)
 * flow_drop          — delivered flow rate is below what was requested
 *                      (e.g. supply cap reached, pipe capacity exceeded)
 * heating_paused     — central heating has been interrupted
 *                      (e.g. combi DHW priority active during a hot draw)
 * store_depleted     — stored hot water volume is insufficient for current demand
 *                      (e.g. cylinder draw-off exceeds remaining store energy)
 * recovery_delay     — hot water will not be available at full temperature until
 *                      the store has recharged
 *                      (e.g. post-draw cylinder reheat required)
 */
export type ComfortEvent =
  | 'temperature_drop'
  | 'flow_drop'
  | 'heating_paused'
  | 'store_depleted'
  | 'recovery_delay'
