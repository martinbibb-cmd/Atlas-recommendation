# LegoTechnix Engine Laws

These laws govern all LegoTechnix engine, composer, simulator, renderer and explainer work.

1. Recommendation engine decides system choice.
   LegoTechnix represents, validates and simulates the chosen system.

2. Domains must never silently merge.
   Primary heating water, domestic water, safety discharge, gas, condensate, electrical/control and room/environment domains remain isolated unless an explicit transfer component exists.

3. Boiler water never becomes domestic hot water.
   Indirect cylinders and heat exchangers transfer heat only.

4. Components are functions, not icons.
   Every component must declare domains, ports, role, behaviours and state ownership.

5. Connections are circuit paths, not visual lines.
   Every connection must declare domain, direction, source port, target port, circuit identity, physical assumptions and confidence.

6. Pipe edges contain water volume.
   Pipe/connection edges must support length, bore/internal diameter, volume, transit delay and heat-loss assumptions.

7. Energy must balance across transfer components.
   Heat exchangers may transfer energy between domains but must not create or destroy energy.

8. Graph state is immutable during a simulation tick.
   Components read previous state and write to a next-state buffer.

9. Pressure/head validation runs before flow or thermal simulation.
   Invalid pressure regimes must block simulation.

10. Controls are sensors + logic + actuators.
    S-plan, Y-plan, TRVs, diverters and compensation must be represented as control behaviour, not visual decoration.

11. Graphics are projections only.
    Renderers must never decide topology, physics, recommendations or validation truth.

12. Human-facing outputs must expose uncertainty.
    Values must carry provenance/confidence: measured, user_entered, manufacturer, derived, estimated, assumed or unknown.

13. Legacy SVG topology visuals are not authoritative.
    They may be used for comparison only until replaced by LegoTechnix projections.
