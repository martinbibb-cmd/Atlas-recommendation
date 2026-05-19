# Primitive Redesign Targets

## Purpose

Define redesign gates per primitive before any drawing rewrite.
This is the handoff contract from reference extraction to implementation.

## Target briefs

| Primitive | Current failure notes | Target visual outcome | Recognisability blockers | Topology interaction constraints |
|---|---|---|---|---|
| Boiler | Body and underside service rhythm can read as generic box in no-label mode | Clear wall-mounted boiler silhouette with bottom-only service order | Weak underside cadence and fascia differentiation | Must keep bottom-only connection logic aligned with topology ports |
| Unvented cylinder | Coil/connection cues can be too subtle when labels are hidden | Clear stored-hot-water cylinder with top/bottom and lower coil band cues | Insufficient lower-third coil readability | Must preserve top draw-off and bottom cold-in anchors |
| Mixergy cylinder | Can collapse visually into standard cylinder | Distinct smart cylinder with stable horizontal thermocline and top-down charging cue | Thermocline not dominant enough without labels | Must preserve potable-only representation and diffuser logic |
| Thermal store | Can be confused with Mixergy or generic cylinder | Heavier vessel with explicit separate potable exchange path | Missing/weak internal exchange cue | Must keep primary storage and potable path visually separate |
| Radiator | Visual mass can appear as flat placeholder plate | UK panel radiator with groove cadence and bottom valve identity | Valve/end cues too subtle at small scale | Bottom connection markers must remain consistent with routing |
| Pump | Can read as icon instead of installed inline component | Circular circulator body visibly inline with inlet/outlet continuity | Inline continuity not always obvious | Orientation must follow pipe axis in every topology |
| Magnetic filter | Can look like generic capsule | Serviceable vertical canister with cap and inline valve cues | Lack of service cap prominence | Placement must remain return-before-boiler in topology layouts |
| Expansion vessel | Vessel identity can degrade into generic tank | Pressure-vessel silhouette with mounting and diaphragm cues | Pressure-rated cues insufficient in simplified mode | Must remain branch component, not inline store |
| Filling loop | Can appear as permanent bridge pipe | Braided temporary charging loop with two terminal valves | Service-only/read-temporary cue too weak | Must default to isolated/disconnected-safe visual posture |
| ABV | Bypass identity can collapse into generic valve icon | Compact bypass valve with adjustment head in bridge role | Adjustment/bypass cues too weak at low detail | Must remain explicit bridge between flow and return |

## Gate rule

A primitive is not ready for redraw implementation unless:

1. Its reference pack is fully populated.
2. Its silhouette sheet row is accepted.
3. Its target brief is accepted in screenshot-first review planning.

