import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../../contracts/CustomerSummaryV1';
import type {
  WelcomePackValidationFixture,
  WelcomePackValidationFixtureId,
} from './WelcomePackValidationFixtureV1';

// ─── Shared lifecycle builder ─────────────────────────────────────────────────

function buildLifecycle(
  type: 'combi' | 'system' | 'regular',
  ageYears: number,
  condition: 'good' | 'average' | 'worn' | 'unknown',
  summary: string,
): AtlasDecisionV1['lifecycle'] {
  return {
    currentSystem: { type, ageYears, condition },
    expectedLifespan: {
      typicalRangeYears: [10, 15],
      adjustedRangeYears: condition === 'worn' ? [8, 12] : [10, 15],
    },
    influencingFactors: {
      waterQuality: 'unknown',
      scaleRisk: ageYears > 14 ? 'high' : 'medium',
      usageIntensity: 'medium',
      maintenanceLevel: 'unknown',
    },
    riskIndicators: ageYears > 12 ? ['Age approaching upper end of expected lifespan'] : [],
    summary,
  };
}

function buildDecision(
  summary: CustomerSummaryV1,
  overrides: Partial<AtlasDecisionV1> = {},
): AtlasDecisionV1 {
  return {
    recommendedScenarioId: summary.recommendedScenarioId,
    headline: summary.headline,
    summary: summary.fitNarrative,
    keyReasons: [...summary.whyThisWins],
    avoidedRisks: [...summary.whatThisAvoids],
    dayToDayOutcomes: ['Day-to-day guidance is available.'],
    requiredWorks: ['Installation scope is defined.'],
    compatibilityWarnings: [...summary.requiredChecks],
    includedItems: [...summary.includedNow],
    quoteScope: [],
    futureUpgradePaths: [...summary.futureReady],
    supportingFacts: [],
    lifecycle: buildLifecycle('combi', 10, 'average', 'Lifecycle data not available.'),
    ...overrides,
  };
}

// ─── Fixture 1: Oversized combi replacement ───────────────────────────────────

const oversizedCombiSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'combi',
  recommendedSystemLabel: 'Combi boiler — correctly sized',
  headline: 'A correctly-sized combi replacement is the right fit for this home.',
  plainEnglishDecision:
    'The existing boiler is significantly oversized for this property, causing short cycling and poor efficiency. A correctly-sized replacement will run more consistently and use less gas.',
  whyThisWins: [
    'Correct modulation range eliminates short-cycling losses.',
    'Properly sized unit matches peak heat demand without overshooting.',
  ],
  whatThisAvoids: [
    'Avoids continued short-cycling degradation from an oversized boiler.',
    'Avoids unnecessary wear on heat exchanger from repeated cold starts.',
  ],
  includedNow: ['Correctly-sized combi boiler', 'Controls commissioning and setup'],
  requiredChecks: ['Confirm heat loss calculation before sizing', 'Check system pipework condition'],
  optionalUpgrades: ['Magnetic system filter'],
  futureReady: ['Future weather compensation controls'],
  confidenceNotes: ['Sizing is based on surveyed heat loss and property type.'],
  hardConstraints: [],
  performancePenalties: ['Oversized boiler cycling reduces effective seasonal efficiency by up to 15 %.'],
  fitNarrative:
    'A correctly-sized combi boiler is recommended to eliminate short-cycling losses from the existing oversized unit.',
};

const oversizedCombiFixture: WelcomePackValidationFixture = {
  id: 'oversized_combi_replacement',
  label: 'Oversized combi replacement',
  description:
    'Customer replacing an oversized combi. Key challenge: explaining why a smaller boiler is better without alarming them.',
  customerConcerns: [
    'Why do I need a smaller boiler — surely bigger means more powerful?',
    'Will the new boiler keep us warm in winter?',
    'The engineer said our current one was fine — why are you recommending a change?',
  ],
  emotionalTrustConcerns: [
    'Customer may feel their previous installer made an error — handle with care.',
    'Risk of customer anchoring on kW output as a quality signal.',
    'Customer may distrust recommendation if it sounds like a downgrade.',
  ],
  accessibilityNotes: ['No specific accessibility requirements reported.'],
  propertyConstraints: ['3-bed semi-detached', 'Estimated peak heat loss: 7 kW', 'Existing boiler rated at 35 kW'],
  customerLanguageSamples: [
    '"I just want a powerful boiler that keeps us warm."',
    '"The last engineer put in a big one and said it would last forever."',
    '"Why would you put in something smaller?"',
  ],
  knownMisconceptions: [
    'Customer believes higher kW output = better performance.',
    'Customer does not understand short cycling or its impact on efficiency.',
  ],
  customerSummary: oversizedCombiSummary,
  atlasDecision: buildDecision(oversizedCombiSummary, {
    dayToDayOutcomes: ['Quieter, more consistent heating', 'No more rapid on–off cycling'],
    requiredWorks: ['Replace oversized boiler with correctly-sized unit', 'Commission controls for stable modulation'],
    lifecycle: buildLifecycle('combi', 16, 'worn', 'Existing oversized combi at end of expected lifespan.'),
    performancePenalties: ['Continued short-cycling reduces effective seasonal efficiency by up to 15 %.'],
  }),
  scenarios: [
    {
      scenarioId: 'combi',
      system: { type: 'combi', summary: 'Combi boiler — correctly sized' },
      performance: { hotWater: 'good', heating: 'very_good', efficiency: 'very_good', reliability: 'very_good' },
      keyBenefits: ['Stable modulation', 'No short cycling', 'Improved seasonal efficiency'],
      keyConstraints: ['Heat loss survey must precede sizing decision'],
      dayToDayOutcomes: ['Quieter, more consistent heating'],
      requiredWorks: ['Replace with correctly-sized boiler'],
      upgradePaths: ['Weather compensation controls'],
      physicsFlags: {},
    },
  ],
  userConcernTags: ['boiler_sizing', 'cycling', 'modulation'],
  propertyConstraintTags: ['oversized_boiler'],
  accessibilityPreferences: { prefersPrint: false, includeTechnicalAppendix: false, profiles: [] },
};

// ─── Fixture 2: Low-pressure family home ─────────────────────────────────────

const lowPressureFamilySummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system_unvented',
  recommendedSystemLabel: 'System boiler with stored hot water',
  headline: 'Stored hot water is the right fit for this home.',
  plainEnglishDecision:
    'Low mains pressure means on-demand hot water cannot reliably serve a busy family. Stored hot water removes this constraint and gives consistent pressure to all outlets.',
  whyThisWins: [
    'Stored hot water is not constrained by mains flow rate.',
    'All showers and outlets receive consistent pressure regardless of concurrent use.',
  ],
  whatThisAvoids: [
    'Avoids disappointing flow when multiple outlets are used at once.',
    'Avoids continued pressure problems with a combi in a low-pressure area.',
  ],
  includedNow: ['System boiler', 'Stored hot-water cylinder', 'Pressure-tolerant controls'],
  requiredChecks: ['Confirm mains pressure and flow rate', 'Confirm cylinder location'],
  optionalUpgrades: ['Shower pump for additional boost if required'],
  futureReady: ['Future solar diverter connection'],
  confidenceNotes: ['Stored hot water is selected because surveyed mains pressure is below combi threshold.'],
  hardConstraints: ['On-demand hot water delivery is unreliable at this mains pressure.'],
  performancePenalties: ['Mains pressure limits on-demand delivery to inadequate flow rates.'],
  fitNarrative:
    'Stored hot water is recommended because this property has insufficient mains pressure for reliable on-demand delivery.',
};

