# LegoTechnix Contributor Guardrails

These rules are mandatory for all future LegoTechnix engine/composer pull requests.

## Domain and engine boundaries

- Recommendation engine decides system choice.
- LegoTechnix represents and simulates the chosen system.
- LegoTechnix must not score, rank, recommend, or override the recommendation engine.
- Domain isolation is mandatory.
- Primary heating water must never become domestic hot water.
- Tank-fed domestic water must not be called potable.

## Graphics and renderer constraints

- Graphics must never decide topology or physics.
- Renderer output is always a projection of the functional graph.

## Component and connection minimum schema

No component may be added without:

- Domains
- Ports
- Role
- Behaviour
- Confidence/provenance fields

No connection may be added without:

- Domain
- `circuitId`
- Direction
- Source port
- Target port
- Length/diameter confidence, even if assumed

## Mandatory V1 model usage

- Closed loops must use AtlasLoopEvaluationStrategyV1.
- Time simulation must use AtlasSimulationTickModelV1.
- Pressure/head validation must run before loop simulation.
