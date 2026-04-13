/**
 * EngineModuleRegistry.ts
 *
 * Event-driven module registry for the Atlas recommendation engine.
 *
 * ## Problem
 * The core engine orchestrator (Engine.ts / runEngine) directly imports and
 * calls every module it knows about. Adding a new module (e.g. "Solar PV ROI",
 * "Battery Arbitrage") currently requires modifying Engine.ts itself — a
 * violation of the Open/Closed Principle and a source of merge conflicts.
 *
 * ## Solution
 * This registry introduces a lightweight publish/subscribe contract between
 * the engine orchestrator and optional add-on modules. Engine.ts emits
 * typed lifecycle events (`engine:input-validated`, `engine:core-complete`,
 * `engine:output-ready`) and registered modules subscribe to the events they
 * care about, augmenting the engine output without touching the orchestrator.
 *
 * ## Event lifecycle
 *
 *   engine:input-validated  — fired after runEngineInputValidation()
 *   engine:core-complete    — fired after all family runners and limiter ledger
 *                             are built, before buildEngineOutputV1()
 *   engine:output-ready     — fired after buildEngineOutputV1(); modules can
 *                             attach additional fields to the output
 *
 * ## Usage — registering a module
 *
 *   import { ENGINE_MODULE_REGISTRY } from './EngineModuleRegistry';
 *
 *   ENGINE_MODULE_REGISTRY.register({
 *     moduleId: 'solar_pv_roi',
 *     displayName: 'Solar PV ROI Module',
 *     subscriptions: {
 *       'engine:output-ready': (ctx) => {
 *         // ctx.input is EngineInputV2_3
 *         // ctx.output is EngineOutputV1 — augment in place
 *         ctx.output.meta.additionalModules ??= {};
 *         ctx.output.meta.additionalModules['solar_pv_roi'] = computePvRoi(ctx.input);
 *       },
 *     },
 *   });
 *
 * ## Usage — emitting events (Engine.ts)
 *
 *   ENGINE_MODULE_REGISTRY.emit('engine:output-ready', { input, output });
 *
 * ## Design rules
 *   - Registered modules MUST be deterministic (no Math.random()).
 *   - Registered modules MUST NOT modify engine inputs — only augment outputs.
 *   - Errors in registered modules are caught and logged; they do not abort the
 *     primary engine run.
 *   - The registry is a singleton; all module registrations persist for the
 *     lifetime of the JS context (typically a single browser tab / worker request).
 */

import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';

// ─── Event contracts ──────────────────────────────────────────────────────────

export interface EngineInputValidatedContext {
  readonly input: Readonly<EngineInputV2_3>;
}

export interface EngineCoreCompleteContext {
  readonly input: Readonly<EngineInputV2_3>;
}

export interface EngineOutputReadyContext {
  readonly input: Readonly<EngineInputV2_3>;
  /** Mutable reference — modules may attach additional metadata. */
  output: EngineOutputV1;
}

export type EngineEventMap = {
  'engine:input-validated': EngineInputValidatedContext;
  'engine:core-complete': EngineCoreCompleteContext;
  'engine:output-ready': EngineOutputReadyContext;
};

export type EngineEventName = keyof EngineEventMap;

// ─── Module registration ──────────────────────────────────────────────────────

export type EngineModuleSubscriptions = {
  [K in EngineEventName]?: (ctx: EngineEventMap[K]) => void;
};

export interface EngineModuleRegistration {
  /**
   * Stable snake_case identifier for this module.
   * Must be unique across all registered modules; duplicate ids are rejected
   * at registration time with a console.warn (no throw, to avoid boot failures).
   */
  moduleId: string;
  /** Human-readable label for diagnostics and DEV overlay. */
  displayName: string;
  /** Event hooks to subscribe to. At least one subscription is required. */
  subscriptions: EngineModuleSubscriptions;
}

// ─── Registry implementation ──────────────────────────────────────────────────

class EngineModuleRegistryImpl {
  private readonly _modules = new Map<string, EngineModuleRegistration>();

  /**
   * Register an add-on module with the engine event bus.
   *
   * Safe to call multiple times (e.g. during HMR); subsequent registrations
   * for the same moduleId replace the previous one.
   */
  register(module: EngineModuleRegistration): void {
    if (Object.keys(module.subscriptions).length === 0) {
      console.warn(
        `[EngineModuleRegistry] Module "${module.moduleId}" registered with no subscriptions — ignored.`,
      );
      return;
    }
    if (this._modules.has(module.moduleId)) {
      console.warn(
        `[EngineModuleRegistry] Module "${module.moduleId}" re-registered — replacing previous registration.`,
      );
    }
    this._modules.set(module.moduleId, module);
  }

  /**
   * Deregister a module by id.
   * Useful for testing and for hot-module-replacement teardown.
   */
  deregister(moduleId: string): void {
    this._modules.delete(moduleId);
  }

  /**
   * Emit an engine lifecycle event to all registered modules.
   *
   * Errors thrown by individual module handlers are caught and logged so that
   * one misbehaving add-on module cannot abort the primary engine run.
   */
  emit<K extends EngineEventName>(event: K, ctx: EngineEventMap[K]): void {
    for (const [, module] of this._modules) {
      const handler = module.subscriptions[event] as
        | ((ctx: EngineEventMap[K]) => void)
        | undefined;
      if (handler == null) continue;
      try {
        handler(ctx);
      } catch (err) {
        console.error(
          `[EngineModuleRegistry] Module "${module.moduleId}" threw on event "${event}":`,
          err,
        );
      }
    }
  }

  /** Returns the number of registered modules (useful for diagnostics). */
  get size(): number {
    return this._modules.size;
  }

  /**
   * Returns a read-only snapshot of registered module ids.
   * Intended for DEV diagnostics only.
   */
  registeredIds(): readonly string[] {
    return Array.from(this._modules.keys());
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

/**
 * The global engine module registry.
 *
 * Import this singleton to register add-on modules or to emit events from
 * the engine orchestrator.
 */
export const ENGINE_MODULE_REGISTRY = new EngineModuleRegistryImpl();
