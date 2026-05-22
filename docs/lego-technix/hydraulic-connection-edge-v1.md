# HydraulicConnectionEdgeV1

HydraulicConnectionEdgeV1 defines edge semantics for LegoTechnix hydraulic links.

Edges are physical pipe/connection vessels, not just graph pointers.

## Required edge semantics

- Length
- Internal diameter
- Calculated water volume
- Branch identity
- Confidence score
- Mass flow
- Velocity
- Resistance index

## V1 transport and thermal behavior

- FIFO plug-flow queue for V1 transit delay.
- Simple pipe heat-loss model.

## System responsibilities

- Contributes to total system volume.
- Contributes to expansion-related calculations.
