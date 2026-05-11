/**
 * SuggestedImplementationPackV1.ts — Surveyor/engineer-facing implementation pack.
 *
 * Purpose:
 *   Bridge from recommendation → implementation intent.
 *
 *   This pack is generated deterministically from canonical survey + engine truth
 *   and is intended ONLY for surveyor/engineer handover.  It is completely separate
 *   from all customer-facing content.
 *
 * Explicit boundaries:
 *   - NOT customer-facing
 *   - NOT quote pricing
 *   - NOT compliance pass/fail
 *   - NOT final engineering design
 *
 * The nine sections mirror the real installation workflow:
 *   1. heat_source          — primary heat generator type and sizing notes
 *   2. hot_water            — DHW strategy, cylinder type, expansion/discharge
 *   3. hydraulic_components — pumps, valves, header, bypass
 *   4. controls             — thermostat, programmer, TRVs, zoning
 *   5. water_quality        — filter, flush strategy, inhibitor, scale
 *   6. safety_compliance    — regulatory requirements, qualifications, notifications
 *   7. pipework             — primary circuit topology, pipe sizing, routing notes
 *   8. commissioning        — pressure test, fill, balancing, functional test
 *   9. future_ready         — readiness items for ASHP, PV, smart grid
 */

// ─── Severity ─────────────────────────────────────────────────────────────────

/**
 * Severity of an implementation note or unresolved risk.
 *
 *   required  — must be resolved before or during installation
 *   advisory  — engineer should be aware; may need site verification
 *   info      — contextual note; no action required
 */
export type ImplementationNoteSeverity = 'required' | 'advisory' | 'info';

// ─── Suggested component ──────────────────────────────────────────────────────

/**
 * A single suggested component or material with sizing rationale.
 *
 * No brand names — specification only.
 */
export interface SuggestedComponent {
  /** Machine-readable component identifier, e.g. 'unvented_cylinder'. */
  readonly id: string;
  /** Short description, e.g. 'Unvented hot water cylinder'. */
  readonly description: string;
  /**
   * Suggested specification/sizing, e.g. '180–210 L for 3–4 occupants' or
   * '24–28 kW output at design conditions'.
   * Absent when sizing cannot be determined from available survey data.
   */
  readonly suggestedSpec?: string;
  /**
   * Physics-grounded rationale for this component or sizing suggestion.
   * Must be derived from engine evidence — never invented.
   */
  readonly rationale: string;
  /** Whether this component is definitively required or only suggested. */
  readonly confidence: 'required' | 'suggested' | 'if_applicable';
}

// ─── Unresolved risk ──────────────────────────────────────────────────────────

/**
 * An unresolved risk or question that the surveyor or engineer must address
 * before or during installation.
 */
export interface UnresolvedRisk {
  /** Machine-readable risk identifier. */
  readonly id: string;
  /** Short description of the risk or open question. */
  readonly description: string;
  /** What needs to be done to resolve this. */
  readonly resolution: string;
  readonly severity: ImplementationNoteSeverity;
}

// ─── Required qualification ───────────────────────────────────────────────────

/**
 * A qualification or certification required for part of this installation.
 * Separated from customer value — qualifications are not benefits.
 */
export interface RequiredQualification {
  /** Machine-readable qualification identifier, e.g. 'g3_unvented'. */
  readonly id: string;
  /** Human-readable label, e.g. 'G3 Unvented Hot Water Installer'. */
  readonly label: string;
  /**
   * Which part of the installation triggers this requirement.
   * e.g. 'Unvented (mains-fed) cylinder installation and commissioning'.
   */
  readonly triggeredBy: string;
  /**
   * Regulatory or scheme reference, e.g. 'Building Regulations Part G3',
   * 'Gas Safe Register', 'MCS Certificate'.
   */
  readonly reference?: string;
}

// ─── Required compliance item ─────────────────────────────────────────────────

/**
 * A regulatory or compliance requirement triggered by this installation.
 * NOT a pass/fail verdict — the pack surfaces requirements only.
 */
