# Atlas Heating System Engineering Reference Report

## 1. Executive Summary

This document serves as the authoritative engineering reference for the Atlas Functional System Engine. As Atlas transitions from a static, diagrammatic representation to a logic-first engineering graph, it requires strict boundaries between known physics, acceptable assumptions, manufacturer-specific variables, and user-provided inputs.

This report defines the mathematical models, terminology, and topological constraints for UK domestic heating and hot-water systems. It establishes what the engine can safely calculate for consumer-facing explanations, and what must remain constrained to engineering-only assumptions to avoid false precision.

## 2. Terminology and Water-Domain Definitions

Atlas must strictly categorize mass and energy flows into isolated domains. Mixing these domains in the logic graph constitutes a critical validation failure.

- **Primary heating water:** Chemically treated (inhibited) water circulating through boilers, heat pumps, radiators, and underfloor heating (UFH). Never mixes with domestic water.
- **Mains cold water:** Pressurised potable water supplied by the water undertaker at the point of entry to the dwelling.
- **Stored domestic hot water:** Mains-fed or tank-fed water that has been heated for draw-off (taps, showers).
- **Tank-fed domestic water:** Cold water supplied from a cold-water storage cistern. **Rule:** Never refer to this as "potable" or "drinking water" unless verified; Atlas must treat storage in a cistern as losing potable status unless compliance and turnover are explicitly confirmed.
- **Safety discharge water:** High-temperature or high-pressure water expelled via pressure relief valves (PRV) or temperature and pressure relief valves (T&PRV) to a tundish.
- **Condensate:** Mildly acidic water produced by condensing gas boilers; must be routed to a suitable drain.
- **Gas supply:** Natural gas or LPG routed to a combustion appliance.
- **Electrical/control signals:** Voltage or digital signals determining component state (e.g., call for heat).

## 3. Core Physics Constants and Formulas

Atlas should hard-code the following constants and utilize these established formulas.

### Water Constants

- **Specific Heat Capacity (c):** 4.18 kJ/(kg·K)
- **Useful Conversion:** 1.16 Wh/(L·K) — use this for rapid domestic kWh storage calculations.
- **Density (ρ):** For domestic modelling, assume 1 kg/L for volume/mass equivalence. In detailed engineering calculations, density varies from 999.7 kg/m³ at 10°C to 971.8 kg/m³ at 80°C.
- **Thermal Expansion:** Water volume increases by approximately 2.89% from 10°C to 80°C. For sealed system expansion vessel sizing, Atlas should use **4%** (0.04) as the engineering boundary to reflect normal design allowance beyond the pure water-expansion figure.

### Energy and Power Formulas

**Energy stored in water:**

$$
E = V \cdot c_{Wh} \cdot \Delta T
$$

Where E is energy in Wh, V is volume in Litres, c_{Wh} is 1.16, and \Delta T is the temperature rise.

**Continuous Power (Flowing Water):**

$$
P = \dot{V} \cdot c \cdot \Delta T
$$

Where P is power in kW, \dot{V} is flow rate in kg/s (or L/s), c is 4.18, and \Delta T is the flow/return temperature difference.

**Hot/Cold Blending (Usable Hot Water):**

To calculate the volume of usable water at a target shower temperature (T_m) given stored hot water (T_h) and mains cold water (T_c):

$$
V_h = V_m \left( \frac{T_m - T_c}{T_h - T_c} \right)
$$

### Radiator Output Correction

Radiators are rated at \Delta T_{50} (Flow 75°C, Return 65°C, Room 20°C). For heat pumps or weather-compensated boilers running at lower temperatures, Atlas must calculate the derated output:

$$
P_{actual} = P_{\Delta T50} \left( \frac{\Delta T_{actual}}{50} \right)^n
$$

Where \Delta T_{actual} is the Mean Water Temperature minus Room Temperature, and n is the radiator exponent (default engineering assumption **1.3** if manufacturer data is missing and no model-specific correction curve is available).

## 4. Recommended Atlas Default Values

When specific data is unavailable, Atlas should use these defaults, derived from CIBSE and standard UK practice:

- **Mains cold water temperature:** 10°C (winter baseline).
- **Stored DHW setpoint:** 60°C (Legionella prevention standard).
- **Target mixed draw-off (shower) temperature:** 40°C.
- **Standard shower flow rate:** 9 L/min.
- **Standard bath draw-off:** 100 Litres at 40°C.
- **Primary \Delta T (Gas Boiler):** 20°C.
- **Primary \Delta T (Heat Pump):** 5°C.
- **Property heat loss:** 50 W/m² (post-2000 build) to 100 W/m² (pre-1970 uninsulated).

## 5. User-Entered vs Estimated vs Manufacturer Values

