# Atlas Canonical Mechanical Primitive Specification

## Goal

Define exact visual geometry, proportions, connection locations, and simplification rules for every heating-system primitive.
The renderer must not improvise appliance shapes.
Each primitive must behave like a controlled design-system component with fixed mechanical rules.

## 1. General Rules

All primitives must:

- use consistent line weights
- use consistent corner radii
- use consistent port sizing
- use consistent pipe attachment logic
- expose canonical connection points
- expose semantic port roles
- maintain recognisable silhouette without labels

Abstraction target:

- simplified installer brochure product render

Not allowed:

- abstract icon
- P&ID symbol
- engineering CAD
- infographic capsule

## 2. Boiler Specification

Canonical silhouette:

- tall vertical wall-mounted rectangle
- approx aspect ratio 1 : 1.35
- subtle lower fascia/control panel
- optional small flame/status cue
- slightly softened corners only

Ports:

- all ports exit from bottom edge only

Required ports:

- CH flow
- CH return
- gas
- cold mains in (combi only)
- DHW out (combi only)

Connection order (left → right):

- combi: CH return | cold mains | gas | DHW out | CH flow
- system/regular: CH return | gas | CH flow

Rules:

- no side/top ports
- no floating pipes
- no cartoon boiler face
- no excessive internal detail

## 3. Unvented Cylinder Specification

Canonical silhouette:

- vertical cylinder
- flat or slightly domed top
- approx aspect ratio 1 : 2.4
- mounted standing upright
- neutral light-grey/silver body
- subtle casing seams allowed

Required ports:

- top: DHW hot draw-off
- bottom: mains cold in
- lower-third side: coil flow in and coil return out

Optional:

- immersion boss
- TPRV/discharge connection
- 2-port valve cue

Rules:

- standard unvented cylinder is visually uniform
- no thermocline
- no stratification layers
- no thermal-store colouring

## 4. Mixergy Cylinder Specification

Canonical silhouette:

- same base form as unvented cylinder
- cleaner/smarter appearance
- subtle smart-device styling allowed

Required visual distinction:

- sharp thermocline boundary
- upper hot zone
- lower cool zone

Ports:

- top: DHW hot out and charging/top-heating cue
- bottom: cold mains in via diffuser cue

Rules:

- potable DHW only
- not thermal store
- no spaghetti pipework
- no external industrial hoses
- thermocline must be horizontal and stable

## 5. Thermal Store Specification

Canonical silhouette:

- larger/heavier vessel appearance
- less consumer-appliance styling
- clearly different from Mixergy

Internal requirement:

- visible coil or plate heat-exchanger cue

Rules:

- primary/system water stored in body
- potable water visually separate
- never render like stratified DHW cylinder

Required paths:

- primary heating flow/return
- separate DHW heat-exchange path

## 6. Radiator Specification

Canonical silhouette:

- UK panel radiator
- horizontal rectangle
- Type 22 style depth implied
- vertical convection grooves

Connections:

- bottom only in modern systems

Allowed:

- opposite-end bottom
- same-side bottom

Not allowed:

- top-fed modern radiator
- decorative towel-rail styling unless explicit

Valves:

- TRV on one lower corner
- lockshield on opposite lower corner

## 7. Circulation Pump Specification

Canonical silhouette:

- Grundfos/Wilo style domestic circulator
- circular pump body
- short inline valve flanges each side

Rules:

- always visibly inline
- pipe must enter and leave body
- orientation must match pipe axis

Not allowed:

- isolated P&ID circle symbol
- floating pump icon

## 8. Magnetic Filter Specification

Canonical silhouette:

- MagnaClean/TF1 style vertical filter body
- service cap on top
- inline valves each side

Placement:

- return before boiler

Rules:

- should visually read as serviceable component
- not generic capsule

## 9. Expansion Vessel Specification

Canonical silhouette:

- spherical or oval vessel
- red/grey pressure-vessel appearance
- wall-mounted or bracketed cue

Internal cue:

- diaphragm split

Rules:

- not generic storage tank
- visually pressure-rated

## 10. Filling Loop Specification

Canonical silhouette:

- braided flexible hose
- valve each end

Rules:

- default disconnected/isolated state
- should visually read temporary/service-only
- not permanent pipe bridge

## 11. ABV Specification

Canonical silhouette:

- compact brass bypass valve
- angled adjustment cap/head

Placement:

- bridge between flow and return

Rules:

- not generic valve symbol
- should visually read spring-loaded bypass device

## 12. Pipework Specification

Pipes:

- straight disciplined routing
- 90° or gentle-radius bends only
- minimal crossings

Hierarchy:

- primary flow
- primary return
- potable hot
- mains cold
- discharge/safety

Rules:

- pipework must look intentional
- no spaghetti
- no decorative geometry

## 13. Success Condition

Without labels:

- homeowner recognises equipment category
- installer respects plausibility
- system reads like domestic heating installation
- diagrams feel calm and intentional

Not:

- abstract process art
