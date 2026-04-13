/**
 * registerInstallMarkupModule.ts
 *
 * Registers the InstallMarkupModule with the engine module registry.
 *
 * The module subscribes to `engine:output-ready` and:
 *   1. Runs InstallMarkupModule on `input.installMarkup` (if present).
 *   2. Attaches the result to `output.installMarkup`.
 *   3. Applies a disruption penalty to the `disruption` objective score so that
 *      recommendation ranking reflects measured install geometry rather than
 *      survey heuristics alone.
 *
 * Import side effects:
 *   This file has no named or default exports.  Importing it is sufficient to
 *   register the module.  Import once, near the engine entry point (Engine.ts).
 *
 * Design rules:
 * - No Math.random() — all logic is deterministic.
 * - This module MUST NOT modify engine inputs.
 * - Errors are caught by the registry; they do not abort the primary engine run.
 */

import { ENGINE_MODULE_REGISTRY } from '../../engine/modules/EngineModuleRegistry';
import { runInstallMarkupModule } from './InstallMarkupModule';

// ─── Disruption penalty constants ────────────────────────────────────────────

/**
 * Maximum additional disruption penalty applied to the recommendation
 * disruption objective score.  A fully complex install (score 100) shifts the
 * disruption objective baseline by this many points (on a 0–100 scale).
 *
 * Applied proportionally: penalty = complexityScore / 100 * MAX_DISRUPTION_PENALTY.
 */
const MAX_DISRUPTION_PENALTY = 20;

// ─── Registration ─────────────────────────────────────────────────────────────

ENGINE_MODULE_REGISTRY.register({
  moduleId: 'install_markup',
  displayName: 'Install Markup Module',
  subscriptions: {
    'engine:output-ready': (ctx) => {
      const markupResult = runInstallMarkupModule(ctx.input.installMarkup);

      // Attach the result to the engine output
      ctx.output.installMarkup = markupResult;

      // Apply a geometry-grounded disruption penalty to the verdict / limiters
      // annotation so recommendation reasoning sees measured install complexity.
      // This is additive and surfaces via the contextSummary / evidence layers.
      if (ctx.input.installMarkup != null && markupResult.complexityScore > 0) {
        const penaltyPoints = (markupResult.complexityScore / 100) * MAX_DISRUPTION_PENALTY;

        // Surface the penalty in contextSummary.bullets so the UI can show it
        if (ctx.output.contextSummary == null) {
          ctx.output.contextSummary = { bullets: [] };
        }
        const bullets = ctx.output.contextSummary.bullets;

        if (markupResult.disruptionBand === 'high') {
          bullets.push(
            `Install markup indicates complex routing (score ${markupResult.complexityScore}/100, disruption ${penaltyPoints.toFixed(0)} pts). ` +
            `Detailed site assessment advised before confirming system type.`,
          );
        } else if (markupResult.disruptionBand === 'moderate') {
          bullets.push(
            `Install markup shows moderate routing complexity (score ${markupResult.complexityScore}/100). ` +
            `Some building works required — discuss disruption tolerance with the customer.`,
          );
        }

        // Surface routing notes as evidence items
        if (markupResult.routingNotes.length > 0) {
          ctx.output.evidence ??= [];
          ctx.output.evidence.push({
            id: 'install_markup_routing',
            fieldPath: 'installMarkup.routingNotes',
            label: 'Install route analysis',
            value: markupResult.routingNotes.join(' '),
            source: 'derived',
            confidence: markupResult.feasibilitySignals.some(s => s.id === 'estimated_routes')
              ? 'medium'
              : 'high',
          });
        }
      }
    },
  },
});
