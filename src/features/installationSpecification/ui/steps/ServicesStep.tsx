/**
 * ServicesStep.tsx
 *
 * Services and labour selection step for the Atlas Installation Specification.
 *
 * Captures the enabling works and labour items to be included in the
 * installation pack.  Site conditions from the canonical survey inform
 * which services are recommended.
 *
 * Design rules:
 *   - Services are labour and enabling works, not products.
 *   - Each service item has a reason string.
 *   - Pre-selects sensible defaults based on the proposed system and site conditions.
 *   - Site conditions from the survey drive recommendations (e.g. buried pipework
 *     → pipework allowance; loft tank present → loft tank removal).
 *   - Does not alter recommendation decisions.
 */

import type { UiProposedHeatSourceLabel, UiProposedHotWaterLabel, CanonicalCurrentSystemSummary } from '../installationSpecificationUiTypes';

// ─── Service item types ───────────────────────────────────────────────────────

export type ServiceItemId =
  | 'boiler_swap'
  | 'boiler_relocation'
  | 'cylinder_replacement'
  | 'cylinder_relocation'
  | 'drain_down_refill'
  | 'system_cleanse'
  | 'chemical_flush'
  | 'powerflush'
  | 'commissioning'
  | 'gas_safe_notification'
  | 'g3_commissioning'
  | 'controls_wiring'
  | 'condensate_reroute'
  | 'flue_route_creation'
  | 'discharge_route_creation'
  | 'loft_tank_removal'
  | 'making_good'
  | 'waste_removal'
  | 'pipework_alteration'
  | 'partial_repipe'
  | 'full_repipe';

export interface ServiceItem {
  id: ServiceItemId;
  label: string;
  reason: string;
  category: 'installation' | 'enabling' | 'commissioning' | 'compliance';
  /** Whether this service is included by default. */
  defaultIncluded: boolean;
}

export interface ServicesSelection {
  selectedIds: Set<ServiceItemId>;
}

// ─── Service catalog ──────────────────────────────────────────────────────────

const ALL_SERVICES: ServiceItem[] = [
  {
    id: 'boiler_swap',
    label: 'Boiler swap (same location)',
    reason: 'The existing boiler must be removed and the new boiler installed in the same position.',
    category: 'installation',
    defaultIncluded: true,
  },
  {
    id: 'boiler_relocation',
    label: 'Boiler relocation',
    reason: 'The new boiler is being installed in a different location, requiring additional pipework and making good at the old position.',
    category: 'installation',
    defaultIncluded: false,
  },
  {
    id: 'cylinder_replacement',
    label: 'Cylinder replacement (same location)',
    reason: 'The existing cylinder must be removed and a new cylinder installed in the same position.',
    category: 'installation',
    defaultIncluded: false,
  },
  {
    id: 'cylinder_relocation',
    label: 'Cylinder relocation',
    reason: 'The cylinder is being moved to a new location, requiring additional pipework and making good.',
    category: 'installation',
    defaultIncluded: false,
  },
  {
    id: 'drain_down_refill',
    label: 'Drain down and refill',
    reason: 'The heating system must be drained down and refilled with treated water as part of the installation.',
    category: 'installation',
    defaultIncluded: true,
  },
  {
    id: 'system_cleanse',
    label: 'System cleanse',
    reason: 'A system cleanse removes sludge and debris from existing pipework, protecting the new boiler and components.',
    category: 'installation',
    defaultIncluded: true,
  },
  {
    id: 'chemical_flush',
    label: 'Chemical flush',
    reason: 'A chemical flush treats the system water to remove scale and corrosion inhibitors that can damage new equipment.',
    category: 'installation',
    defaultIncluded: false,
  },
  {
    id: 'powerflush',
    label: 'Powerflush',
    reason: 'A powerflush is recommended when the existing system has significant sludge or blockage that a standard cleanse cannot remove.',
    category: 'installation',
    defaultIncluded: false,
  },
  {
    id: 'commissioning',
    label: 'Commissioning and handover',
    reason: 'Every installation must be commissioned to manufacturer requirements and handed over to the customer with all documentation.',
    category: 'commissioning',
    defaultIncluded: true,
  },
  {
    id: 'gas_safe_notification',
    label: 'Gas Safe notification',
    reason: 'Any gas work must be notified to Gas Safe Register as required by law.',
    category: 'compliance',
    defaultIncluded: true,
  },
  {
    id: 'g3_commissioning',
    label: 'G3 commissioning (unvented hot water)',
    reason: 'An unvented or pressure-managed hot water installation requires G3 commissioning by a qualified engineer.',
    category: 'compliance',
    defaultIncluded: false,
  },
  {
    id: 'controls_wiring',
    label: 'Controls wiring',
    reason: 'New or upgraded controls require wiring to the boiler, cylinder, and any motorised valves.',
    category: 'installation',
    defaultIncluded: true,
  },
  {
    id: 'condensate_reroute',
    label: 'Condensate pipe reroute',
    reason: 'If the boiler is being relocated or the existing condensate route is unsuitable, the condensate pipe must be rerouted.',
    category: 'installation',
    defaultIncluded: false,
  },
  {
    id: 'flue_route_creation',
    label: 'Flue route creation',
    reason: 'A new or altered flue route requires core drilling, flue liner installation, or other enabling works.',
    category: 'enabling',
    defaultIncluded: false,
  },
  {
    id: 'discharge_route_creation',
    label: 'Discharge route creation',
    reason: 'An unvented or pressure-managed cylinder requires a safe discharge pipe route to a suitable termination point.',
    category: 'enabling',
    defaultIncluded: false,
  },
  {
    id: 'loft_tank_removal',
    label: 'Loft feed and expansion tank removal',
    reason: 'When converting from an open-vented to a sealed system, the cold feed and expansion tanks in the loft must be removed and made good.',
    category: 'enabling',
    defaultIncluded: false,
  },
  {
    id: 'making_good',
    label: 'Making good and decoration',
    reason: 'Any pipework, flue, or structural work must be made good on completion.',
    category: 'installation',
    defaultIncluded: true,
  },
  {
    id: 'waste_removal',
    label: 'Waste and component removal',
    reason: 'Old boiler, cylinder, and associated pipework must be safely removed and disposed of.',
    category: 'installation',
    defaultIncluded: true,
  },
  {
    id: 'pipework_alteration',
    label: 'Pipework alteration / modification',
    reason: 'Some pipework connections or layouts may need to be altered to suit the new system or boiler position.',
    category: 'enabling',
    defaultIncluded: false,
  },
  {
    id: 'partial_repipe',
    label: 'Partial repipe',
    reason: 'Where existing pipework is buried, in poor condition, or incompatible with the new system, a partial repipe allowance is included.',
    category: 'enabling',
    defaultIncluded: false,
  },
  {
    id: 'full_repipe',
    label: 'Full repipe',
    reason: 'Where the existing pipework is entirely unsuitable or the system topology is changing significantly, a full repipe allowance is included.',
    category: 'enabling',
    defaultIncluded: false,
  },
];

