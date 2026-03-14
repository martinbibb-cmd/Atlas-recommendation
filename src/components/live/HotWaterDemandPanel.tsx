/**
 * HotWaterDemandPanel
 *
 * Graphic 2 — Hot Water Demand vs System Capacity.
 *
 * Instantly explains the combi vs cylinder decision by showing peak demand
 * alongside what each system can deliver.  Uses combiDhwV1 engine data for
 * delivery capacity and occupancy/bathroom data for demand.
 *
 * Design: side-by-side bars — demand on left, delivery on right.
 * Clear visual gap when combi cannot meet demand; bar filled when cylinder wins.
 */

import type { OutputHubSection } from '../../live/printSections.model';

const VOLUME_BAND_LABEL: Record<string, string> = {
  small:  'Small (≤150 L)',
  medium: 'Medium (180–210 L)',
  large:  'Large (≥250 L)',
};

const STORED_TYPE_LABEL: Record<string, string> = {
  standard: 'Standard cylinder',
  mixergy:  'Stored hot water with top-down heating and active stratification.',
  unknown:  'Cylinder type to be confirmed',
};

const RISK_LABEL: Record<string, { text: string; colour: string }> = {
  fail: { text: 'Combi cannot meet simultaneous demand', colour: '#e53e3e' },
  warn: { text: 'Combi may struggle at peak demand',     colour: '#dd6b20' },
  pass: { text: 'Combi demand manageable',              colour: '#38a169' },
};

interface Props {
  section: OutputHubSection;
}

export default function HotWaterDemandPanel({ section }: Props) {
  const c = section.content as {
    occupancyCount:   number | null;
    bathroomCount:    number | null;
    peakOutlets:      number | null;
    peakDemandLpm:    number | null;
    combiDeliveryLpm: number | null;
    combiRisk:        'fail' | 'warn' | 'pass';
    storedVolumeBand: 'small' | 'medium' | 'large';
    storedType:       'standard' | 'mixergy' | 'unknown';
  };

  const riskInfo = RISK_LABEL[c.combiRisk];
  const demandKnown  = c.peakDemandLpm != null;
  const deliveryKnown = c.combiDeliveryLpm != null;
  const maxBar       = Math.max(25, (c.peakDemandLpm ?? 0) + 5, (c.combiDeliveryLpm ?? 0) + 5);
  const demandPct    = demandKnown ? Math.min(100, ((c.peakDemandLpm! / maxBar) * 100)) : 0;
  const deliveryPct  = deliveryKnown ? Math.min(100, (c.combiDeliveryLpm! / maxBar) * 100) : 0;

  return (
    <div className="hub-graphic hub-graphic--dhw" aria-label="Hot water demand panel">
      <h3 className="hub-graphic__title">🚿 Hot Water Demand vs Capacity</h3>

      {/* Demand context */}
      <div className="hub-dhw__context">
        {c.occupancyCount != null && (
          <span className="hub-dhw__pill">{c.occupancyCount} occupants</span>
        )}
        {c.bathroomCount != null && (
          <span className="hub-dhw__pill">{c.bathroomCount} bathroom{c.bathroomCount !== 1 ? 's' : ''}</span>
        )}
        {c.peakOutlets != null && (
          <span className="hub-dhw__pill">{c.peakOutlets} simultaneous outlet{c.peakOutlets !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Bar chart */}
      <div className="hub-dhw__chart" aria-label="Demand vs capacity bars">
        {demandKnown && (
          <div className="hub-dhw__bar-row">
            <span className="hub-dhw__bar-label">Peak demand</span>
            <span className="hub-dhw__bar-wrap">
              <span
                className="hub-dhw__bar hub-dhw__bar--demand"
                style={{ width: `${demandPct}%` }}
                aria-label={`Peak demand: ${c.peakDemandLpm} L/min`}
              />
            </span>
            <span className="hub-dhw__bar-value">{c.peakDemandLpm} L/min</span>
          </div>
        )}
        <div className="hub-dhw__bar-row">
          <span className="hub-dhw__bar-label">Combi capacity</span>
          <span className="hub-dhw__bar-wrap">
            {deliveryKnown && (
              <span
                className={`hub-dhw__bar hub-dhw__bar--combi hub-dhw__bar--combi-${c.combiRisk}`}
                style={{ width: `${deliveryPct}%` }}
                aria-label={`Combi capacity: ${c.combiDeliveryLpm} L/min`}
              />
            )}
          </span>
          <span className="hub-dhw__bar-value">{deliveryKnown ? `${c.combiDeliveryLpm} L/min` : 'Unknown'}</span>
        </div>
      </div>

      {/* Risk verdict */}
      <div
        className="hub-dhw__verdict"
        style={{ borderLeftColor: riskInfo.colour, color: riskInfo.colour }}
        role="status"
        aria-label={`Combi risk: ${c.combiRisk}`}
      >
        {riskInfo.text}
      </div>

      {/* Cylinder alternative */}
      <div className="hub-dhw__cylinder-alt">
        <div className="hub-dhw__cylinder-header">
          <span className="hub-dhw__cylinder-icon" aria-hidden="true">🛢</span>
          <span className="hub-dhw__cylinder-title">Cylinder alternative</span>
        </div>
        <div className="hub-dhw__cylinder-rows">
          <div className="hub-dhw__cylinder-row">
            <span className="hub-dhw__cylinder-key">Type</span>
            <span className="hub-dhw__cylinder-val">{STORED_TYPE_LABEL[c.storedType] ?? c.storedType}</span>
          </div>
          <div className="hub-dhw__cylinder-row">
            <span className="hub-dhw__cylinder-key">Size</span>
            <span className="hub-dhw__cylinder-val">{VOLUME_BAND_LABEL[c.storedVolumeBand] ?? c.storedVolumeBand}</span>
          </div>
          <div className="hub-dhw__cylinder-row">
            <span className="hub-dhw__cylinder-key">Result</span>
            <span className="hub-dhw__cylinder-val hub-dhw__cylinder-val--ok">
              Stored hot water — simultaneous outlets supported
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