export interface RequiredComplianceItem {
  /** Machine-readable compliance item identifier. */
  readonly id: string;
  /** Human-readable description, e.g. 'Unvented system notification to Building Control'. */
  readonly description: string;
  /**
   * Regulatory reference, e.g. 'Building Regulations Part G3',
   * 'Water Regulations 1999', 'Gas Safety Regulations'.
   */
  readonly regulatoryRef?: string;
  /**
   * Timing relative to the installation.
   * 'before'  — must be arranged before work starts
   * 'during'  — must happen during installation
   * 'after'   — notification/certificate issued post-completion
   */
  readonly timing: 'before' | 'during' | 'after' | 'unknown';
}

// ─── Required validation ──────────────────────────────────────────────────────

/**
 * A site verification that must be carried out by the engineer.
 * These are items that Atlas cannot confirm remotely from survey data alone.
 */
export interface RequiredValidation {
  /** Machine-readable identifier. */
  readonly id: string;
  /** What needs to be checked. */
  readonly check: string;
  /** Why this check is needed. */
  readonly reason: string;
  readonly severity: ImplementationNoteSeverity;
}

// ─── Section types ────────────────────────────────────────────────────────────

/** Section 1: Heat source */
export interface HeatSourceSection {
  /** Recommended heat source family, e.g. 'gas_system_boiler', 'ashp'. */
  readonly recommendedFamily: string;
  /** Human-readable heat source label. */
  readonly label: string;
  readonly suggestedComponents: readonly SuggestedComponent[];
  readonly sizingRationale: readonly string[];
  readonly installNotes: readonly string[];
  readonly unresolvedRisks: readonly UnresolvedRisk[];
}

/** Section 2: Hot water */
export interface HotWaterSection {
  /**
   * DHW strategy.
   * 'on_demand'       — combi/instantaneous (no stored volume)
   * 'stored_unvented' — mains-fed sealed cylinder
   * 'stored_vented'   — tank-fed open-vented cylinder
   * 'stored_mixergy'  — Mixergy top-down stratification cylinder
   * 'heat_pump_cylinder' — cylinder charged by ASHP
   */
  readonly strategy:
    | 'on_demand'
    | 'stored_unvented'
    | 'stored_vented'
    | 'stored_mixergy'
    | 'heat_pump_cylinder'
    | 'unknown';
  readonly suggestedComponents: readonly SuggestedComponent[];
  /**
   * Expansion management notes (expansion vessel, expansion relief valve,
   * tundish route, discharge pipe).
   * Present when strategy is stored_unvented or stored_mixergy.
   */
  readonly expansionManagement?: readonly string[];
  /**
   * Tundish and discharge route requirements.
   * Present when strategy is stored_unvented or stored_mixergy.
   */
  readonly dischargeRequirements?: readonly string[];
  readonly installNotes: readonly string[];
  readonly unresolvedRisks: readonly UnresolvedRisk[];
}

/** Section 3: Hydraulic components */
export interface HydraulicComponentsSection {
  readonly suggestedComponents: readonly SuggestedComponent[];
  readonly installNotes: readonly string[];
  readonly unresolvedRisks: readonly UnresolvedRisk[];
}

/** Section 4: Controls */
export interface ControlsSection {
  readonly suggestedComponents: readonly SuggestedComponent[];
  readonly installNotes: readonly string[];
  readonly unresolvedRisks: readonly UnresolvedRisk[];
}

/** Section 5: Water quality */
export interface WaterQualitySection {
  /**
   * Filter recommendation, e.g. 'magnetic filter on primary return'.
   */
  readonly filterRecommendation?: string;
  /**
   * Flush strategy, e.g. 'power flush recommended — system >10 years,
   * heavy sludge risk'.
   */
  readonly flushStrategy?: string;
  /**
   * Inhibitor recommendation, e.g. 'dose with corrosion inhibitor to
   * BS 7593 specification'.
   */
  readonly inhibitorRecommendation?: string;
  /**
   * Scale management recommendation where water hardness is moderate or hard.
   */
  readonly scaleManagement?: string;
  readonly suggestedComponents: readonly SuggestedComponent[];
  readonly installNotes: readonly string[];
  readonly unresolvedRisks: readonly UnresolvedRisk[];
}

