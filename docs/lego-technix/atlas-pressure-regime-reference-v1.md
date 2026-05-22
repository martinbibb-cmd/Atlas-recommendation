# AtlasPressureRegimeReferenceV1

AtlasPressureRegimeReferenceV1 defines pressure/head constraints that must be validated before loop simulation.

## Validation sequence

- Pressure/head validation runs before loop simulation.

## Pressure regime classifications

- `open_vented_primary`
- `sealed_primary`
- `mains_pressure_dhw`
- `tank_fed_dhw`
- `thermal_store_primary`
- `separated_secondary_circuit`

## Core pressure/head rules

- Static head rule: approximately 0.1 bar per vertical metre.
- Appliance minimum static head requirements are manufacturer-specific.
- Open vent/feed and expansion rules apply where relevant.
- Neutral point concept must be represented.
- Pumping-over and air-draw risk must be checked.

## Sealed primary requirements

- Expansion vessel
- PRV
- Filling loop
- Cold fill pressure

## Unvented DHW / G3 high-level safety requirements

- Expansion accommodation
- Pressure reducing/relief chain
- T&P relief
- Tundish / D1 / D2 discharge path

## HydraulicDomain schema fields

- `pressureRegime`
- `openToAtmosphere`
- `minStaticHeadM`
- `availableStaticHeadM`
- `nominalColdPressureBar`
- `maxSafePressureBar`
- `requiresExpansionAccommodation`
- `manufacturerRequirementSource`

## Pre-flight validation outputs

- Pre-flight validation must emit explicit failures.
- Pre-flight validation must emit explicit warnings.
