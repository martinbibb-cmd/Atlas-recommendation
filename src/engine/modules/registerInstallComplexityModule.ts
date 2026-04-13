/**
 * registerInstallComplexityModule.ts
 *
 * Registers the InstallComplexityModule with the engine module registry.
 *
 * Import this file once at engine startup (e.g. from Engine.ts or main.tsx)
 * to activate install complexity signals in engine outputs.
 *
 * The module subscribes to 'engine:output-ready' and attaches
 * InstallComplexityResultV1 to EngineOutputV1.installComplexity when
 * EngineInputV2_3.installMarkup is present.
 *
 * When installMarkup is absent, the field is not set on the output
 * (preserving backward-compatibility for callers that never supply markup).
 */

import { ENGINE_MODULE_REGISTRY } from './EngineModuleRegistry';
import { runInstallComplexityModule } from './InstallComplexityModule';

ENGINE_MODULE_REGISTRY.register({
  moduleId: 'install_complexity',
  displayName: 'Install Complexity Module',
  subscriptions: {
    'engine:output-ready': (ctx) => {
      const result = runInstallComplexityModule(ctx.input.installMarkup);
      if (result.hasMarkup) {
        ctx.output.installComplexity = result;
      }
    },
  },
});