/**
 * Returns the default selected services for a given proposed system and survey data.
 */
function getDefaultServiceIds(
  proposedHeatSource: UiProposedHeatSourceLabel | null,
  proposedHotWater: UiProposedHotWaterLabel | null,
  canonical: CanonicalCurrentSystemSummary | null,
): Set<ServiceItemId> {
  const ids = new Set<ServiceItemId>([
    'boiler_swap',
    'drain_down_refill',
    'system_cleanse',
    'commissioning',
    'gas_safe_notification',
    'controls_wiring',
    'making_good',
    'waste_removal',
  ]);

  // Cylinder work when a new cylinder is being installed
  if (
    proposedHotWater != null &&
    proposedHotWater !== 'no_stored_hot_water' &&
    proposedHotWater !== 'retain_existing' &&
    proposedHeatSource !== 'combi_boiler' &&
    proposedHeatSource !== 'storage_combi'
  ) {
    ids.add('cylinder_replacement');
  }

  // G3 commissioning for unvented / Mixergy cylinders
  if (
    proposedHotWater === 'unvented_cylinder' ||
    proposedHotWater === 'mixergy_or_stratified' ||
    proposedHotWater === 'heat_pump_cylinder'
  ) {
    ids.add('g3_commissioning');
    ids.add('discharge_route_creation');
  }

  // Loft tank removal when converting from open-vented primary
  if (canonical?.primaryCircuit === 'open_vented_primary' && proposedHeatSource !== 'regular_boiler') {
    ids.add('loft_tank_removal');
  }

  return ids;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ServicesStepProps {
  proposedHeatSource: UiProposedHeatSourceLabel | null;
  proposedHotWater: UiProposedHotWaterLabel | null;
  canonicalCurrentSystem: CanonicalCurrentSystemSummary | null;
  selection: ServicesSelection;
  onSelectionChange: (selection: ServicesSelection) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ServicesStep({
  selection,
  onSelectionChange,
}: ServicesStepProps) {
  const categories: Array<{ key: ServiceItem['category']; label: string }> = [
    { key: 'installation',  label: 'Installation and labour' },
    { key: 'enabling',      label: 'Enabling works' },
    { key: 'commissioning', label: 'Commissioning' },
    { key: 'compliance',    label: 'Compliance and notifications' },
  ];

  function toggleService(id: ServiceItemId) {
    const next = new Set(selection.selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange({ selectedIds: next });
  }

  return (
    <>
      <h2 className="qp-step-heading">Services</h2>
      <p className="qp-step-subheading">
        Select the enabling works and labour to include in this installation pack.
        Site conditions from the survey drive the recommendations shown below.
      </p>

      {categories.map(({ key, label }) => {
        const categoryServices = ALL_SERVICES.filter((s) => s.category === key);
        if (categoryServices.length === 0) return null;

        return (
          <section key={key} className="services-step__group" data-testid={`services-group-${key}`}>
            <h3 className="services-step__group-heading">{label}</h3>
            <ul className="services-step__list">
              {categoryServices.map((service) => {
                const checked = selection.selectedIds.has(service.id);
                return (
                  <li key={service.id} className="services-step__item">
                    <label className="services-step__item-label">
                      <input
                        type="checkbox"
                        className="services-step__checkbox"
                        checked={checked}
                        onChange={() => toggleService(service.id)}
                        data-testid={`service-${service.id}`}
                        aria-label={service.label}
                      />
                      <span className="services-step__item-name">{service.label}</span>
                    </label>
                    <p className="services-step__item-reason">{service.reason}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}

export { getDefaultServiceIds };
