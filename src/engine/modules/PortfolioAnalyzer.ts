import type {
  PortfolioProperty,
  PortfolioPropertyResult,
  PortfolioResult,
} from '../schema/EngineInputV2_3';
import { runPredictiveMaintenanceModule } from './PredictiveMaintenanceModule';

/** Minimum safe dynamic system pressure (bar) per BS EN 14336 */
const MIN_SAFE_DYNAMIC_PRESSURE_BAR = 0.5;

/** Maximum acceptable gap (years) since last MCS design review */
const MCS_REVIEW_MAX_AGE_YEARS = 5;

/** Maximum acceptable gap (years) since last Legionella risk assessment (L8 ACOP) */
const LEGIONELLA_ASSESSMENT_MAX_AGE_YEARS = 2;

/** Risk score threshold above which an asset is considered "critical" */
const CRITICAL_RISK_THRESHOLD = 7;

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Analyses a single portfolio property for maintenance risk and compliance.
 */
function analyseProperty(property: PortfolioProperty): PortfolioPropertyResult {
  const maintenance = runPredictiveMaintenanceModule(property.maintenanceInput);
  const complianceAlerts: string[] = [];

  // ── MCS compliance ────────────────────────────────────────────────────────
  if (property.lastMcsReviewYear === undefined) {
    complianceAlerts.push(
      `⚠️ MCS: No design review on record. A heat loss survey and system design ` +
      `sign-off is required before any renewable installation.`,
    );
  } else if (CURRENT_YEAR - property.lastMcsReviewYear > MCS_REVIEW_MAX_AGE_YEARS) {
    complianceAlerts.push(
      `⚠️ MCS: Last design review was ${CURRENT_YEAR - property.lastMcsReviewYear} years ago ` +
      `(limit ${MCS_REVIEW_MAX_AGE_YEARS} yrs). Schedule a re-survey.`,
    );
  }

  // ── Legionella compliance (L8 ACOP) ──────────────────────────────────────
  if (property.lastLegionellaAssessmentYear === undefined) {
    complianceAlerts.push(
      `🦠 Legionella: No risk assessment on record. An L8-compliant assessment ` +
      `is legally required for all domestic hot water systems in the rental sector.`,
    );
  } else if (
    CURRENT_YEAR - property.lastLegionellaAssessmentYear > LEGIONELLA_ASSESSMENT_MAX_AGE_YEARS
  ) {
    complianceAlerts.push(
      `🦠 Legionella: Last assessment was ${CURRENT_YEAR - property.lastLegionellaAssessmentYear} ` +
      `years ago (limit ${LEGIONELLA_ASSESSMENT_MAX_AGE_YEARS} yrs). Renewal required.`,
    );
  }

  // ── Dynamic pressure safety ───────────────────────────────────────────────
  if (
    property.lastDynamicPressureBar !== undefined &&
    property.lastDynamicPressureBar < MIN_SAFE_DYNAMIC_PRESSURE_BAR
  ) {
    complianceAlerts.push(
      `🚨 Pressure: Dynamic system pressure ${property.lastDynamicPressureBar.toFixed(1)} bar ` +
      `is below the safe minimum of ${MIN_SAFE_DYNAMIC_PRESSURE_BAR} bar. ` +
      `Investigate for leaks or failed pressure-relief valve immediately.`,
    );
  }

  return {
    assetId: property.assetId,
    address: property.address,
    kettlingRiskScore: maintenance.kettlingRiskScore,
    magnetiteRiskScore: maintenance.magnetiteRiskScore,
    overallHealthScore: maintenance.overallHealthScore,
    complianceAlerts,
    recommendedActions: [
      ...maintenance.criticalAlerts,
      ...maintenance.recommendations,
    ],
  };
}

/**
 * Analyses a portfolio of properties and produces a ranked risk report.
 *
 * Results are ranked from highest combined risk (kettling + magnetite) to lowest,
 * enabling Housing Associations to prioritise power-flush scheduling.
 */
export function analysePortfolio(properties: PortfolioProperty[]): PortfolioResult {
  const results = properties.map(analyseProperty);

  // Rank by combined risk score (descending)
  const rankedByRisk = [...results].sort(
    (a, b) =>
      b.kettlingRiskScore + b.magnetiteRiskScore -
      (a.kettlingRiskScore + a.magnetiteRiskScore),
  );

  const fleetAverageHealthScore =
    results.length > 0
      ? Math.round(
          results.reduce((acc, r) => acc + r.overallHealthScore, 0) / results.length,
        )
      : 0;

  const criticalAssetCount = results.filter(
    r =>
      r.kettlingRiskScore >= CRITICAL_RISK_THRESHOLD ||
      r.magnetiteRiskScore >= CRITICAL_RISK_THRESHOLD,
  ).length;

  const complianceFailureCount = results.filter(r => r.complianceAlerts.length > 0).length;

  return {
    properties: results,
    rankedByRisk,
    fleetAverageHealthScore,
    criticalAssetCount,
    complianceFailureCount,
  };
}
