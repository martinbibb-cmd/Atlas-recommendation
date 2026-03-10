/**
 * GeochemistrySection — practical water-quality decision panel.
 *
 * Structured around three decision blocks:
 *   1. Water quality   — hardness band, scale tendency, silicate note
 *   2. What it affects — system-specific impact (combi vs stored)
 *   3. What to do      — softener compatibility, scale protection, maintenance
 *
 * Extracted from LiveSectionPage so it can be composed inside
 * LiveSectionShell independently of the section routing layer.
 */
import type { FullEngineResult } from '../../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';

interface Props {
  result: FullEngineResult;
  input: FullSurveyModelV1;
}

type ScalingRisk = 'low' | 'moderate' | 'high';

function deriveScalingRisk(
  category: 'soft' | 'moderate' | 'hard' | 'very_hard',
  silicateTax: boolean,
): ScalingRisk {
  if (category === 'very_hard' || (category === 'hard' && silicateTax)) return 'high';
  if (category === 'hard') return 'moderate';
  if (category === 'moderate') return 'low';
  return 'low';
}

const RISK_LABEL: Record<ScalingRisk, string> = {
  low: 'Low scaling risk',
  moderate: 'Moderate scaling risk',
  high: 'High scaling risk',
};

const RISK_COLOR: Record<ScalingRisk, string> = {
  low: '#276749',
  moderate: '#c05621',
  high: '#9b2c2c',
};

const RISK_BG: Record<ScalingRisk, string> = {
  low: '#f0fff4',
  moderate: '#fffaf0',
  high: '#fff5f5',
};

/** One plain-English consequence sentence per risk level for combi (plate HEX). */
const COMBI_RISK_SENTENCE: Record<ScalingRisk, string> = {
  low: 'Scale build-up on the plate heat exchanger is unlikely to be a significant issue here.',
  moderate:
    'Scale will gradually reduce plate heat exchanger efficiency — descaling every 3–5 years is advisable.',
  high: 'This area is likely to shorten plate heat exchanger life without scale protection.',
};

/** One plain-English consequence sentence per risk level for stored systems (cylinder coil). */
const STORED_RISK_SENTENCE: Record<ScalingRisk, string> = {
  low: 'Scale is unlikely to meaningfully affect cylinder coil recovery in this area.',
  moderate: 'Scale will gradually slow cylinder recovery rate — periodic coil descaling is advisable.',
  high: 'This area is more likely to slow cylinder recovery over time — scale protection is advisable.',
};

const BLOCK_HEADING_STYLE: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: '#4a5568',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.75rem',
  marginTop: 0,
};

const BLOCK_HEADING_STYLE_SPACED: React.CSSProperties = {
  ...BLOCK_HEADING_STYLE,
  marginTop: '1.5rem',
};

function softenerCompatibilityMessage(softenerPresent: boolean, isCombi: boolean): string {
  if (softenerPresent) return 'Softener fitted — scale risk is reduced';
  if (isCombi) {
    return 'Salt softener compatibility matters for on-demand hot water selection — check manufacturer guidance';
  }
  return 'Salt softener beneficial at coil side — check cylinder manufacturer guidance';
}