const lowPressureFamilyFixture: WelcomePackValidationFixture = {
  id: 'low_pressure_family_home',
  label: 'Low-pressure family home',
  description:
    'Family of 4 with multiple bathrooms, low mains pressure. Challenge: explaining why they cannot have a combi without blaming the house.',
  customerConcerns: [
    'We have 4 people in the house — will hot water run out?',
    'The shower pressure is already low — will this fix it?',
    'Our neighbour has a combi and it works fine for them.',
  ],
  emotionalTrustConcerns: [
    'Customer may feel embarrassed that their supply is worse than neighbours.',
    'Customer worried they are being sold a more expensive system unnecessarily.',
    'Risk of resentment if pressure problem is not fully resolved by the solution.',
  ],
  accessibilityNotes: ['Customer has young children — simple, calm language required.'],
  propertyConstraints: [
    '4-bed semi-detached',
    'Mains pressure: 0.8 bar (below 1.5 bar combi threshold)',
    '2 bathrooms, 3 occupants regularly showering concurrently',
  ],
  customerLanguageSamples: [
    '"Why can\'t we just have a combi like everyone else?"',
    '"Is there something wrong with our supply?"',
    '"We want proper showers, not a trickle."',
  ],
  knownMisconceptions: [
    'Customer believes a more powerful combi would overcome the pressure problem.',
    'Customer does not understand that stored water bypasses the mains pressure constraint.',
  ],
  customerSummary: lowPressureFamilySummary,
  atlasDecision: buildDecision(lowPressureFamilySummary, {
    dayToDayOutcomes: ['Consistent hot water to all outlets simultaneously', 'No pressure drop during concurrent use'],
    requiredWorks: ['Install system boiler and stored hot-water cylinder', 'Commission thermostatic controls'],
    lifecycle: buildLifecycle('combi', 13, 'worn', 'Existing combi worn and unsuited to property pressure constraints.'),
    hardConstraints: ['On-demand hot water cannot meet simultaneous demand at this mains pressure.'],
    performancePenalties: ['Mains pressure at 0.8 bar is below minimum combi threshold.'],
    compatibilityWarnings: ['Hydraulic survey required before cylinder sizing'],
  }),
  scenarios: [
    {
      scenarioId: 'system_unvented',
      system: { type: 'system', summary: 'System boiler with stored hot water' },
      performance: { hotWater: 'very_good', heating: 'very_good', efficiency: 'good', reliability: 'very_good' },
      keyBenefits: ['Stored water independent of mains pressure', 'Concurrent use without pressure drop'],
      keyConstraints: ['Cylinder location required', 'Hydraulic check needed'],
      dayToDayOutcomes: ['Consistent hot water regardless of concurrent use'],
      requiredWorks: ['Install system boiler and cylinder'],
      upgradePaths: ['Solar diverter', 'Shower pump if additional boost needed'],
      physicsFlags: { pressureConstraint: true, hydraulicLimit: true },
    },
  ],
  userConcernTags: ['pressure', 'flow', 'simultaneous_use', 'stored'],
  propertyConstraintTags: ['pressure', 'flow', 'hydraulic'],
  accessibilityPreferences: { prefersPrint: false, includeTechnicalAppendix: false, profiles: [] },
};

// ─── Fixture 3: Elderly homeowner replacing gravity/open-vent system ──────────

const elderlyGravitySummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system_unvented',
  recommendedSystemLabel: 'System boiler with stored hot water',
  headline: 'Replacing the gravity hot-water system is the right next step.',
  plainEnglishDecision:
    'The existing tank-fed hot-water system is old and inefficient. A modern system boiler with stored hot water gives the same reliable hot water without the cold loft tanks.',
  whyThisWins: [
    'Removes cold loft tanks and associated freezing risk.',
    'Better hot-water recovery than the existing gravity setup.',
    'Modern thermostatic controls improve safety and predictability.',
  ],
  whatThisAvoids: [
    'Avoids freezing risk from loft tanks in cold weather.',
    'Avoids slow recovery time from the existing tank-fed arrangement.',
  ],
  includedNow: ['System boiler', 'Stored hot-water cylinder', 'Thermostatic controls', 'Removal of loft tanks'],
  requiredChecks: ['Confirm existing distribution pipework sizing', 'Check for expansion vessel condition'],
  optionalUpgrades: ['Programmable room thermostat'],
  futureReady: ['Future smart controls'],
  confidenceNotes: ['Recommendation based on surveyed system age and tank condition.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative:
    'A system boiler with stored hot water replaces the ageing tank-fed arrangement, removing freezing risk and improving recovery time.',
};

const elderlyGravityFixture: WelcomePackValidationFixture = {
  id: 'elderly_gravity_replacement',
  label: 'Elderly homeowner — tank-fed hot-water system replacement',
  description:
    'Retired homeowner in their 70s replacing a 30-year-old gravity/open-vent system. Challenge: calm explanation of a significant change without creating anxiety.',
  customerConcerns: [
    'Will it be reliable — the old one lasted 30 years?',
    'I do not want a lot of disruption or noise during installation.',
    'I do not understand all the modern controls — I just want warm rooms and hot water.',
    'Will my existing radiators still work?',
  ],
  emotionalTrustConcerns: [
    'Customer has deep familiarity with the old system — change feels risky.',
    'Anxiety about disruption during a multi-day installation.',
    'Risk of over-complicating controls explanation and creating distrust.',
    'Customer may feel patronised if explanation is too simplified.',
  ],
  accessibilityNotes: [
    'Larger print preferred.',
    'Simple diagrams preferred over dense text.',
    'Customer requests a copy to share with family before deciding.',
  ],
  propertyConstraints: [
    '3-bed detached, 1960s construction',
    'Existing gravity-fed open-vent system with header tanks in loft',
    'Original distribution pipework — may require some upgrades',
    '70+ year old homeowner, single occupant',
  ],
  customerLanguageSamples: [
    '"The old one never let me down — I just want the same but new."',
    '"I do not want anything complicated."',
    '"Can you write it all down so I can show my son?"',
    '"Will the radiators still come on the same way?"',
  ],
  knownMisconceptions: [
    'Customer believes older larger systems are inherently more reliable.',
    'Customer does not know what "open-vent" or "gravity" means — avoid these terms.',
  ],
  customerSummary: elderlyGravitySummary,
  atlasDecision: buildDecision(elderlyGravitySummary, {
    dayToDayOutcomes: ['Reliable hot water without loft tanks', 'Simple thermostat control as before'],
    requiredWorks: ['Remove loft tanks', 'Install system boiler and cylinder', 'Commission thermostatic controls'],
    lifecycle: buildLifecycle('system', 30, 'worn', 'Existing tank-fed hot-water system significantly beyond expected lifespan.'),
    compatibilityWarnings: ['Existing distribution pipework condition to be confirmed on site'],
  }),
  scenarios: [
    {
      scenarioId: 'system_unvented',
      system: { type: 'system', summary: 'System boiler with stored hot water' },
      performance: { hotWater: 'very_good', heating: 'very_good', efficiency: 'very_good', reliability: 'very_good' },
      keyBenefits: ['Removes loft tanks and freezing risk', 'Familiar operation — same radiators and thermostat'],
      keyConstraints: ['Distribution pipework survey required'],
      dayToDayOutcomes: ['Reliable hot water', 'Simple familiar controls'],
      requiredWorks: ['Remove tanks', 'Install boiler and cylinder'],
      upgradePaths: ['Smart controls in future if desired'],
      physicsFlags: {},
    },
  ],
  userConcernTags: ['reliability', 'disruption', 'stored', 'hot_water_storage'],
  propertyConstraintTags: ['old_pipework', 'gravity_system'],
  accessibilityPreferences: { prefersPrint: true, includeTechnicalAppendix: false, profiles: [] },
};

