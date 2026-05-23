# LegoTechnix debug projection surface

## Projection philosophy

The debug projection surface is a read-only engineering projection of LegoTechnix engine truth.
It is intended for deterministic inspection only.
It exists to prove that canonical systems and scenario evidence can be visualised without introducing recommendation behaviour or customer UI concerns.

## Projection contracts

Projection contracts are `ProjectionNodeV1`, `ProjectionEdgeV1`, `ProjectionPortV1`, `ProjectionOverlayV1`, `ProjectionFrameV1`, and `ProjectionTimelineV1`.

These contracts project:
- graph truth
- runtime state evidence
- scenario timeline output
- hydraulic confidence evidence
- explainability causal notes

These contracts never:
- mutate runtime state
- infer topology independently from the graph
- recalculate physics
- derive recommendations

## Overlay responsibilities

Overlay responsibilities are split by authority boundary:

- **Hydraulic overlay**: active/inactive paths, flow status, bottleneck/deadhead/bypass markers.
- **Thermal overlay**: runtime edge temperatures, emitter/cylinder/room thermal state markers.
- **Confidence overlay**: hydraulic confidence report projections only (measured/inferred/assumed/unknown state mapping).
- **Explainability overlay**: causal note projections only.

## Engine truth boundaries

The projection builder is not an authority.
It consumes existing LegoTechnix graph/scenario outputs and exposes them for inspection.
If engine truth changes, the projection updates only by consuming those updated outputs.

## Renderer non-authority rule

The dev renderer under `src/features/legoTechnix/debug/` is engineering-only and non-authoritative.
It renders projection contracts, template runs, discrete frame scrubbing, and metadata inspection.
It must not add recommendation logic, layout AI, auto-routing AI, or customer portal visuals.

## Timeline semantics

`ProjectionTimelineV1` is discrete and deterministic.
Each frame maps to one runtime sample from the scenario timeline.
No interpolation is performed between frames.

## Future renderer roadmap

V1 prioritises deterministic readability:
- left-to-right flow-oriented placement
- inspectable node/edge metadata
- explicit overlay toggles

Future iterations may improve visual ergonomics while retaining non-authority boundaries and projection-only behaviour.
