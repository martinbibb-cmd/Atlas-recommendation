# HeatTransferComponentV1

HeatTransferComponentV1 defines a two-sided energy bridge contract for component-level thermal exchange.

## Universal evaluate() contract

Every HeatTransferComponentV1 implementation must expose a universal `evaluate()` contract with:

- Primary state in
- Primary state out
- Secondary state in
- Secondary state out
- Duration/timestep input
- Energy conservation requirement

## Component families in V1

### Empirical emitters

- Radiator
- Underfloor heating (UFH)
- Towel rail

### Static thermal-mass exchanger

- Cylinder coil

### Dynamic exchangers

- Plate heat exchanger (plate HEX)
- Thermal store heat exchanger (thermal store HEX)
