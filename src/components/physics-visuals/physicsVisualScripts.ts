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
};

// ─── Lookup ────────────────────────────────────────────────────────────────────

/** Return the script for a given visual id. */
export function getVisualScript(id: PhysicsVisualId): PhysicsVisualScript {
  return SCRIPTS[id];
}

export default SCRIPTS;
