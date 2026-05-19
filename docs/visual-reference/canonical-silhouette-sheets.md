# Canonical Silhouette Sheets

## Purpose

Define fixed silhouette constraints for each primitive so redraw work stays consistent and physically plausible.
Each sheet maps back to `docs/atlas-canonical-mechanical-primitive-spec.md`.

## Field definitions

- **Proportions:** aspect ratio and mass balance constraints.
- **Corner-radii character:** edge sharpness profile.
- **Connection spacing bands:** acceptable spacing rhythm for service points.
- **Visual weight:** dominant mass vs detail distribution.
- **Minimum recognition details:** non-negotiable cues.
- **Allowed simplifications:** simplifications that preserve recognition.
- **Forbidden simplifications:** reductions that collapse recognisability.

## Sheets by primitive

| Primitive | Spec anchor | Proportions | Corner-radii character | Connection spacing bands | Visual weight | Minimum recognition details | Allowed simplifications | Forbidden simplifications |
|---|---|---|---|---|---|---|---|---|
| Boiler | §2 | ~1:1.35 body | Softened only | Bottom-only 3/5-port cadence | Body + lower fascia | Underside service rail order, wall-mount appliance face | Simplified fascia markings, reduced icon detail | Side/top ports, cartoon face, floating pipes |
| Unvented cylinder | §3 | ~1:2.4 | Mostly smooth cylinder shell | Top draw-off, bottom cold-in, lower-third coil pair | Tall vessel mass | Cylinder cap + lower coil connection logic | Reduced seam count, simplified safety accessories | Stratification colouring, thermal-store-like internals |
| Mixergy cylinder | §4 | Unvented family ratio | Clean smart-shell edges | Top hot-out and charging cue; bottom diffuser cue | Split-zone emphasis | Horizontal thermocline + top-down charging read | Reduced decorative elements | Sloped/unstable thermocline, industrial hose clutter |
| Thermal store | §5 | Heavier than stored-hot-water cylinder | Utility vessel edge profile | Primary and potable exchange paths visually distinct | Vessel + exchanger cue | Internal exchange cue + potable separation read | Simplified internal exchanger drawing | Visually identical to Mixergy or plain stored-hot-water vessel |
| Radiator | §6 | Wide horizontal panel | Crisp panel frame | Bottom connection pair only in modern context | Panel face with subtle depth | Groove cadence + TRV/lockshield endpoints | Reduced groove count while preserving cadence | Top-feed cue in modern scenarios, decorative rail style by default |
| Pump | §7 | Circular core in short inline segment | Round core + short flange edges | Inline inlet/outlet symmetry | Circular body dominates | Pipe enters and leaves body inline | Simplified bolt/flange detail | Floating symbol or disconnected icon |
| Magnetic filter | §8 | Vertical canister profile | Service cap + body edges | Inline side valves with service clearance | Canister and top cap dominate | Serviceable canister read | Simplified branding/details | Generic capsule lacking maintenance cues |
| Expansion vessel | §9 | Spherical/oval pressure body | Smooth pressure vessel shell | Single branch service connection | Vessel body dominates | Pressure-rated vessel read + diaphragm cue | Reduced internal split detail | Generic storage tank silhouette |
| Filling loop | §10 | Flexible hose arc between valves | Hose curve + compact valve ends | Two terminal valves only | Hose + valves balanced | Braided/service-only cue | Simplified braid frequency | Permanent rigid bridge look |
| ABV | §11 | Compact valve body with adjustment head | Small-body mechanical profile | Bridge connectors between flow/return | Body + adjustment head | Bypass valve read, spring/adjustment cue | Simplified adjustment texture | Generic inline valve without bypass identity |

## Sheet governance

- Any primitive redraw must cite its row in this file and corresponding section in `docs/atlas-canonical-mechanical-primitive-spec.md`.
- If silhouette constraints change, this file and the mechanical primitive spec must be updated together.

