# Topology Layout Grid

> **Status**: Canonical — all visual topology authors must comply with this document.
>
> This grid defines the coordinate grammar for the 860 × 430 (desktop) topology SVG canvas.
> Deviations require a comment explaining why and must not cause equipment to overlap pipe stubs.

---

## 1. Flow Direction Convention

**Primary direction: left → right.**

- The boiler (heat source) is always on the **left** of the canvas.
- The heat sink (radiators, cylinder) is always to the **right**.
- The primary flow pipe runs **left → right** on the **top horizontal rail** (y ≈ 140).
- The primary return pipe runs **right → left** on the **bottom horizontal rail** (y ≈ 300).
- This convention applies to all nine canonical topologies.

---

## 2. Equipment Anchor Zones

| Equipment | Zone | x range | y range (top-left corner) |
|---|---|---|---|
| Boiler (any variant) | Left | 44–175 | 140–225 |
| Cylinder (vented/unvented/Mixergy) | Right | 430–720 | 130–225 |
| Thermal store | Right | 430–720 | 130–225 |
| Radiators | Top-centre band | 240–720 | 60–130 |
| Pumps | Return leg, left of centre | 140–220 | 230–290 |
| Expansion vessel | Right of centre | 440–760 | 50–310 |
| Pressure gauge | Right zone | 440–760 | 50–310 |
| ABV / magnetic filter | Mid-circuit | 140–600 | 130–310 |
| Header tank | Far right, high (loft — exempt from y-zone) | 640–800 | 10–60 |
| Powerflush machine | Far left | 10–110 | 150–220 |

---

## 3. Pipe Routing Rules

| Pipe segment | Rule |
|---|---|
| Primary flow rail | Horizontal at y ≈ 140 |
| Primary return rail | Horizontal at y ≈ 300 |
| Radiator flow spur | Vertical from y=140 up to y=112 |
| Radiator return spur | Vertical from y=300 down to y=112 |
| Cylinder charging stubs | Short horizontal extensions off the primary ring |
| Vent pipe (open-vented) | Vertical on right side of canvas (x ≥ 680); must not cross primary flow rail |

**No-crossing rule**: Auxiliary pipes (vent, gas, analogy overlays) must route
east of x = 560 when they need to run vertically in the cylinder zone.
Document any unavoidable crossing in `visualTopologyRegistry.ts` alongside
the topology entry, and assign it `knownCrossing: true`.

---

## 4. Pipe Hierarchy

| Layer | Stroke width | Constant |
|---|---|---|
| Primary circuit ring (flow + return) | 3 px | `PIPE_STROKE_MAIN` |
| Branch spurs (radiators, cylinder, DHW stubs) | 2 px | `PIPE_STROKE_BRANCH` |
| Auxiliary pipes (vent, gas, ABV bridge) | 2 px | `PIPE_STROKE_BRANCH` |
| pipeTrace highlight | 5 px | hardcoded in topology function |

---

## 5. Pipe Colour + Dash Encoding

| Pipe type | Colour | Dash | Constant |
|---|---|---|---|
| Flow (hot) | `#ef4444` (red) | continuous | `FLOW_COLOUR` |
| Return (cool) | `#3b82f6` (blue) | `7 4` | `RETURN_COLOUR` + `RETURN_PIPE_DASH` |
| Auxiliary | `#475569` (slate) | none | `AUX_COLOUR` |
| Print-safe flow | `#000000` | continuous | `PRINT_FLOW_COLOUR` |
| Print-safe return | `#475569` | `5 2` | `PRINT_RETURN_COLOUR` + `PRINT_RETURN_DASH` |

The `7 4` dash on return pipes is a colour-blind-safe secondary cue
so flow/return distinction is conveyed by shape even without colour.

---

## 6. Label Placement

| Label type | Position | Function |
|---|---|---|
| Equipment name (showLabels=true) | Below equipment SVG | React `<span>` below the SVG |
| Pipe annotation | 8 px standoff from pipe line | `pipeLabelProps(x, y, direction, fill)` |
| Zone labels | Above equipment area | Typography layer outside PipeLayer |

Always use `pipeLabelProps` for pipe annotations — do not use raw `y` coordinates
that happen to look correct. The 8 px standoff (`PIPE_LABEL_STANDOFF`) ensures
labels never overlap the pipe stroke even when stroke width increases in pipeTrace mode.

---

## 7. Zone Regression Test

`TopologyLayoutZones.test.ts` validates that all nine topology layout declarations
produce equipment positions within the anchor zone bounds defined in Section 2.

**Strategy (engine-driven, not source-file regex):**
The test calls `computeTopologyLayout(getTopologyLayoutDeclaration(id))` for each
topology ID, then runs `validateLayout()` on the result.  This validates actual
runtime layout output — not source text — so the test remains valid even as
templates evolve.

**KNOWN_OUT_OF_ZONE** in the test lists intentional exceptions (e.g. powerflush
boiler on the right side, header tank in loft above zone y-bounds).  Each entry
carries a comment explaining the domestic or service-context heuristic that
justifies the exception.

If a topology edit causes a zone violation the test will fail — you must either
revert the coordinate change in `topologyDeclarations.ts`, expand the zone bounds
here with justification (updating `layoutZones.ts` to match), or add the role to
KNOWN_OUT_OF_ZONE with an explanation.

---

## 8. Mobile Layout (320 × 500)

The `mobileWidth=true` path uses a 320 × 500 canvas. Equipment is stacked
vertically rather than horizontally. The above grid applies to the desktop
canvas only. Mobile layout follows the same `nodeStyle` coordinates scaled by
the `mobileWidth` CSS transform — do not author separate mobile coordinate sets.
