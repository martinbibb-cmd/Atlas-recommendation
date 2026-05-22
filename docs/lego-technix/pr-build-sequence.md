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

## PR2 — First functional system template

- Regular boiler or system boiler
- Pump
- Combined feed/vent or sealed expansion
- S-plan or Y-plan controls
- Indirect cylinder coil
- Stored domestic water
- Radiators
- Return
- Filter
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
