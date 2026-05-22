# AtlasLoopEvaluationStrategyV1

AtlasLoopEvaluationStrategyV1 defines the first closed-loop evaluation strategy for LegoTechnix.

## Scope

- Source/sink split is mandatory before loop traversal.
- Active path pruning removes inactive routes before allocation.
- Mass-flow allocation runs across active branches.
- Branch handling uses proportional resistance or design-load proxy in V1.
- Thermal evaluation is a separate pass after flow allocation.
- Merge handling uses mass-weighted temperature averaging.

## V1 constraints and warnings

- **Warning:** V1 explicitly decouples flow allocation from thermal evaluation.
- V1 does not include Hardy Cross iteration.
- V1 does not include a full pressure solver.
