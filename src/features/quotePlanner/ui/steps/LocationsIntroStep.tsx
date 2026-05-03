/**
 * LocationsIntroStep.tsx
 *
 * Step 4 of the Quote Planner: place locations placeholder.
 *
 * Full route drawing and location-pinning UI are deferred to a later PR.
 * This step exists as a shell so the stepper can advance past step 3 and
 * the later steps remain in the visible progress strip.
 */

export function LocationsIntroStep() {
  return (
    <>
      <h2 className="qp-step-heading">Place locations</h2>
      <p className="qp-step-subheading">
        Mark where the boiler, cylinder, and services will be located.
      </p>
      <div className="qp-placeholder">
        <span className="qp-placeholder__icon" aria-hidden="true">📍</span>
        <span className="qp-placeholder__label">
          Location drawing coming in the next release.
        </span>
      </div>
    </>
  );
}
