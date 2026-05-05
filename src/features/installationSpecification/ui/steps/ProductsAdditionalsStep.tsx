/**
 * ProductsAdditionalsStep.tsx
 *
 * Products and optional upgrades selection step for the Atlas Installation Specification.
 *
 * Captures selectable products that can be added to the installation pack.
 * Products are filtered by topology — cylinder products are not shown on a
 * combi-only pack unless there is a specific reason to include them.
 *
 * Design rules:
 *   - Products are optional upgrades, not the starting point of the quote.
 *   - Each product has a reason string.
 *   - Topology-aware: combi packs do not show cylinder-only products by default.
 *   - Mixergy and specific cylinder types are named explicitly.
 *   - Does not alter recommendation decisions.
 */

import type { UiProposedHeatSourceLabel, UiProposedHotWaterLabel } from '../installationSpecificationUiTypes';

// ─── Product item types ───────────────────────────────────────────────────────

export type ProductItemId =
  | 'magnetic_filter'
  | 'scale_reducer'
  | 'deaerator'
  | 'dirt_separator'
  | 'trvs_supply'
  | 'smart_trvs_supply'
  | 'weather_sensor'
  | 'flue_plume_kit'
  | 'condensate_pump'
  | 'secondary_return_pump'
  | 'high_head_pump'
  | 'buffer_vessel'
  | 'water_treatment_chemicals'
  | 'co_alarm'
  | 'pipe_insulation'
  | 'radiator_valves'
  | 'warranty_extension'
  | 'service_plan';

export interface ProductItem {
  id: ProductItemId;
  label: string;
  reason: string;
  category: 'protection' | 'comfort' | 'efficiency' | 'safety' | 'aftercare';
  /**
   * When true, this product is only relevant when there is a stored hot-water
   * arrangement (cylinder or tank).
   */
  cylinderOnly?: boolean;
  /** Whether this product is included by default. */
  defaultIncluded: boolean;
}

export interface ProductsSelection {
  selectedIds: Set<ProductItemId>;
}

// ─── Product catalog ──────────────────────────────────────────────────────────

const ALL_PRODUCTS: ProductItem[] = [
  {
    id: 'magnetic_filter',
    label: 'Magnetic system filter',
    reason: 'A magnetic filter protects a new boiler from system debris and sludge, which is especially important on older heating systems.',
    category: 'protection',
    defaultIncluded: true,
  },
  {
    id: 'scale_reducer',
    label: 'Scale reducer / limescale inhibitor',
    reason: 'A scale reducer is recommended in hard-water areas to protect the heat exchanger and hot-water components from limescale build-up.',
    category: 'protection',
    defaultIncluded: false,
  },
  {
    id: 'deaerator',
    label: 'Deaerator / air separator',
    reason: 'A deaerator removes dissolved gases from the heating water, reducing corrosion, noise, and cold radiator spots.',
    category: 'protection',
    defaultIncluded: false,
  },
  {
    id: 'dirt_separator',
    label: 'Dirt / particle separator',
    reason: 'A dirt separator removes larger particles of magnetite and corrosion debris that a magnetic filter alone cannot capture.',
    category: 'protection',
    defaultIncluded: false,
  },
  {
    id: 'trvs_supply',
    label: 'Supply and fit thermostatic radiator valves (TRVs)',
    reason: 'New TRVs allow individual radiator temperature control and are required to meet current Part L efficiency recommendations.',
    category: 'comfort',
    defaultIncluded: false,
  },
  {
    id: 'smart_trvs_supply',
    label: 'Supply and fit smart TRVs',
    reason: 'Smart TRVs add room-by-room scheduling and remote control, significantly improving energy efficiency and comfort.',
    category: 'comfort',
    defaultIncluded: false,
  },
  {
    id: 'weather_sensor',
    label: 'Outdoor weather sensor',
    reason: 'An outdoor weather sensor is required for weather-compensated control, enabling the boiler to adjust flow temperature based on conditions.',
    category: 'efficiency',
    defaultIncluded: false,
  },
  {
    id: 'flue_plume_kit',
    label: 'Flue plume management kit',
    reason: 'A plume management kit redirects condensate vapour from the flue terminal to prevent nuisance to neighbours or property.',
    category: 'comfort',
    defaultIncluded: false,
  },
  {
    id: 'condensate_pump',
    label: 'Condensate pump',
    reason: 'A condensate pump is required when gravity drainage to a suitable outlet is not feasible from the boiler location.',
    category: 'efficiency',
    defaultIncluded: false,
  },
  {
    id: 'secondary_return_pump',
    label: 'Secondary hot-water return pump',
    reason: 'A secondary return pump keeps hot water circulating to remote draw-off points, reducing wait times and water waste.',
    category: 'comfort',
    cylinderOnly: true,
    defaultIncluded: false,
  },
  {
    id: 'high_head_pump',
    label: 'High-head circulation pump',
    reason: 'A high-head pump is required on systems with high resistance, such as underfloor heating or long pipe runs.',
    category: 'efficiency',
    defaultIncluded: false,
  },
  {
    id: 'buffer_vessel',
    label: 'Buffer vessel / volumiser',
    reason: 'A buffer vessel reduces boiler cycling, especially on modern high-efficiency boilers with low minimum outputs or on zoned systems.',
    category: 'efficiency',
    defaultIncluded: false,
  },
  {
    id: 'water_treatment_chemicals',
    label: 'System water treatment chemicals',
    reason: 'Inhibitor and cleansing chemicals protect new and existing components from corrosion and scale, extending system life.',
    category: 'protection',
    defaultIncluded: true,
  },
  {
    id: 'co_alarm',
    label: 'Carbon monoxide alarm',
    reason: 'A CO alarm is a safety requirement for rooms containing gas appliances and strongly recommended in all homes with gas boilers.',
    category: 'safety',
    defaultIncluded: true,
  },
  {
    id: 'pipe_insulation',
    label: 'Pipe insulation',
    reason: 'Pipe insulation reduces heat loss from hot-water pipework and is required for pipes in unheated spaces under current regulations.',
    category: 'efficiency',
    defaultIncluded: false,
  },
  {
    id: 'radiator_valves',
    label: 'Radiator valve replacements',
    reason: 'Replacing old radiator valves improves system flow and reduces leaks, particularly when valves are corroded or damaged.',
    category: 'comfort',
    defaultIncluded: false,
  },
  {
    id: 'warranty_extension',
    label: 'Extended warranty',
    reason: 'An extended manufacturer or third-party warranty provides additional cover beyond the standard boiler warranty period.',
    category: 'aftercare',
    defaultIncluded: false,
  },
  {
    id: 'service_plan',
    label: 'Annual service plan',
    reason: 'A service plan ensures the boiler is maintained annually, preserving the warranty, efficiency, and safe operation.',
    category: 'aftercare',
    defaultIncluded: false,
  },
];