// ─── Fixture 4: Skeptical "heat pumps don't work" customer ───────────────────

const skepticalHeatPumpSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'ashp',
  recommendedSystemLabel: 'Air source heat pump with stored hot water',
  headline: 'A heat pump is the right fit for this home, based on what Atlas found.',
  plainEnglishDecision:
    'This property has the insulation levels, emitter sizes, and space needed for a heat pump to work as Atlas calculated. The recommendation is based on physics, not assumptions.',
  whyThisWins: [
    'Surveyed insulation and emitter output supports low-temperature operation.',
    'Property heat loss is within the output range of the recommended heat pump.',
    'Stored hot water avoids the cylinder temperature limitation of older heat pump myths.',
  ],
  whatThisAvoids: [
    'Avoids another boiler cycle that increases long-term running cost.',
    'Avoids locking into a fossil-fuel system when the property is already heat-pump-ready.',
  ],
  includedNow: ['Air source heat pump', 'Stored hot-water cylinder', 'Compensation controls'],
  requiredChecks: ['Emitter output at design flow temperature to be confirmed'],
  optionalUpgrades: ['Smart tariff scheduling'],
  futureReady: ['Tariff optimisation and battery storage'],
  confidenceNotes: ['Recommendation is based on measured heat loss and surveyed emitter output.'],
  hardConstraints: [],
  performancePenalties: ['If flow temperature is set too high by the installer, COP will fall significantly.'],
  fitNarrative:
    'A heat pump is recommended because this property meets the physical criteria: adequate insulation, correctly-sized emitters, and a heat loss within the system output range.',
};

const skepticalHeatPumpFixture: WelcomePackValidationFixture = {
  id: 'skeptical_heat_pump_customer',
  label: 'Skeptical "heat pumps don\'t work" customer',
  description:
    'Customer who has read negative articles about heat pumps and doubts they work in the UK climate. Challenge: trust recovery through physics evidence, not marketing.',
  customerConcerns: [
    'I have read they do not work in cold weather.',
    'My friend had one and it broke and was expensive to fix.',
    'They say your bills go up — gas is cheaper than electricity.',
    'I do not want to be a guinea pig for new technology.',
  ],
  emotionalTrustConcerns: [
    'High scepticism — any marketing language will increase distrust.',
    'Customer has specific anecdotal evidence from their social network.',
    'Risk: overselling will damage trust permanently.',
    'Customer needs physics evidence, not reassurance phrases.',
  ],
  accessibilityNotes: ['Customer wants the technical detail — do not over-simplify.'],
  propertyConstraints: [
    '4-bed detached, 1980s construction, cavity wall insulation present',
    'Loft insulation: 250 mm',
    'Measured heat loss: 9 kW at design conditions',
    'Emitter survey shows adequate output at 45 °C flow temperature',
  ],
  customerLanguageSamples: [
    '"I have seen the programmes — heat pumps do not work here."',
    '"Why should I trust this recommendation?"',
    '"Show me the actual numbers, not the sales pitch."',
    '"What happens if it goes wrong in January?"',
  ],
  knownMisconceptions: [
    'Customer believes heat pumps stop working below freezing.',
    'Customer conflates running cost with energy consumption (ignoring COP).',
    'Customer believes early generation installation failures apply to current products.',
  ],
  customerSummary: skepticalHeatPumpSummary,
  atlasDecision: buildDecision(skepticalHeatPumpSummary, {
    dayToDayOutcomes: ['Consistent warmth at lower flow temperature', 'Quiet outdoor unit operation'],
    requiredWorks: ['Install heat pump and stored cylinder', 'Commission at correct flow temperature'],
    lifecycle: buildLifecycle('system', 17, 'worn', 'Existing system boiler beyond expected lifespan.'),
    compatibilityWarnings: ['Emitter output must be confirmed at 45 °C before commissioning'],
    supportingFacts: [
      { label: 'Measured heat loss', value: '9 kW', source: 'survey' },
      { label: 'Design flow temperature', value: '45 °C', source: 'engine' },
      { label: 'Emitter adequacy', value: 'Confirmed adequate at 45 °C', source: 'survey' },
    ],
  }),
  scenarios: [
    {
      scenarioId: 'ashp',
      system: { type: 'ashp', summary: 'Air source heat pump with stored hot water' },
      performance: { hotWater: 'very_good', heating: 'very_good', efficiency: 'excellent', reliability: 'very_good' },
      keyBenefits: ['COP above 3 at design conditions', 'Low-temperature operation matches emitter survey'],
      keyConstraints: ['Flow temperature must be set correctly by installer', 'Emitter confirmation required'],
      dayToDayOutcomes: ['Consistent warmth', 'Lower running cost at correct COP'],
      requiredWorks: ['Install heat pump, cylinder, and controls'],
      upgradePaths: ['Smart tariff scheduling', 'Battery storage'],
      physicsFlags: { highTempRequired: false },
      efficiencyMetric: { kind: 'cop', value: 3.3 },
    },
  ],
  userConcernTags: ['heat_pump', 'trust', 'evidence', 'radiator'],
  propertyConstraintTags: ['emitters', 'insulation'],
  accessibilityPreferences: { prefersPrint: false, includeTechnicalAppendix: true, profiles: [] },
};

// ─── Fixture 5: Customer worried about disruption ────────────────────────────

const disruptionWorriedSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'combi',
  recommendedSystemLabel: 'Combi boiler replacement',
  headline: 'A combi replacement is the right fit — and the least disruptive option.',
  plainEnglishDecision:
    'A like-for-like combi replacement takes one day. It keeps the existing pipework and does not require additional works to the cylinder or distribution system.',
  whyThisWins: [
    'One-day installation minimises time without hot water and heating.',
    'Existing pipework and radiators remain unchanged.',
    'Familiar controls — same operation as before.',
  ],
  whatThisAvoids: [
    'Avoids a multi-day installation that would require a cylinder, new pipework, or major works.',
    'Avoids disruption to the kitchen, bathroom, or loft.',
  ],
  includedNow: ['Combi boiler replacement', 'Controls setup', 'System flush'],
  requiredChecks: ['Confirm no underlying pipe condition issues'],
  optionalUpgrades: ['Magnetic filter upgrade'],
  futureReady: [],
  confidenceNotes: ['Recommendation accounts for customer disruption concern and property suitability.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative:
    'Combi replacement is recommended for this property because it is the least-disruptive option that meets all assessed needs.',
};

const disruptionWorriedFixture: WelcomePackValidationFixture = {
  id: 'disruption_worried_customer',
  label: 'Customer worried about disruption',
  description:
    'Customer with young children and a busy household who explicitly prioritises minimal disruption over any upgrade benefits.',
  customerConcerns: [
    'I cannot be without hot water for more than a day.',
    'The children need baths every evening.',
    'I work from home — I cannot have engineers here for a week.',
    'Will you have to go into the loft or kitchen?',
  ],
  emotionalTrustConcerns: [
    'Customer will distrust any recommendation that extends installation beyond stated scope.',
    'Scope creep — if additional works appear on the day, trust collapses.',
    'Customer has heard stories of jobs "ballooning" and is pre-stressed about this.',
  ],
  accessibilityNotes: ['Preferred: short bullet points over long paragraphs.'],
  propertyConstraints: [
    '3-bed semi, combi boiler in kitchen',
    'Young children in household — bath time critical',
    'One occupant works from home',
  ],
  customerLanguageSamples: [
    '"I need the hot water on by 5 pm — that is bath time."',
    '"I am not having builders in for a week."',
    '"Promise me there are no hidden extras."',
  ],
  knownMisconceptions: [
    'Customer believes all boiler replacements involve major disruption.',
    'Customer may conflate a cylinder installation with a simple combi swap.',
  ],
  customerSummary: disruptionWorriedSummary,
  atlasDecision: buildDecision(disruptionWorriedSummary, {
    dayToDayOutcomes: ['Hot water and heating restored same day', 'Familiar operation unchanged'],
    requiredWorks: ['Replace combi boiler in one day', 'System flush and controls setup'],
    lifecycle: buildLifecycle('combi', 12, 'average', 'Combi approaching end of expected lifespan; replacement is the right timing.'),
  }),
  scenarios: [
    {
      scenarioId: 'combi',
      system: { type: 'combi', summary: 'Combi boiler replacement' },
      performance: { hotWater: 'good', heating: 'good', efficiency: 'good', reliability: 'good' },
      keyBenefits: ['One-day installation', 'No loft, cylinder, or pipework changes'],
      keyConstraints: ['Pipe condition check recommended'],
      dayToDayOutcomes: ['Same hot water and heating as before, more efficiently'],
      requiredWorks: ['Replace boiler, flush system, set controls'],
      upgradePaths: [],
      physicsFlags: {},
    },
  ],
  userConcernTags: ['disruption', 'reliability', 'scope'],
  propertyConstraintTags: [],
  accessibilityPreferences: { prefersPrint: false, includeTechnicalAppendix: false, profiles: ['adhd'] },
};

// ─── Fixture 6: Landlord / basic compliance replacement ──────────────────────

const landlordComplianceSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'combi',
  recommendedSystemLabel: 'Combi boiler — compliant replacement',
  headline: 'A compliant combi replacement meets regulatory requirements for this rental property.',
  plainEnglishDecision:
    'The existing boiler is beyond its expected lifespan and must be replaced to maintain Gas Safety certificate compliance. A like-for-like combi replacement is the straightforward route.',
  whyThisWins: [
    'Direct replacement maintains the existing pipework and layout.',
    'Meets current Building Regulations and Gas Safety requirements.',
  ],
  whatThisAvoids: [
    'Avoids a compliance failure at the next annual gas safety check.',
    'Avoids liability from an unreliable or condemned appliance.',
  ],
  includedNow: ['Combi boiler replacement', 'Gas safety documentation', 'Controls commissioning'],
  requiredChecks: ['Gas safety check on completion', 'Flue condition survey'],
  optionalUpgrades: ['Carbon monoxide detector upgrade'],
  futureReady: [],
  confidenceNotes: ['Recommendation prioritises compliance and minimal change for a rental property.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative:
    'A like-for-like combi replacement is recommended to restore compliance and reliability for this rental property.',
};

const landlordComplianceFixture: WelcomePackValidationFixture = {
  id: 'landlord_basic_compliance',
  label: 'Landlord — basic compliance replacement',
  description:
    'Landlord with a single buy-to-let property. Motivated by compliance and cost control, not performance. Challenge: tenant wellbeing must still be centred.',
  customerConcerns: [
    'I just need it to be compliant — do not oversell me anything.',
    'What is the cheapest option that passes the gas safety check?',
    'My tenants are fine — there is no complaint, I just need a certificate.',
    'I have three other properties — I do not have time for a long process.',
  ],
  emotionalTrustConcerns: [
    'Landlord may resent any "upsell" recommendation — keep scope minimal.',
    'Risk: tenant comfort is secondary to landlord cost preference — pack must still acknowledge occupant needs.',
    'Trust collapses if paperwork or compliance steps are not clearly explained.',
  ],
  accessibilityNotes: ['Business-style: clear bullet-point format preferred.'],
  propertyConstraints: [
    '2-bed flat, rented, existing combi 18 years old',
    'Tenants in residence — installation must be booked sensitively',
    'Landlord managing remotely',
  ],
  customerLanguageSamples: [
    '"Just give me the basics."',
    '"I do not need all the fancy stuff."',
    '"What do I need to be legally compliant?"',
    '"Can you do this while my tenants are in?"',
  ],
  knownMisconceptions: [
    'Landlord believes compliance means minimum viable boiler, not occupant comfort.',
    'Landlord may not be aware of Minimum Energy Efficiency Standards implications.',
  ],
  customerSummary: landlordComplianceSummary,
  atlasDecision: buildDecision(landlordComplianceSummary, {
    dayToDayOutcomes: ['Reliable heating and hot water for tenants', 'Gas Safety certificate on completion'],
    requiredWorks: ['Replace boiler', 'Flue inspection', 'Gas safety documentation'],
    lifecycle: buildLifecycle('combi', 18, 'worn', 'Boiler significantly beyond expected lifespan — replacement is overdue.'),
    compatibilityWarnings: ['Flue condition survey required before installation'],
  }),
  scenarios: [
    {
      scenarioId: 'combi',
      system: { type: 'combi', summary: 'Combi boiler — compliant replacement' },
      performance: { hotWater: 'good', heating: 'good', efficiency: 'good', reliability: 'good' },
      keyBenefits: ['Meets Gas Safety and Building Regulations', 'Minimal disruption to tenants'],
      keyConstraints: ['Flue condition to be confirmed'],
      dayToDayOutcomes: ['Reliable heating and hot water for tenants'],
      requiredWorks: ['Replace boiler, document gas safety check'],
      upgradePaths: ['CO detector upgrade'],
      physicsFlags: {},
    },
  ],
  userConcernTags: ['compliance', 'reliability', 'scope'],
  propertyConstraintTags: ['rental_property'],
  accessibilityPreferences: { prefersPrint: true, includeTechnicalAppendix: false, profiles: [] },
};

