# AtlasSimulationTickModelV1

AtlasSimulationTickModelV1 defines fixed-step simulation execution for LegoTechnix.

## Core model

- Fixed timestep.
- Immutable state during each tick.

## Evaluation order per tick

1. Control and sensor poll
2. Hydraulic resolution
3. Thermal/component evaluation
4. Environmental integration
5. State commit

## V1 behavior boundaries

- Heat-source ramp-rate concept is included.
- Volumetric delay is represented via pipe edges.
- Thermal-mass lag is represented via room and cylinder state.
- No variable timestep in V1.
- No Runge-Kutta integration in V1.