| Value Category | Examples | Source / Treatment |
| --- | --- | --- |
| **User-Entered** | Property heat loss, number of bathrooms, incoming mains static pressure/flow rate, boiler model. | Hard constraints. Atlas must validate but not overwrite. |
| **Estimated** | Pipework primary volume, system friction loss, standing thermal losses, typical cylinder coil kW rating. | Derived via algorithms. Present with confidence intervals. |
| **Manufacturer** | Boiler modulation ratio, Heat pump SCOP/COP at specific flow temps, Mixergy stratification profiles. | Lookup tables. Do not guess; fail gracefully if missing. |

## 6. Component Function Graph Reference

Components in Atlas are nodes. They have input ports, output ports, and internal transfer functions.

| Component | Domains | Inputs | Outputs | Energy / Flow Effect |
| --- | --- | --- | --- | --- |
| **Boiler** | Gas, Primary | Gas, Primary Return | Primary Flow | \Delta kW > 0 (adds heat), minor friction loss |
| **Radiator** | Primary | Primary Flow | Primary Return | \Delta kW < 0 (emits heat to room), drops temperature |
| **Pump** | Primary, Elec | Primary In, Signal | Primary Out | Increases dynamic pressure (\Delta P > 0) |
| **Cylinder Coil** | Primary, DHW | Primary Flow | Primary Return | Transfers heat from Primary to Stored DHW |
| **Motorised Valve** | Primary, Elec | Primary In, Signal | Primary Out A/B | Routes flow; 0 flow on closed port |
| **Cold Storage Cistern** | Mains, Tank-fed | Mains Cold | Tank-fed Cold | Breaks pressure; output pressure = static head |

## 7. Hot-Water Storage and Cylinder Modelling

### Vented vs Unvented Cylinders

- **Vented:** Supplied by a cold-water storage cistern. Output pressure is limited by the static head (distance from cistern water level to the shower head). Calculate pressure as 0.1 bar per metre of vertical drop.
- **Unvented (Mains-fed):** Supplied directly by mains cold water. Dependent on incoming dynamic pressure and flow. **Constraint:** An unvented cylinder *cannot* create flow; if incoming mains is 12 L/min, the maximum total draw-off is 12 L/min.

### Coil Ratings and Recovery

An indirect cylinder coil rating (e.g., 15 kW) is not absolute. It relies on a high primary flow temperature (typically 80°C). If Atlas models a heat pump flowing at 50°C, the coil transfer capacity drops drastically. Atlas must derive recovery time dynamically based on primary flow temperature vs stored water temperature.

### Mixergy / Stratified Cylinders

Model as top-down heating. Instead of a uniform mass of water slowly rising in temperature, model as a growing volume of usable hot water at the target temperature.

- **Advantage:** Usable hot water is available much faster than a standard mixed cylinder. Atlas should represent this as "Volume at target temp" rather than "Average tank temp".

### Thermal Stores

Model primary water as the storage medium. Mains cold water passes through an internal coil or external plate heat exchanger (PHE).

- **Limitation:** Maximum draw-off flow rate is hard-capped by the PHE kW capacity and store temperature.

## 8. Primary Heating Circuit Modelling

### System Volume Estimation

Atlas can estimate total system volume to size expansion vessels:

- Boiler/Heat Pump: Check manufacturer data.
- Radiators: ~1.5 Litres per kW of output.
- Underfloor Heating (16mm pipe): ~2 Litres per m².
- Distribution pipework: Add 10% to the total emitter volume.

### Flow Rates

The required flow rate is strictly dictated by the heat source output and design \Delta T.

$$
\dot{V}_{kg/s} = \frac{P_{kW}}{4.18 \cdot \Delta T}
$$

Atlas must check if the required flow rate for a heat pump (\Delta T = 5^\circ\text{C}) exceeds the capacity of standard 22mm or 28mm domestic pipework compared to a boiler (\Delta T = 20^\circ\text{C}).

For Level 3 screening, pipe capacity must be derived from the nominal pipe size, assumed internal bore, and a declared maximum design velocity:

$$
\dot{V}_{pipe} = A_{internal} \cdot v_{max}
$$

Atlas must store these assumed bores and velocity limits in an explicit engineering lookup so the screening threshold is versioned and auditable rather than implied.

## 9. Expansion, Pressure, and Safety Modelling

### Sealed Primary Expansion

When water is heated, it expands. In a sealed system, an expansion vessel absorbs this volume.

**Sizing Formula:**

$$
V_v = \frac{e \cdot V_s}{1 - \frac{P_i}{P_f}}
$$

Where V_v is vessel volume, e is expansion coefficient (0.04), V_s is total system volume, P_i is initial pre-charge absolute pressure (typically 2.0 bar absolute / 1.0 bar gauge), and P_f is final PRV absolute pressure (typically 4.0 bar absolute / 3.0 bar gauge).