/**
 * Returns the default selected products for a given proposed system.
 * The proposedHeatSource parameter is reserved for topology-based
 * future expansion (e.g. heat pump packs may default different products).
 */
function getDefaultProductIds(
  _proposedHeatSource: UiProposedHeatSourceLabel | null,
): Set<ProductItemId> {
  return new Set<ProductItemId>([
    'magnetic_filter',
    'water_treatment_chemicals',
    'co_alarm',
  ]);
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ProductsAdditionalsStepProps {
  proposedHeatSource: UiProposedHeatSourceLabel | null;
  proposedHotWater: UiProposedHotWaterLabel | null;
  selection: ProductsSelection;
  onSelectionChange: (selection: ProductsSelection) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductsAdditionalsStep({
  proposedHeatSource,
  proposedHotWater,
  selection,
  onSelectionChange,
}: ProductsAdditionalsStepProps) {
  const hasCylinder =
    proposedHotWater != null &&
    proposedHotWater !== 'no_stored_hot_water' &&
    proposedHeatSource !== 'combi_boiler' &&
    proposedHeatSource !== 'storage_combi';

  // Filter products by topology
  const visibleProducts = ALL_PRODUCTS.filter((product) => {
    if (product.cylinderOnly && !hasCylinder) return false;
    return true;
  });

  const categories: Array<{ key: ProductItem['category']; label: string }> = [
    { key: 'protection', label: 'System protection' },
    { key: 'comfort',    label: 'Comfort and convenience' },
    { key: 'efficiency', label: 'Efficiency and energy' },
    { key: 'safety',     label: 'Safety' },
    { key: 'aftercare',  label: 'Aftercare' },
  ];

  function toggleProduct(id: ProductItemId) {
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
      <h2 className="qp-step-heading">Products and options</h2>
      <p className="qp-step-subheading">
        Select additional products and upgrades to include in this pack.
        Items shown are relevant to the selected system type.
      </p>

      {categories.map(({ key, label }) => {
        const categoryProducts = visibleProducts.filter((p) => p.category === key);
        if (categoryProducts.length === 0) return null;

        return (
          <section key={key} className="products-step__group" data-testid={`products-group-${key}`}>
            <h3 className="products-step__group-heading">{label}</h3>
            <ul className="products-step__list">
              {categoryProducts.map((product) => {
                const checked = selection.selectedIds.has(product.id);
                return (
                  <li key={product.id} className="products-step__item">
                    <label className="products-step__item-label">
                      <input
                        type="checkbox"
                        className="products-step__checkbox"
                        checked={checked}
                        onChange={() => toggleProduct(product.id)}
                        data-testid={`product-${product.id}`}
                        aria-label={product.label}
                      />
                      <span className="products-step__item-name">{product.label}</span>
                    </label>
                    <p className="products-step__item-reason">{product.reason}</p>
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

export { getDefaultProductIds };
