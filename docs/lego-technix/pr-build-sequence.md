# LegoTechnix PR Build Sequence

This document defines the controlled build order for LegoTechnix.

## PR1 — Core graph contracts and validation skeleton

- Core graph contracts (`LegoTechnixGraphV1`, component/port/connection/hydraulic-domain types)
- Validation skeleton for structural integrity and domain separation rules
- LegoTechnix engine laws
- Tiny regular-boiler fixture graph for language proof
- `LegoTechnixComponentV1`
- `LegoTechnixPortV1`
- `LegoTechnixConnectionV1`
- `HydraulicDomainV1`
- Component roles
- Behaviour traits
- Domains
- Confidence/provenance model
- No simulator
- No visuals
- No app route
- No topology renderer replacement
- No recommendation changes

## PR2 — Circuit/domain path validation

- CircuitId registry
- Active circuit path definitions
- Primary source/sink role declarations
- Return-path validation back to source
- Branch/merge semantics checks
- Inline continuity checks for pump/filter/valves
- Exchanger boundary validation across domains
- Domestic cold/store/hot separation from primary circuit
- Validation only

## PR3 — Pressure regime and pre-flight validation

- HydraulicDomainV1 pressure-regime validation
- Open vented primary checks
- Sealed primary checks
- Mains-pressure DHW checks
- Tank-fed DHW checks
- Unvented/G3 safety marker checks
- Validation runs before loop/thermal simulation
- No simulator
- No heat-transfer maths

## PR4 — Closed-loop evaluation skeleton

- Source/sink split
- Active path pruning
- Branch allocation stub
- Mass-weighted merge temperatures
- No detailed hydraulic solver

## PR5 — HeatTransferComponentV1 implementations

- Radiator
- Cylinder coil
- Stored water volume
- Simple room/environment node

## PR6 — Pipe edge semantics

- Volume
- Bore
- Transit delay
- Simple loss
- Confidence

## PR7 — Basic timestep simulation

- Cylinder recovery
- Radiator heat to room
- Condensing likelihood
- Cycling risk
- Simple dashboard/debug view

## PR21 — Engine explainability/report layer

- Engine explainability report layer over scenario/confidence/DHW outputs
- Structured non-visual “what happened and why” wording for future tooling
- No visuals
- No UI/routes
- No recommendation changes
- Bridge to future portal/PDF/simulator wording
- The explainability report is the first sanctioned source for future customer-facing explanatory copy, but it must not decide recommendations

## Later phases

- Visuals
- Customer explainers
- Simulator UI
- Scan integration
- PDF/portal projection
