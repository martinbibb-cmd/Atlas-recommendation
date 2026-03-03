/**
 * GeochemistrySection — /live/chemistry
 *
 * Geochemical analysis — water hardness, CaCO₃, silica, scale resistance
 * factor, 10-year efficiency decay, and current boiler ErP class.
 */
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import {
  resolveNominalEfficiencyPct,
  computeCurrentEfficiencyPct,
  deriveErpClass,
} from '../../engine/utils/efficiency';

interface Props {
  result: FullEngineResult;
  input: FullSurveyModelV1;
}

export default function GeochemistrySection({ result, input }: Props) {
  const { normalizer } = result;
  const nominalEfficiencyPct = resolveNominalEfficiencyPct(input.currentBoilerSedbukPct);
  const currentEfficiencyPct = computeCurrentEfficiencyPct(
    nominalEfficiencyPct,
    normalizer.tenYearEfficiencyDecayPct,
  );

  return (
    <div className="result-section">
      <div className="metric-row">
        <span className="metric-label">Water Hardness</span>
        <span
          className={`metric-value ${normalizer.waterHardnessCategory === 'soft' ? 'ok' : 'warning'}`}
        >
          {normalizer.waterHardnessCategory.replace('_', ' ').toUpperCase()}
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label">CaCO₃ Level</span>
        <span className="metric-value">{normalizer.cacO3Level} mg/L</span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Silica Level</span>
        <span className="metric-value">{normalizer.silicaLevel} mg/L</span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Thermal Resistance Factor (Rf)</span>
        <span className="metric-value">{normalizer.scaleRf.toFixed(5)} m²K/W</span>
      </div>
      <div className="metric-row">
        <span className="metric-label">10-Year Efficiency Decay</span>
        <span
          className={`metric-value ${normalizer.tenYearEfficiencyDecayPct > 8 ? 'warning' : 'ok'}`}
        >
          {normalizer.tenYearEfficiencyDecayPct.toFixed(1)}%
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Current Boiler Efficiency (post-decay)</span>
        <span className={`metric-value ${currentEfficiencyPct < 80 ? 'warning' : 'ok'}`}>
          {currentEfficiencyPct.toFixed(1)}% — ErP {deriveErpClass(currentEfficiencyPct) ?? 'n/a'}
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Boiler ErP (from entered SEDBUK %)</span>
        <span className="metric-value">{deriveErpClass(nominalEfficiencyPct) ?? 'n/a'}</span>
      </div>
    </div>
  );
}