// ─── Fixture 7: Tech enthusiast — smart tariff + battery ─────────────────────

const techEnthusiastSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system_unvented',
  recommendedSystemLabel: 'System boiler with smart-tariff-ready stored hot water',
  headline: 'A smart-tariff-ready stored system unlocks the full potential of your energy setup.',
  plainEnglishDecision:
    'With a battery, PV panels, and a smart tariff already in place, configuring the hot-water storage for time-of-use scheduling maximises the value of your existing investment.',
  whyThisWins: [
    'Thermal store can charge at the cheapest tariff window.',
    'PV diverter can direct excess solar into the hot-water cylinder.',
    'Stored hot water acts as a thermal battery alongside the electrical battery.',
  ],
  whatThisAvoids: [
    'Avoids wasting cheap-rate or solar electricity.',
    'Avoids reheating the full cylinder during expensive peak-rate periods.',
  ],
  includedNow: ['System boiler', 'Smart-tariff-ready stored hot-water cylinder', 'Smart controller with scheduling'],
  requiredChecks: ['Confirm smart meter and tariff eligibility', 'Confirm PV diverter compatibility'],
  optionalUpgrades: ['Battery optimisation integration', 'PV diverter'],
  futureReady: ['Full multi-vector energy management'],
  confidenceNotes: ['Recommendation accounts for existing PV, battery, and smart tariff.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative:
    'Smart-tariff-ready stored hot water integrates with the existing PV and battery setup to shift demand cost-effectively.',
};

const techEnthusiastFixture: WelcomePackValidationFixture = {
  id: 'tech_enthusiast_smart_tariff',
  label: 'Tech enthusiast — smart tariff + battery home',
  description:
    'Customer already has PV, home battery, and smart tariff. Wants the hot-water system to integrate with their energy setup. Challenge: pack must be technically credible.',
  customerConcerns: [
    'How does this integrate with my Octopus Agile tariff?',
    'Will the controller work with my home energy management system?',
    'I want to see the actual API or scheduling logic.',
    'Can the cylinder charge from solar surplus?',
  ],
  emotionalTrustConcerns: [
    'Customer will spot vague answers immediately — must be technically accurate.',
    'Risk: oversimplification will read as incompetence.',
    'Customer expects the system to be optimised, not just functional.',
  ],
  accessibilityNotes: ['Customer prefers technical depth — include appendix with scheduling logic.'],
  propertyConstraints: [
    '4-bed detached, 6 kW PV array',
    '10 kWh home battery (installed)',
    'Octopus Agile smart tariff',
    'Smart meter installed',
  ],
  customerLanguageSamples: [
    '"I want to see the control logic."',
    '"Does it integrate with Home Assistant?"',
    '"What COP can I expect at −5 °C?"',
    '"Will it export to the grid or divert to hot water?"',
  ],
  knownMisconceptions: [
    'Customer may assume any "smart" controller supports full API integration — verify scope.',
    'Customer may conflate battery optimisation with thermal store scheduling.',
  ],
  customerSummary: techEnthusiastSummary,
  atlasDecision: buildDecision(techEnthusiastSummary, {
    dayToDayOutcomes: ['Hot water charged at cheapest tariff window', 'Solar surplus directed to cylinder', 'Battery and thermal store working together'],
    requiredWorks: ['Install smart cylinder and controller', 'Commission tariff scheduling'],
    lifecycle: buildLifecycle('system', 4, 'good', 'Existing system is in good condition; smart scheduling upgrade is the focus.'),
    compatibilityWarnings: ['Smart meter and tariff eligibility must be confirmed before scheduling commissioning'],
  }),
  scenarios: [
    {
      scenarioId: 'system_unvented',
      system: { type: 'system', summary: 'System boiler with smart-tariff-ready stored hot water' },
      performance: { hotWater: 'very_good', heating: 'very_good', efficiency: 'excellent', reliability: 'very_good' },
      keyBenefits: ['Tariff-aware scheduling', 'Solar surplus diversion', 'Thermal storage as energy buffer'],
      keyConstraints: ['Smart meter required', 'Tariff eligibility required'],
      dayToDayOutcomes: ['Optimised hot water cost', 'Integration with PV and battery'],
      requiredWorks: ['Install smart controller', 'Commission scheduling'],
      upgradePaths: ['Full multi-vector energy management', 'V2G integration in future'],
      physicsFlags: {},
    },
  ],
  userConcernTags: ['stratification', 'smart_tariff', 'thermal_storage'],
  propertyConstraintTags: [],
  accessibilityPreferences: { prefersPrint: false, includeTechnicalAppendix: true, profiles: [] },
};

// ─── Fixture 8: Dyslexia/ADHD accessibility-focused customer ─────────────────

const dyslexiaAdhdSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'combi',
  recommendedSystemLabel: 'Combi boiler replacement',
  headline: 'A combi replacement is the right fit for this home.',
  plainEnglishDecision:
    'A simple combi boiler replacement gives reliable heating and hot water without any change to how things work. Everything stays the same, just better.',
  whyThisWins: [
    'One simple appliance handles heating and hot water.',
    'Operation stays familiar — same thermostat, same controls.',
  ],
  whatThisAvoids: [
    'Avoids any confusing changes to how hot water is accessed.',
    'Avoids adding extra complexity to the home.',
  ],
  includedNow: ['Combi boiler replacement', 'Controls setup'],
  requiredChecks: [],
  optionalUpgrades: [],
  futureReady: [],
  confidenceNotes: ['Recommendation prioritises simplicity and familiar operation.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative: 'A combi replacement is recommended because it provides reliable, familiar operation with no added complexity.',
};

