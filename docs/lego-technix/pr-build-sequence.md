# LegoTechnix PR Build Sequence

This document defines the controlled build order for LegoTechnix.

## PR1 — Core LegoTechnix types only

- `LegoTechnixComponentV1`
- `LegoTechnixPortV1`
- `LegoTechnixConnectionV1`
- `HydraulicDomainV1`
- Component roles
- Behaviour traits
- Domains
- Confidence/provenance model
- No renderer beyond debug JSON or very simple block preview

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
