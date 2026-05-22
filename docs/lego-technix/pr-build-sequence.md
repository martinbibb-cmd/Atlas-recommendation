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

## PR3 — Closed-loop evaluation skeleton

- Source/sink split
- Active path pruning
- Branch allocation stub
- Mass-weighted merge temperatures
- No detailed hydraulic solver

## PR4 — HeatTransferComponentV1 implementations

- Radiator
- Cylinder coil
- Stored water volume
- Simple room/environment node

## PR5 — Pipe edge semantics

- Volume
- Bore
- Transit delay
- Simple loss
- Confidence

## PR6 — Pressure/head validation

- Open vented
- Sealed primary
- Mains pressure DHW
- Tank-fed DHW
- Unvented G3 validation markers

## PR7 — Basic timestep simulation

- Cylinder recovery
- Radiator heat to room
- Condensing likelihood
- Cycling risk
- Simple dashboard/debug view

## Later phases

- Visuals
- Customer explainers
- Simulator UI
- Scan integration
- PDF/portal projection
