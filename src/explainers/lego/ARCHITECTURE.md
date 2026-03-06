# Demo Lab Architecture

The lab models heating systems as four conceptual layers.

## 1 Heat Source
What generates thermal energy.

Examples:
- regular boiler
- system boiler
- heat pump

Traits:
- integrated pump
- integrated expansion
- integrated plate HEX

## 2 Hot Water Service
How domestic hot water is delivered.

Types:
- combi plate heat exchanger
- vented cylinder
- unvented cylinder
- Mixergy cylinder

Important rule:
Indirect cylinders are heated through a primary coil.

Boiler water does NOT become domestic hot water.

## 3 Controls Topology

Examples:
- Y-plan
- S-plan
- multi-zone S-plan
- heat pump diverter

Controls determine how primary flow is routed.

## 4 Emitters

Examples:
- radiators
- underfloor heating
- mixed systems

---

# Simulation domains

The simulator distinguishes three domains.

Fluid flow
Movement of water through pipes.

Heat transfer
Energy transfer through exchangers and coils.

Storage state
Stored energy inside cylinders or buffers.

---

# Rendering philosophy

The builder should look like real systems.

Components should visually resemble:

- boilers
- cylinders
- valves
- radiators
- manifolds

Ports should be labelled clearly to prevent wiring mistakes.

---

# System compositions

A heating system is composed of four layers, not monolithic product types.

Example — regular boiler system:
- heat source: regular boiler
- hot water service: vented cylinder
- controls: Y-plan
- emitters: radiators

Example — combi boiler:
- heat source: system boiler (with integrated plate heat exchanger)
- hot water service: combi_plate_hex
- controls: none (DHW priority handled internally)
- emitters: radiators

Note: a combi boiler is NOT a separate heat-source kind. It is a system boiler
with `traits.integratedPlateHex = true` and `hotWaterService = 'combi_plate_hex'`.

---

# Cylinder plumbing rule

Indirect cylinders have two separate circuits:

1. **Domestic side** — cold water enters at `cold_in`, hot water leaves at `hot_out`.
2. **Primary coil side** — boiler flow enters at `coil_flow`, boiler return leaves at `coil_return`.

The boiler heats the cylinder by circulating primary water through the coil.
Boiler water never becomes domestic hot water directly.

---

# Builder defaults

The default UI hides engineering detail that is not relevant to understanding the system:

- expansion vessels
- automatic bypass valves
- feed-and-vent pipe positions
- wiring centres

These may exist internally as metadata (`ApplianceTraits`) but are not rendered
in the main canvas by default.

---

# Roadmap

| PR  | Scope                                      |
|-----|--------------------------------------------|
| PR1 | Concept model + architecture (this file)   |
| PR2 | Cylinder semantics and circuit typing      |
| PR3 | Topology-driven graph generation           |
| PR4 | Interactive Play mode (outlet controls)    |
| PR5 | Add heating simulation                     |
| PR6 | Fix tablet layout and palette behaviour    |
| PR7 | Separate visual domains (flow / heat / storage) |

This file acts as the canonical architecture reference for future contributors.