const dyslexiaAdhdFixture: WelcomePackValidationFixture = {
  id: 'dyslexia_adhd_accessibility',
  label: 'Dyslexia/ADHD accessibility-focused customer',
  description:
    'Customer with dyslexia and ADHD. Pack must be calm, short, with large type, short sentences, and no complex tables or dense paragraphs.',
  customerConcerns: [
    'I struggle to read long documents.',
    'Can you keep it simple — I lose track of too much information.',
    'I just want to know: will it work and what do I need to do?',
  ],
  emotionalTrustConcerns: [
    'Risk of cognitive overload — too much information triggers distrust and disengagement.',
    'Customer needs to feel respected, not talked down to.',
    'Simple language must not feel condescending.',
  ],
  accessibilityNotes: [
    'Dyslexia-friendly font requested.',
    'Short sentences — maximum 15 words per sentence.',
    'No columns or dense tables.',
    'Bullet points over prose.',
    'Clear headings for each section.',
    'ADHD: keep each section to one key idea.',
  ],
  propertyConstraints: ['2-bed flat, combi boiler', 'Single occupant'],
  customerLanguageSamples: [
    '"Keep it short — I will not read pages and pages."',
    '"Just tell me what matters."',
    '"I need it in plain English."',
  ],
  knownMisconceptions: [],
  customerSummary: dyslexiaAdhdSummary,
  atlasDecision: buildDecision(dyslexiaAdhdSummary, {
    dayToDayOutcomes: ['Same heating and hot water, just more reliable'],
    requiredWorks: ['Replace combi boiler'],
    lifecycle: buildLifecycle('combi', 11, 'average', 'Combi approaching end of expected lifespan.'),
  }),
  scenarios: [
    {
      scenarioId: 'combi',
      system: { type: 'combi', summary: 'Combi boiler replacement' },
      performance: { hotWater: 'good', heating: 'good', efficiency: 'good', reliability: 'good' },
      keyBenefits: ['Simple', 'Familiar', 'Reliable'],
      keyConstraints: [],
      dayToDayOutcomes: ['Same heating and hot water as before'],
      requiredWorks: ['Replace boiler'],
      upgradePaths: [],
      physicsFlags: {},
    },
  ],
  userConcernTags: ['reliability', 'comparison'],
  propertyConstraintTags: [],
  accessibilityPreferences: { prefersPrint: false, includeTechnicalAppendix: false, profiles: ['dyslexia', 'adhd'] },
};

// ─── Fixture 9: Visually impaired — print-first customer ─────────────────────

const visuallyImpairedSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system_unvented',
  recommendedSystemLabel: 'System boiler with stored hot water',
  headline: 'A system boiler with stored hot water is the right fit for this home.',
  plainEnglishDecision:
    'Stored hot water gives consistent pressure and temperature to all outlets, which is especially important for a customer who relies on predictable and safe hot water access.',
  whyThisWins: [
    'Stored hot water gives consistent, safe temperature every time.',
    'Thermostatic controls prevent scalding risk.',
    'Familiar tank-based operation is predictable and manageable.',
  ],
  whatThisAvoids: [
    'Avoids unpredictable temperature swings from on-demand systems.',
    'Avoids scalding risk from uncontrolled flow temperature.',
  ],
  includedNow: ['System boiler', 'Stored hot-water cylinder', 'Thermostatic mixing valve for safety'],
  requiredChecks: ['Confirm thermostatic valve setting and pipework layout'],
  optionalUpgrades: ['Large-print controls label kit'],
  futureReady: ['Smart controls with accessibility features'],
  confidenceNotes: ['Recommendation accounts for accessibility and safety requirements.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative:
    'Stored hot water with thermostatic controls is recommended for consistent, safe temperature delivery suited to accessibility needs.',
};

const visuallyImpairedFixture: WelcomePackValidationFixture = {
  id: 'visually_impaired_print_first',
  label: 'Visually impaired — print-first customer',
  description:
    'Customer with significant visual impairment. Requires large-format printed pack. Digital delivery is not accessible without assistive technology.',
  customerConcerns: [
    'I cannot read small print — I need a large-format version.',
    'Can someone walk me through the document?',
    'I need to know the controls are simple enough to use without seeing clearly.',
    'Safety is my main concern — I cannot afford to be scalded.',
  ],
  emotionalTrustConcerns: [
    'Customer may feel vulnerable if they cannot independently verify the recommendation.',
    'Risk of reliance on a carer or family member to interpret — pack must stand alone.',
    'Trust requires clear, unambiguous safety information in accessible format.',
  ],
  accessibilityNotes: [
    'Large print required — minimum 18pt equivalent.',
    'High-contrast formatting preferred.',
    'Print-first delivery is the primary mode.',
    'Digital pack must be screen-reader compatible (alt text on all images).',
    'Simple diagrams only — no colour-coded legends without text labels.',
  ],
  propertyConstraints: [
    '2-bed bungalow, single occupant with visual impairment',
    'Carer visits twice per week',
  ],
  customerLanguageSamples: [
    '"I cannot read small print at all."',
    '"I need someone to be able to read this to me."',
    '"Safety first — I cannot risk a scalding."',
  ],
  knownMisconceptions: [],
  customerSummary: visuallyImpairedSummary,
  atlasDecision: buildDecision(visuallyImpairedSummary, {
    dayToDayOutcomes: ['Consistent, safe hot water at every tap', 'Simple thermostatic control'],
    requiredWorks: ['Install system boiler and cylinder', 'Fit thermostatic mixing valve', 'Label controls clearly'],
    lifecycle: buildLifecycle('system', 20, 'worn', 'Existing system beyond expected lifespan and lacking modern safety controls.'),
    compatibilityWarnings: ['Thermostatic mixing valve setting and pipework layout to be confirmed'],
  }),
  scenarios: [
    {
      scenarioId: 'system_unvented',
      system: { type: 'system', summary: 'System boiler with stored hot water' },
      performance: { hotWater: 'very_good', heating: 'very_good', efficiency: 'very_good', reliability: 'very_good' },
      keyBenefits: ['Consistent temperature — no scalding risk', 'Simple to operate'],
      keyConstraints: ['Thermostatic valve survey required'],
      dayToDayOutcomes: ['Safe, consistent hot water every time'],
      requiredWorks: ['Install boiler, cylinder, thermostatic mixing valve'],
      upgradePaths: ['Accessible smart controls in future'],
      physicsFlags: {},
    },
  ],
  userConcernTags: ['reliability', 'safety_compliance', 'stored', 'hot_water_storage'],
  propertyConstraintTags: [],
  accessibilityPreferences: { prefersPrint: true, includeTechnicalAppendix: false, profiles: [] },
};

// ─── Fixture 10: Customer expecting "hot radiators" from heat pump ────────────

const hotRadiatorsMisconceptionSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'ashp',
  recommendedSystemLabel: 'Air source heat pump with stored hot water',
  headline: 'A heat pump will keep your home warm — at a lower radiator temperature.',
  plainEnglishDecision:
    'Heat pumps work at lower flow temperatures than boilers. The radiators will feel cooler to touch, but the rooms will be just as warm. This is how heat pumps are designed to work.',
  whyThisWins: [
    'Lower flow temperature improves heat pump efficiency (higher COP).',
    'Surveyed emitters are sized to deliver sufficient heat at design conditions.',
    'Room temperature meets the same set-point as a boiler — the route there is different.',
  ],
  whatThisAvoids: [
    'Avoids another boiler replacement cycle.',
    'Avoids the COP penalty of running a heat pump at high flow temperature.',
  ],
  includedNow: ['Air source heat pump', 'Stored hot-water cylinder', 'Compensation controls'],
  requiredChecks: ['Emitter output at 45 °C confirmed before commissioning'],
  optionalUpgrades: ['Smart thermostat for room temperature monitoring'],
  futureReady: ['Smart tariff optimisation'],
  confidenceNotes: ['Recommendation is based on emitter survey confirming adequate output at design flow temperature.'],
  hardConstraints: [],
  performancePenalties: ['Running the heat pump at high flow temperature significantly reduces COP.'],
  fitNarrative:
    'A heat pump with correctly sized emitters will maintain room temperature at the same comfort level as a boiler, using lower flow temperatures and with improved efficiency.',
};