export default function GeochemistrySection({ result, input }: Props) {
  const { normalizer } = result;

  const silicateTax = normalizer.scalingScaffoldCoefficient > 1;
  const scalingRisk = deriveScalingRisk(normalizer.waterHardnessCategory, silicateTax);
  const isCombi = input.currentHeatSourceType === 'combi';
  const isMixergy = input.fullSurvey?.dhwCondition?.cylinderType === 'mixergy';
  const softenerPresent = input.fullSurvey?.dhwCondition?.softenerPresent === true;
  const hardnessLabel = normalizer.waterHardnessCategory.replace('_', ' ').toUpperCase();

  const riskSentence = isCombi ? COMBI_RISK_SENTENCE[scalingRisk] : STORED_RISK_SENTENCE[scalingRisk];

  return (
    <div className="result-section">

      {/* ── Block 1: Water quality ──────────────────────────────────────── */}
      <h3 style={BLOCK_HEADING_STYLE}>Water quality</h3>

      {/* Risk band */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: '10px',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: RISK_COLOR[scalingRisk],
            background: RISK_BG[scalingRisk],
            border: `1px solid ${RISK_COLOR[scalingRisk]}40`,
          }}
        >
          {RISK_LABEL[scalingRisk]}
        </span>
        <span style={{ fontSize: '0.85rem', color: '#4a5568' }}>{riskSentence}</span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Hardness band</span>
        <span className={`metric-value ${normalizer.waterHardnessCategory === 'soft' ? 'ok' : 'warning'}`}>
          {hardnessLabel} — {normalizer.cacO3Level} mg/L CaCO₃
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Scale tendency</span>
        <span className={`metric-value ${scalingRisk === 'low' ? 'ok' : 'warning'}`}>
          {scalingRisk === 'low' && 'Low — minimal scale deposit expected'}
          {scalingRisk === 'moderate' && 'Moderate — gradual scale deposit likely'}
          {scalingRisk === 'high' && 'High — accelerated scale deposit expected'}
        </span>
      </div>
      {silicateTax && (
        <div className="metric-row">
          <span className="metric-label">Silicate note</span>
          <span className="metric-value warning">
            High-silica geology — scale is harder to remove than CaCO₃ alone
          </span>
        </div>
      )}

      {/* ── Block 2: What it affects ────────────────────────────────────── */}
      <h3 style={BLOCK_HEADING_STYLE_SPACED}>What it affects</h3>

      {isCombi ? (
        <>
          <div className="metric-row">
            <span className="metric-label">On-demand hot water (plate HEX)</span>
            <span className={`metric-value ${scalingRisk !== 'low' ? 'warning' : 'ok'}`}>
              Scale hits the plate heat exchanger directly — hot-water performance and stability suffer first
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">DHW efficiency</span>
            <span className={`metric-value ${normalizer.tenYearEfficiencyDecayPct > 8 ? 'warning' : 'ok'}`}>
              {normalizer.tenYearEfficiencyDecayPct.toFixed(1)}% projected efficiency loss over 10 years
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Cycling and short draws</span>
            <span className={`metric-value ${scalingRisk !== 'low' ? 'warning' : 'ok'}`}>
              Frequent cycling accelerates scale degradation — on-demand systems are more exposed than stored
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Service life</span>
            <span className={`metric-value ${scalingRisk === 'high' ? 'warning' : 'ok'}`}>
              {scalingRisk === 'high'
                ? 'Scale shortens plate HEX life — expect earlier servicing or replacement'
                : 'Normal service intervals expected with routine maintenance'}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="metric-row">
            <span className="metric-label">Cylinder coil / recovery</span>
            <span className={`metric-value ${scalingRisk !== 'low' ? 'warning' : 'ok'}`}>
              Scale builds on the cylinder coil — recovery rate and efficiency are affected before hot-water availability
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">DHW efficiency</span>
            <span className={`metric-value ${normalizer.tenYearEfficiencyDecayPct > 8 ? 'warning' : 'ok'}`}>
              {normalizer.tenYearEfficiencyDecayPct.toFixed(1)}% projected efficiency loss over 10 years
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">User experience buffer</span>
            <span className="metric-value ok">
              Stored volume buffers user experience better than on-demand hot water does
            </span>
          </div>
          {isMixergy && (
            <div className="metric-row">
              <span className="metric-label">Mixergy — usable reserve</span>
              <span className="metric-value ok">
                Stratification keeps usable reserve better — but coil and heat-input side still matter
              </span>
            </div>
          )}
          <div className="metric-row">
            <span className="metric-label">Service life</span>
            <span className={`metric-value ${scalingRisk === 'high' ? 'warning' : 'ok'}`}>
              {scalingRisk === 'high'
                ? 'Coil efficiency degrades over time — descaling service recommended'
                : 'Normal service intervals expected with routine maintenance'}
            </span>
          </div>
        </>
      )}

      {/* ── Block 3: What to do ─────────────────────────────────────────── */}
      <h3 style={BLOCK_HEADING_STYLE_SPACED}>What to do</h3>

      <div className="metric-row">
        <span className="metric-label">Scale protection</span>
        <span className={`metric-value ${scalingRisk === 'low' ? 'ok' : 'warning'}`}>
          {scalingRisk === 'low' && 'Not required — water quality is unlikely to cause problems'}
          {scalingRisk === 'moderate' && 'Advisable — scale inhibitor or softener will extend component life'}
          {scalingRisk === 'high' && (isCombi
            ? 'Strongly advised for on-demand hot water — scale protection required to preserve plate HEX life'
            : 'Advisable — scale will affect coil efficiency over time without protection')}
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Salt softener compatibility</span>
        <span className={`metric-value ${softenerPresent ? 'ok' : scalingRisk !== 'low' ? 'warning' : 'ok'}`}>
          {softenerCompatibilityMessage(softenerPresent, isCombi)}
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Maintenance expectation</span>
        <span className={`metric-value ${scalingRisk === 'high' ? 'warning' : 'ok'}`}>
          {scalingRisk === 'low' && 'Standard annual service — no additional scale-specific action needed'}
          {scalingRisk === 'moderate' && (isCombi
            ? 'Descale plate HEX every 3–5 years; annual service'
            : 'Inspect and descale coil every 5 years; annual service')}
          {scalingRisk === 'high' && (isCombi
            ? 'Descale plate HEX every 2–3 years; annual service — scale protection is cost-effective here'
            : 'Descale coil every 3 years; annual service — stored hot water buffers outlet experience but coil efficiency still degrades')}
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label">On-demand vs stored hot water</span>
        <span className="metric-value">
          {isCombi
            ? 'On-demand hot water is more exposed to scale than stored — short draws and cycling bring scale into contact with the plate HEX more frequently'
            : 'Tank-fed hot water is more tolerant of poor water quality at the outlet — but coil efficiency still degrades over time'}
        </span>
      </div>

    </div>
  );
}
