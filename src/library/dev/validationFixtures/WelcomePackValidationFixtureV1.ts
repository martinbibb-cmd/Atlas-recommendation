import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../../contracts/CustomerSummaryV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';
import type { WelcomePackAccessibilityPreferencesV1 } from '../../packComposer/WelcomePackComposerV1';

/**
 * WelcomePackValidationFixtureV1
 *
 * A realistic customer journey fixture used to stress-test the calm
 * welcome-pack pipeline for content quality, routing gaps, accessibility,
 * and trust risks.
 *
 * Validation fixtures are richer than demo fixtures: they include
 * emotional/trust concerns, customer language patterns, and expected
 * challenge areas so the validation runner can surface gaps and mismatches.
 *
 * Rules:
 *   - Must NOT change recommendation logic.
 *   - May only be used in dev/test contexts.
 *   - All content must reflect realistic customer scenarios.
 */
export type WelcomePackValidationFixtureId =
  | 'oversized_combi_replacement'
  | 'low_pressure_family_home'
  | 'elderly_gravity_replacement'
  | 'skeptical_heat_pump_customer'
  | 'disruption_worried_customer'
  | 'landlord_basic_compliance'
  | 'tech_enthusiast_smart_tariff'
  | 'dyslexia_adhd_accessibility'
  | 'visually_impaired_print_first'
  | 'hot_radiators_misconception'
  | 'more_powerful_boiler_customer'
  | 'multiple_quotes_comparison';

export interface WelcomePackValidationFixture {
  id: WelcomePackValidationFixtureId;
  label: string;
  description: string;

  /** Realistic concerns this customer voiced during survey. */
  customerConcerns: string[];

  /** Emotional and trust concerns that may affect pack reception. */
  emotionalTrustConcerns: string[];

  /** Accessibility needs that the pack must respect. */
  accessibilityNotes: string[];

  /** Property constraints observed or reported. */
  propertyConstraints: string[];

  /** Verbatim-style phrases the customer used — language the pack should echo or de-escalate. */
  customerLanguageSamples: string[];

  /** Known misconceptions or expectations that may conflict with the recommendation. */
  knownMisconceptions: string[];

  customerSummary: CustomerSummaryV1;
  atlasDecision: AtlasDecisionV1;
  scenarios: ScenarioResult[];
  userConcernTags: string[];
  propertyConstraintTags: string[];
  accessibilityPreferences: WelcomePackAccessibilityPreferencesV1;
}