### Open-Vented Primary Systems

Expansion is handled by a feed and expansion (F&E) cistern. It is an open system (atmospheric pressure). Atlas must route an open vent pipe from the primary circuit to terminate over the F&E cistern. It is *not* a pressure vessel.

### Unvented Safety (Building Regs G3)

Atlas must enforce the presence of:

1. Expansion vessel or internal air bubble.
2. Pressure Reducing Valve (PRV).
3. Expansion Relief Valve.
4. Temperature & Pressure Relief Valve (T&PRV).
5. A continuous safety discharge path (Tundish -> D1 pipe -> D2 pipe).

## 10. Controls Topology Modelling

Atlas must evaluate logic routing to enable flow.

- **S-Plan:** Uses two or more 2-port motorised valves. Heating and hot water are parallel circuits. Primary flow splits. Valves possess microswitches; Atlas logic graph must require the valve to reach the "Open" state before sending the electrical "Call for Heat" to the boiler and pump.
- **Y-Plan:** Uses a single 3-port mid-position valve. Primary flow is diverted entirely to DHW, entirely to Heating, or shared.
- **Combi Boiler DHW Priority:** Internal diverter valve. When a hot tap is opened (flow switch activated), central heating flow is paused (output drops to 0 kW) and 100% of burner power routes to the internal plate heat exchanger.

## 11. Simulation Levels

To prevent computational overload and false precision, Atlas operates at four levels of depth:

1. **Level 1 Functional:** Binary topology. Are pipes connected? Are domains isolated? Is there a call for heat?
2. **Level 2 Thermal:** Steady-state energy balance. Does heat source kW >= property heat loss kW? Is the cylinder large enough for the household?
3. **Level 3 Hydraulic Assumptions:** Dynamic volume and flow. Estimates expansion vessel sizing, pipe sizing bottlenecks, and recovery times based on default friction loss factors.
4. **Level 4 Detailed Engineering:** Exact Reynolds numbers, specific pipe friction (\Delta P = f \cdot \frac{L}{D} \cdot \frac{\rho v^2}{2}), exact pump curves. *Atlas does NOT perform Level 4 calculations for customer-facing outputs.*

## 12. Validation Rules

The engine must throw an error if a topology violates these rules:

- Mains cold water connected to a closed primary circuit without a filling loop and double check valve.
- Unvented cylinder drawn without a G3 discharge path (Tundish).
- Heat pump connected to microbore (10mm) pipework where the required design flow exceeds the microbore screening limit, unless a low-loss header/buffer and secondary pump isolate the high-flow primary circuit; even then, Atlas should still warn if the emitter-side branch remains flow-limited.
- Primary flow temperature set lower than DHW target temperature for an indirect cylinder.

## 13. Customer-Safe Explanation Boundaries

Atlas can confidently present the following derived metrics to customers:

- Estimated heat-up time from cold (e.g., "~45 minutes").
- Usable hot water volume (e.g., "Provides enough water for 2 standard showers").
- System type identification and basic advantages/disadvantages.
- The function of individual components in plain English.

## 14. Engineering-Only Assumptions

The following values should remain hidden in the backend or marked strictly as "Estimates for System Design" as they rely on hidden variables:

- Exact system pressure drops (requires exact pipe lengths, bends, and fitting types).
- Boiler cycling frequency.
- Exact post-mixing draw-off temperatures (affected by uninsulated pipe heat loss and exact mains temperature fluctuations).

## 15. Source List

Atlas algorithms are constrained by the following UK authorities:

- **Building Regulations Approved Document G (G3):** Hot water supply and systems (Safety and discharge requirements).
- **Building Regulations Approved Document L:** Conservation of fuel and power (Efficiency, insulation, controls).
- **CIBSE Domestic Heating Design Guide:** Core formulas, radiator correction factors, heat loss assumptions.
- **MCS (Microgeneration Certification Scheme) MIS 3005:** Heat pump sizing and low-temperature emitter design.
- **Water Regulations Advisory Scheme (WRAS):** Fluid categories and backflow prevention.

## 16. Open Questions / Values Needing Manufacturer Data

To complete Level 3 Hydraulic modelling, Atlas requires API access or static lookup tables for the following:

- **Modulation curves:** Minimum turndown ratios for specific boiler models (e.g., Vaillant ecoTEC vs Worcester Greenstar).
- **Stratification profiles:** Mixergy's proprietary thermal charge curves based on specific heat pump inputs.
- **Pump head curves:** Residual pump head available from internal combi/system boiler pumps (Grundfos/Wilo standard OEM integrations) to calculate if an external pump or low-loss header is required.