const hotRadiatorsMisconceptionFixture: WelcomePackValidationFixture = {
  id: 'hot_radiators_misconception',
  label: 'Customer expecting "hot radiators" from heat pump',
  description:
    'Customer expects radiators to be scalding-hot as with a boiler. Will be alarmed if radiators feel lukewarm. Challenge: re-framing comfort expectation from radiator temperature to room temperature.',
  customerConcerns: [
    'My radiators with the boiler are really hot — will the heat pump make them cold?',
    'I like to be able to feel the heat coming off the radiators.',
    'What if the house is not warm enough?',
    'I have heard they are slow to heat up.',
  ],
  emotionalTrustConcerns: [
    'Customer will interpret lukewarm radiators as a failure even if rooms are warm.',
    'Risk: if installer does not explain this clearly, customer will complain post-installation.',
    'The pack must set this expectation clearly without being dismissive.',
  ],
  accessibilityNotes: [],
  propertyConstraints: [
    '3-bed semi, 1990s construction',
    'Emitter survey: output confirmed adequate at 45 °C',
    'Insulation: cavity wall present, loft insulated to 200 mm',
  ],
  customerLanguageSamples: [
    '"I like really warm radiators."',
    '"Will the rooms be as warm?"',
    '"My last boiler had the radiators boiling hot."',
  ],
  knownMisconceptions: [
    'Customer equates radiator surface temperature with room comfort.',
    'Customer does not know that lower flow temperature = higher efficiency, not less heat.',
    'Customer may believe slower warm-up time means the system is underperforming.',
  ],
  customerSummary: hotRadiatorsMisconceptionSummary,
  atlasDecision: buildDecision(hotRadiatorsMisconceptionSummary, {
    dayToDayOutcomes: ['Rooms maintain target temperature', 'Radiators will feel warm, not hot — this is by design'],
    requiredWorks: ['Install heat pump and cylinder', 'Commission at correct flow temperature'],
    lifecycle: buildLifecycle('system', 15, 'worn', 'Existing system boiler at end of expected lifespan.'),
    compatibilityWarnings: ['Emitter output at design flow temperature must be confirmed before commissioning'],
    performancePenalties: ['High flow temperature setting increases running cost significantly.'],
  }),
  scenarios: [
    {
      scenarioId: 'ashp',
      system: { type: 'ashp', summary: 'Air source heat pump with stored hot water' },
      performance: { hotWater: 'very_good', heating: 'very_good', efficiency: 'excellent', reliability: 'very_good' },
      keyBenefits: ['Rooms stay warm', 'Lower flow temperature reduces running cost', 'Correct emitter sizing confirmed'],
      keyConstraints: ['Flow temperature must be set correctly', 'Emitter confirmation required'],
      dayToDayOutcomes: ['Comfortable rooms at lower radiator surface temperature'],
      requiredWorks: ['Install heat pump', 'Confirm emitters', 'Commission at design flow temperature'],
      upgradePaths: ['Smart tariff'],
      physicsFlags: { highTempRequired: false },
      efficiencyMetric: { kind: 'cop', value: 3.1 },
    },
  ],
  userConcernTags: ['heat_pump', 'radiator', 'comfort'],
  propertyConstraintTags: ['emitters'],
  accessibilityPreferences: { prefersPrint: false, includeTechnicalAppendix: false, profiles: [] },
};

// ─── Fixture 11: Customer wanting "more powerful boiler" ─────────────────────

const morePowerfulBoilerSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'combi',
  recommendedSystemLabel: 'Combi boiler — correctly sized',
  headline: 'The right-sized combi will perform better than a bigger one.',
  plainEnglishDecision:
    'Installing a boiler rated for this property\'s actual heat loss gives more consistent heat and better efficiency. A larger boiler would short-cycle and actually deliver less comfort.',
  whyThisWins: [
    'Correctly-sized boiler runs in longer, more efficient cycles.',
    'Lower risk of short-cycling comfort problems.',
    'Lower running cost through improved seasonal efficiency.',
  ],
  whatThisAvoids: [
    'Avoids short cycling caused by oversizing.',
    'Avoids the higher installation and running cost of an unnecessarily large unit.',
  ],
  includedNow: ['Correctly-sized combi boiler', 'Controls setup'],
  requiredChecks: ['Heat loss survey to confirm sizing'],
  optionalUpgrades: ['Magnetic filter'],
  futureReady: ['Future weather compensation controls'],
  confidenceNotes: ['Sizing is based on calculated heat loss for this property.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative:
    'A correctly-sized combi boiler is recommended because oversizing causes short cycling, which reduces efficiency and comfort.',
};

const morePowerfulBoilerFixture: WelcomePackValidationFixture = {
  id: 'more_powerful_boiler_customer',
  label: 'Customer wanting "more powerful boiler"',
  description:
    'Customer has decided they want a larger boiler because the house "takes ages to heat up". Challenge: de-escalating the kW-output-as-quality myth.',
  customerConcerns: [
    'I want a bigger boiler — ours takes too long to heat up.',
    'Why are you recommending a smaller one than I asked for?',
    'I have looked it up — a 30 kW boiler should be better for our house.',
    'I do not want to have to keep the heating on all day.',
  ],
  emotionalTrustConcerns: [
    'Customer will feel their own research is being dismissed.',
    'Risk of conflict if the recommendation contradicts what the customer "knows".',
    'Must explain short cycling in plain terms without making them feel foolish.',
  ],
  accessibilityNotes: [],
  propertyConstraints: [
    '3-bed semi, estimated heat loss 8 kW',
    'Customer requesting 30 kW combi (nearly 4× oversized)',
    'Slow warm-up complaint — likely due to poor controls, not output',
  ],
  customerLanguageSamples: [
    '"I want a proper powerful one."',
    '"The house takes ages to get warm."',
    '"More kW means more heat, right?"',
  ],
  knownMisconceptions: [
    'Customer believes kW output directly correlates with heating speed and quality.',
    'Customer does not understand that slow warm-up is typically a controls or distribution problem, not a capacity issue.',
    'Customer does not know what short cycling is or why it matters.',
  ],
  customerSummary: morePowerfulBoilerSummary,
  atlasDecision: buildDecision(morePowerfulBoilerSummary, {
    dayToDayOutcomes: ['Faster, more consistent heat delivery', 'No short-cycling starts and stops'],
    requiredWorks: ['Install correctly-sized boiler', 'Heat loss calculation to confirm sizing'],
    lifecycle: buildLifecycle('combi', 14, 'worn', 'Existing combi at end of expected lifespan.'),
    performancePenalties: ['A 30 kW boiler in an 8 kW property would short-cycle, increasing running costs.'],
  }),
  scenarios: [
    {
      scenarioId: 'combi',
      system: { type: 'combi', summary: 'Combi boiler — correctly sized' },
      performance: { hotWater: 'good', heating: 'very_good', efficiency: 'very_good', reliability: 'very_good' },
      keyBenefits: ['Correctly sized = more consistent heat delivery', 'No short cycling', 'Better efficiency'],
      keyConstraints: ['Heat loss survey required before sizing'],
      dayToDayOutcomes: ['Consistent, efficient heating'],
      requiredWorks: ['Heat loss survey', 'Install correctly-sized boiler'],
      upgradePaths: ['Weather compensation controls to further improve warmth-up response'],
      physicsFlags: {},
    },
  ],
  userConcernTags: ['boiler_sizing', 'cycling', 'modulation', 'comparison'],
  propertyConstraintTags: ['oversized_boiler'],
  accessibilityPreferences: { prefersPrint: false, includeTechnicalAppendix: false, profiles: [] },
};