/** Section 6: Safety and compliance */
export interface SafetyComplianceSection {
  readonly requiredQualifications: readonly RequiredQualification[];
  readonly requiredComplianceItems: readonly RequiredComplianceItem[];
  readonly installNotes: readonly string[];
  readonly unresolvedRisks: readonly UnresolvedRisk[];
}

/** Section 7: Pipework considerations */
export interface PipeworkSection {
  /** Notes about primary circuit topology. */
  readonly topologyNotes: readonly string[];
  /** Pipe sizing guidance derived from heat-loss and flow requirements. */
  readonly pipeSizingNotes: readonly string[];
  /** Routing or access considerations. */
  readonly routingNotes: readonly string[];
  readonly suggestedComponents: readonly SuggestedComponent[];
  readonly unresolvedRisks: readonly UnresolvedRisk[];
}

/** Section 8: Commissioning */
export interface CommissioningSection {
  /** Ordered list of commissioning steps for this system type. */
  readonly steps: readonly string[];
  /** Required documentation, e.g. 'Benchmark commissioning checklist'. */
  readonly requiredDocumentation: readonly string[];
  readonly unresolvedRisks: readonly UnresolvedRisk[];
}

/** Section 9: Future-ready options */
export interface FutureReadySection {
  readonly items: readonly FutureReadyItem[];
}

export interface FutureReadyItem {
  /** Machine-readable identifier, e.g. 'ashp_pathway'. */
  readonly id: string;
  /** Human-readable label, e.g. 'Air source heat pump pathway'. */
  readonly label: string;
  /** What needs to be considered or prepared now for this future option. */
  readonly preparationNote: string;
  /** Whether this item is a near-term or long-term consideration. */
  readonly horizon: 'near_term' | 'long_term';
}

// ─── Top-level pack ───────────────────────────────────────────────────────────

/**
 * SuggestedImplementationPackV1
 *
 * The complete surveyor/engineer-facing implementation pack for a single
 * Atlas recommendation.
 *
 * Generated deterministically from:
 *   - atlasDecision  (AtlasDecisionV1)
 *   - customerSummary (CustomerSummaryV1)
 *   - engineOutput   (EngineOutputV1)
 *   - surveyInput    (EngineInputV2_3Contract)
 *   - scanData       (optional scan capture)
 *
 * NOT customer-facing. NOT quote pricing. NOT compliance pass/fail.
 * NOT final engineering design.
 */
export interface SuggestedImplementationPackV1 {
  /**
   * Version string for this pack schema. Bump when breaking changes are made.
   */
  readonly packVersion: 'v1';

  /**
   * The scenarioId this pack was generated for.
   * Must equal the atlasDecision.recommendedScenarioId supplied at build time.
   */
  readonly recommendedScenarioId: string;

  /**
   * ISO 8601 timestamp at which this pack was generated.
   * Used for traceability and staleness detection.
   */
  readonly generatedAt: string;

  // ─── Nine sections ─────────────────────────────────────────────────────────

  readonly heatSource: HeatSourceSection;
  readonly hotWater: HotWaterSection;
  readonly hydraulicComponents: HydraulicComponentsSection;
  readonly controls: ControlsSection;
  readonly waterQuality: WaterQualitySection;
  readonly safetyCompliance: SafetyComplianceSection;
  readonly pipework: PipeworkSection;
  readonly commissioning: CommissioningSection;
  readonly futureReady: FutureReadySection;

  // ─── Cross-section summary ─────────────────────────────────────────────────

  /**
   * All unresolved risks/questions across every section, deduplicated by id.
   * Convenience roll-up for the review panel — sourced from individual sections,
   * not independently generated.
   */
  readonly allUnresolvedRisks: readonly UnresolvedRisk[];

  /**
   * All required qualifications across every section, deduplicated by id.
   */
  readonly allRequiredQualifications: readonly RequiredQualification[];

  /**
   * All required compliance items across every section, deduplicated by id.
   */
  readonly allRequiredComplianceItems: readonly RequiredComplianceItem[];

  /**
   * All required site validations across every section, deduplicated by id.
   */
  readonly allRequiredValidations: readonly RequiredValidation[];
}
