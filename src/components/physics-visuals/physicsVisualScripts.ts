/**
 * physicsVisualScripts.ts
 *
 * Short explanatory scripts tied to each visual in the Atlas Physics Visual
 * Library. Scripts are intentionally brief and dyslexia-friendly — one clear
 * idea per bullet, short sentences, plain English.
 *
 * Scripts are currently static/demo-ready. In a later release they will be
 * signal-driven so the copy adapts to the household's actual situation.
 */

import type { PhysicsVisualId, PhysicsVisualScript } from './physicsVisualTypes';

// ─── Script objects ────────────────────────────────────────────────────────────

const SCRIPTS: Record<PhysicsVisualId, PhysicsVisualScript> = {
  driving_style: {
    title: 'How your heating system behaves',
    summary:
      'Different heating systems produce heat in very different ways. Some burst on and off. Others keep a smooth, steady rhythm.',
    bullets: [
      'A combi boiler fires hard, heats fast, then cuts out — short sharp bursts.',
      'A stored-water system runs more steadily — it builds heat gradually and stores it.',
      'A heat pump runs slowly for long periods — low output, low cycling, very efficient.',
    ],
    takeaway: 'Smooth and steady wins on efficiency. Burst firing suits fast on-demand needs.',
    focusCopy:
      'The rhythm of a heating system matters as much as its output. A combi boiler fires at full rate and cuts out repeatedly — this "bang-bang" pattern stresses components and wastes energy on each cold start. A stored-water system runs more like a car on a motorway: longer, smoother, with fewer gear changes. A heat pump takes this further: it runs for hours at very low output, never over-shooting, always condensing efficiently. When comparing systems, ask not just "how much heat?" but "how does it deliver that heat over time?"',
  },

  flow_split: {
    title: 'What happens when you run more taps',
    summary:
      'Mains pressure is shared across all outlets. The more taps open at once, the less pressure each one gets.',
    bullets: [
      'One tap open: full pressure, strong flow.',
      'Two taps open: flow is shared — each gets roughly half.',
      'Three taps open: flow drops noticeably at every outlet.',
    ],
    takeaway:
      'If your household runs several outlets at the same time, mains-fed supply needs checking.',
    focusCopy:
      'A combi boiler draws directly from the mains. There is no stored buffer — every outlet competes for the same incoming flow. In a household with two bathrooms or three or more people, simultaneous demand (a shower while someone runs a tap downstairs) regularly halves the available pressure at each outlet. A stored-water cylinder removes this dependency: it delivers at cylinder pressure, not mains pressure, so simultaneous demand does not cause the same drop-off.',
  },

  solar_mismatch: {
    title: 'Why solar and hot water timing clash',
    summary:
      'Solar panels generate electricity when the sun is strongest — around midday. But households need hot water early morning and in the evening.',
    bullets: [
      'Peak generation: midday.',
      'Peak demand: 6–8 am and 5–8 pm.',
      'There is a gap between when you generate and when you need it.',
    ],
    takeaway:
      'Storage — either a battery or a hot water cylinder — bridges that gap and captures free solar energy.',
    focusCopy:
      'Without storage, solar electricity generated at midday either gets exported to the grid at a low rate or goes unused. A hot water cylinder acts as a cheap thermal battery: it can be instructed to heat up during peak generation hours, storing that energy for use in the morning and evening peaks. This "solar divert" strategy can significantly cut heating bills without needing a separate battery installation. A heat pump with an appropriately sized cylinder amplifies this effect further, because it uses electricity more efficiently than a direct electric immersion.',
  },

  cylinder_charge: {
    title: 'How a stored hot water system works',
    summary:
      'A cylinder fills with heat during quiet periods. That stored energy is ready when the household calls for hot water.',
    bullets: [
      'Energy in: the boiler or heat pump heats the cylinder.',
      'Stored: hot water sits in the cylinder ready to use.',
      'Energy out: a shower or tap draws down the stored heat.',
    ],
    takeaway:
      'A well-sized cylinder removes the rush — no waiting for a boiler to catch up under demand.',
    focusCopy:
      'A stored-water system decouples generation from demand. The heat source (boiler or heat pump) can run at the most efficient time — overnight on cheap tariffs, or during solar generation — and the cylinder holds that energy for use whenever the household needs it. This is why cylinder sizing matters: too small and it runs out during peak use; too large and reheating takes longer and loses more heat through the jacket. A Mixergy-style cylinder improves on this by charging from the top down, so even a partially charged cylinder delivers full-temperature water immediately.',
  },

  cylinder_charge_standard: {
    title: 'How a standard stored hot water cylinder charges',
    summary:
      'A standard cylinder warms progressively through its full body as it charges — the whole stored volume heats up, top first.',
    bullets: [
      'Energy in: the heat source warms the entire water volume.',
      'The top warms slightly ahead of the bottom, but the whole body charges together.',
      'Discharge draws from the top, depleting the overall stored volume.',
    ],
    takeaway:
      'A standard cylinder delivers reliable stored hot water — sizing and insulation determine how long the charge lasts.',
    focusCopy:
      'In a standard open-vented or unvented cylinder, the heat source (boiler coil or immersion element) warms the bulk of the stored water. Thermally, the top layer is always hottest — natural stratification means lighter warm water rises — but the cylinder charges as a body rather than concentrating heat in one layer. This means a partially charged standard cylinder still delivers warm water, but not at full temperature. Sizing is everything: a too-small cylinder runs out under simultaneous demand; a too-large cylinder takes longer to reheat and loses more heat through the jacket.',
  },

  cylinder_charge_mixergy: {
    title: 'How a Mixergy cylinder charges from the top',
    summary:
      'A Mixergy cylinder concentrates heat at the top. The hot boundary moves downward as charging continues — so usable hot water is ready immediately, even when only partially charged.',
    bullets: [
      'Energy in: heat is directed to the top of the cylinder.',
      'The hot/warm boundary descends as charge increases.',
      'Even at 40% charge, the top volume delivers full-temperature water.',
    ],
    takeaway:
      'Stratified charging means more usable hot water from less energy — ideal for solar divert and off-peak tariffs.',
    focusCopy:
      'A Mixergy cylinder uses a mixing valve and targeted heat injection to keep the upper portion of the cylinder at full temperature, while the lower portion remains cooler until needed. This stratified approach is the opposite of bulk heating: rather than slowly raising the temperature of the whole volume, it builds a sharp hot/cold boundary and moves it downward. The practical benefit is that at 40–50% charge a Mixergy cylinder can still deliver a full-temperature shower, whereas a standard cylinder at the same charge level would deliver lukewarm water. For solar divert, this means capturing a shorter midday solar burst still gives a usable result for the evening.',
  },

  heat_particles: {
    title: 'How heat moves through your home',
    summary:
      'Heat travels in two ways: conduction through walls and convection through air movement.',
    bullets: [
      'Conduction: heat passes directly through solid material.',
      'Convection: warm air rises, drags cold air in, and creates a loop.',
      'Better insulation slows both down.',
    ],
    takeaway: 'Stopping heat escaping is the first step — before choosing a new heating system.',
    focusCopy:
      'In an uninsulated cavity wall, heat conducts steadily outward through the brick leaves while the air gap provides only partial resistance. Add insulation and you disrupt conductive pathways and suppress convection within the cavity — both loss routes slow significantly. Solid masonry walls have no cavity at all, so conduction is the dominant pathway and losses per degree-day are higher. Understanding which mechanism dominates in a given wall type is how you prioritise: solid walls and roof together account for the majority of fabric heat loss in pre-1940 UK housing stock.',
  },

  bees_vs_tortoise: {
    title: 'Burst firing vs steady state',
    summary:
      'A combi boiler fires in short intense bursts like bees. A heat pump runs long and slow like a tortoise.',
    bullets: [
      'Burst firing: high temperature for a short time.',
      'Steady state: low temperature for a long time.',
      'Both heat the home — but steady state is more efficient for most buildings.',
    ],
    takeaway: 'Heat pumps are most efficient when the building allows slow steady warmth.',
  },

  sponge: {
    title: 'Thermal mass — your home as a sponge',
    summary:
      'A heavy building absorbs heat slowly and gives it back slowly. Like a sponge filling with water.',
    bullets: [
      'High mass: stone, brick, solid floors — soaks up heat, releases it over hours.',
      'Low mass: lightweight timber, thin walls — responds quickly but cools fast.',
      'High mass suits slow heating systems like heat pumps.',
    ],
    takeaway: 'Know your building type before choosing how to heat it.',
  },

  u_gauge: {
    title: 'Pressure balance in a sealed heating circuit',
    summary:
      'A sealed heating system keeps pressure balanced between the flow pipe and the return pipe.',
    bullets: [
      'Flow side: hot water pushed out at higher pressure.',
      'Return side: cooler water pulled back at lower pressure.',
      'Too much difference means something is restricting the circuit.',
    ],
    takeaway: 'Correct pressure balance keeps radiators heating evenly from top to bottom.',
  },

  trv_flow: {
    title: 'How a thermostatic radiator valve works',
    summary:
      'A TRV senses room temperature and gradually closes off flow to the radiator as the room warms up.',
    bullets: [
      'Room cold: valve opens fully — maximum heat.',
      'Room warming: valve begins to restrict flow.',
      'Room at target: valve nearly closed — very little heat entering.',
    ],
    takeaway:
      'TRVs prevent overheating room by room — but they work best when the boiler flow temperature is also set correctly.',
  },

  boiler_cycling: {
    title: 'Why an oversized boiler cycles too much',
    summary:
      'An oversized boiler reaches setpoint too quickly. It fires in short intense bursts, then cuts out — only to restart moments later.',
    bullets: [
      'Oversized output exceeds what the building needs.',
      'Each short burst stresses the heat exchanger and burner.',
      'Frequent cold-starts reduce efficiency and shorten component life.',
    ],
    takeaway: 'A correctly sized boiler modulates more steadily and lasts longer.',
  },

  flow_restriction: {
    title: 'What happens when mains flow rate is too low',
    summary:
      'A combi boiler needs a minimum flow rate to ignite and stay stable. When mains pressure is low, supply lags behind demand.',
    bullets: [
      'Combi minimum ignition threshold: typically 7–10 L/min.',
      'Low mains flow → boiler cannot maintain stable output.',
      'A stored cylinder absorbs the gap — it delivers at cylinder pressure, not mains.',
    ],
    takeaway: 'Low mains flow is a hard limit for combi DHW performance. A cylinder removes that dependency.',
  },

  radiator_upgrade: {
    title: 'How bigger radiators lower flow temperature',
    summary:
      'Larger radiators emit the same heat at a lower water temperature. A lower flow temperature lets the boiler condense, recovering extra energy.',
    bullets: [
      'Standard radiators need ~70–75 °C flow to meet design heat load.',
      'Upsized radiators can meet the same load at ~50 °C — well below the ~55 °C condensing threshold.',
      'Below ~55 °C return temperature, flue gases condense and release latent heat — efficiency improves up to 15 %.',
    ],
    takeaway: 'Upsizing radiators is one of the most cost-effective efficiency upgrades — and a prerequisite for heat pump readiness.',
  },

  controls_upgrade: {
    title: 'Better controls — steadier, more efficient running',
    summary:
      'Fixed high flow temperatures force the boiler into blocky on/off cycling. Lower, steadier settings let it modulate more smoothly.',
    bullets: [
      'Fixed higher flow: boiler overshoots, cuts out, restarts — high cycling.',
      'Lower steady running: smaller, less frequent adjustments — stays in condensing range longer.',
      'No hardware change needed — just better settings or a load compensator.',
    ],
    takeaway: 'Optimising boiler controls costs almost nothing and can recover several percent of seasonal efficiency.',
  },
};

// ─── Lookup ────────────────────────────────────────────────────────────────────

/** Return the script for a given visual id. */
export function getVisualScript(id: PhysicsVisualId): PhysicsVisualScript {
  return SCRIPTS[id];
}

export default SCRIPTS;