// ─── Fixture 12: Customer comparing multiple installer quotes ─────────────────

const multipleQuotesSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system_unvented',
  recommendedSystemLabel: 'System boiler with stored hot water',
  headline: 'Atlas recommends a system boiler with stored hot water — and here is why.',
  plainEnglishDecision:
    'Two of your three quotes propose the same approach. The third quote, proposing a combi, would not meet your simultaneous hot-water demand. Atlas recommends the stored route on physics grounds.',
  whyThisWins: [
    'Stored hot water eliminates the simultaneous demand problem identified in the survey.',
    'System boiler with cylinder is correctly sized for this household.',
  ],
  whatThisAvoids: [
    'Avoids a combi installation that would underperform for this household.',
    'Avoids paying for a specification that will not meet your needs.',
  ],
  includedNow: ['System boiler', 'Stored hot-water cylinder', 'Zone controls'],
  requiredChecks: ['Confirm cylinder sizing against demand profile'],
  optionalUpgrades: ['Solar diverter connection'],
  futureReady: ['Future smart tariff scheduling'],
  confidenceNotes: ['Recommendation resolves conflict between competing quotes using physics, not opinion.'],
  hardConstraints: ['Combi flow rate is insufficient for simultaneous demand in this property.'],
  performancePenalties: [],
  fitNarrative:
    'A system boiler with stored hot water is recommended because this property has simultaneous demand that a combi cannot meet, regardless of boiler rating.',
};

const multipleQuotesFixture: WelcomePackValidationFixture = {
  id: 'multiple_quotes_comparison',
  label: 'Customer comparing multiple installer quotes',
  description:
    'Customer has three competing quotes, two recommending stored hot water and one recommending a combi. Confused and suspicious of all recommendations. Challenge: position Atlas as neutral arbiter using physics.',
  customerConcerns: [
    'I have three quotes and they all say different things.',
    'One says combi, two say system — who is right?',
    'Is this just about which one makes more money for the installer?',
    'How do I know Atlas is not biased?',
  ],
  emotionalTrustConcerns: [
    'High distrust — customer has already experienced conflicting advice.',
    'Risk: any hint of commercial interest will destroy credibility.',
    'Customer needs to see the evidence chain, not just the conclusion.',
    'Physics-based explanation is the only viable trust route.',
  ],
  accessibilityNotes: ['Customer wants a document they can compare side-by-side with other quotes.'],
  propertyConstraints: [
    '4-bed detached, 4 occupants',
    '2 bathrooms — concurrent use is common',
    'Existing combi 15 years old',
  ],
  customerLanguageSamples: [
    '"Everyone is telling me something different."',
    '"How do I know you are not just trying to sell me something?"',
    '"What is the actual reason — not the sales pitch?"',
    '"Show me why the combi quote is wrong."',
  ],
  knownMisconceptions: [
    'Customer believes installer recommendations are primarily financially motivated.',
    'Customer may not understand why simultaneous demand disqualifies a combi for their household.',
  ],
  customerSummary: multipleQuotesSummary,
  atlasDecision: buildDecision(multipleQuotesSummary, {
    dayToDayOutcomes: ['Consistent hot water for all outlets simultaneously', 'No pressure or flow conflict'],
    requiredWorks: ['Install system boiler and cylinder', 'Commission zone controls'],
    lifecycle: buildLifecycle('combi', 15, 'worn', 'Existing combi at end of expected lifespan and undersized for household demand.'),
    hardConstraints: ['Combi cannot serve simultaneous hot-water demand for 4 occupants with 2 bathrooms.'],
    compatibilityWarnings: ['Cylinder sizing must account for peak concurrent demand'],
  }),
  scenarios: [
    {
      scenarioId: 'system_unvented',
      system: { type: 'system', summary: 'System boiler with stored hot water' },
      performance: { hotWater: 'very_good', heating: 'very_good', efficiency: 'very_good', reliability: 'very_good' },
      keyBenefits: ['Eliminates simultaneous demand conflict', 'Consistent pressure and flow to all outlets'],
      keyConstraints: ['Cylinder sizing survey required'],
      dayToDayOutcomes: ['Reliable hot water for all users simultaneously'],
      requiredWorks: ['Install system boiler and cylinder'],
      upgradePaths: ['Solar diverter', 'Smart tariff scheduling'],
      physicsFlags: { combiFlowRisk: true },
    },
  ],
  userConcernTags: ['comparison', 'simultaneous_use', 'hot_water_storage', 'stored', 'trust'],
  propertyConstraintTags: ['pressure', 'flow'],
  accessibilityPreferences: { prefersPrint: false, includeTechnicalAppendix: true, profiles: [] },
};

// ─── Fixture registry ─────────────────────────────────────────────────────────

export const welcomePackValidationFixtures: Record<WelcomePackValidationFixtureId, WelcomePackValidationFixture> = {
  oversized_combi_replacement: oversizedCombiFixture,
  low_pressure_family_home: lowPressureFamilyFixture,
  elderly_gravity_replacement: elderlyGravityFixture,
  skeptical_heat_pump_customer: skepticalHeatPumpFixture,
  disruption_worried_customer: disruptionWorriedFixture,
  landlord_basic_compliance: landlordComplianceFixture,
  tech_enthusiast_smart_tariff: techEnthusiastFixture,
  dyslexia_adhd_accessibility: dyslexiaAdhdFixture,
  visually_impaired_print_first: visuallyImpairedFixture,
  hot_radiators_misconception: hotRadiatorsMisconceptionFixture,
  more_powerful_boiler_customer: morePowerfulBoilerFixture,
  multiple_quotes_comparison: multipleQuotesFixture,
};

export const welcomePackValidationFixtureList = Object.values(welcomePackValidationFixtures);

export function getValidationFixture(id: WelcomePackValidationFixtureId): WelcomePackValidationFixture {
  return welcomePackValidationFixtures[id];
}
