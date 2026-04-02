/**
 * RecommendationStep.tsx
 *
 * Final step in the canonical full survey — the surveyor records the agreed
 * installation recommendation before completing the survey.
 *
 * Sections:
 *   1. Heat source selection
 *   2. Water source selection
 *   3. Powerflush decision
 *   4. Filter selection
 *   5. Additions (sealed system kit, smart controls, TRVs, weather
 *      compensation, replacement radiators, Mixergy)
 *   6. Free-text surveyor notes
 */

import './RecommendationStep.css';
import {
  type RecommendationState,
  type HeatSourceType,
  type WaterSourceType,
  type PowerflushType,
  type FilterType,
  HEAT_SOURCE_OPTIONS,
  WATER_SOURCE_OPTIONS,
  POWERFLUSH_OPTIONS,
  FILTER_OPTIONS,
} from './recommendationTypes';

// ─── Sub-components ───────────────────────────────────────────────────────────

function OptionCard<T extends string>({
  value,
  label,
  sub,
  selected,
  onSelect,
}: {
  value: T;
  label: string;
  sub: string;
  selected: boolean;
  onSelect: (v: T) => void;
}) {
  return (
    <button
      type="button"
      className={`rec-option-card${selected ? ' rec-option-card--selected' : ''}`}
      onClick={() => onSelect(value)}
      aria-pressed={selected}
    >
      <span className="rec-option-card__label">{label}</span>
      <span className="rec-option-card__sub">{sub}</span>
    </button>
  );
}

function SectionHeading({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="rec-section__heading">
      <span className="rec-section__heading-icon" aria-hidden="true">{icon}</span>
      <span className="rec-section__heading-text">{title}</span>
    </div>
  );
}

function AdditionToggle({
  checked,
  label,
  sub,
  onChange,
}: {
  checked: boolean;
  label: string;
  sub: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`rec-addition${checked ? ' rec-addition--checked' : ''}`}>
      <input
        type="checkbox"
        className="rec-addition__checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="rec-addition__label">{label}</span>
      <span className="rec-addition__sub">{sub}</span>
    </label>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  state: RecommendationState;
  onChange: (next: RecommendationState) => void;
  onNext: () => void;
  onPrev: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecommendationStep({ state, onChange, onNext, onPrev }: Props) {
  function setHeatSource(v: HeatSourceType) {
    onChange({ ...state, heatSource: v });
  }
  function setWaterSource(v: WaterSourceType) {
    onChange({ ...state, waterSource: v });
  }
  function setPowerflush(v: PowerflushType) {
    onChange({ ...state, powerflush: v });
  }
  function setFilter(v: FilterType) {
    onChange({ ...state, filter: v });
  }
  function setAddition(key: keyof RecommendationState['additions'], value: boolean) {
    onChange({ ...state, additions: { ...state.additions, [key]: value } });
  }
  function setNotes(v: string) {
    onChange({ ...state, notes: v });
  }

  const canProceed = state.heatSource !== null && state.waterSource !== null;

  return (
    <div className="rec-step" data-testid="recommendation-step">
      <div className="rec-step__header">
        <h2 className="rec-step__title">✅ Your Recommendation</h2>
        <p className="rec-step__intro">
          Record the agreed installation recommendation for this property.
        </p>
      </div>

      {/* ── Section 1: Heat source ───────────────────────────────────── */}
      <section className="rec-section">
        <SectionHeading icon="🔥" title="Heat source" />
        <div className="rec-option-grid">
          {HEAT_SOURCE_OPTIONS.map(opt => (
            <OptionCard<HeatSourceType>
              key={opt.value}
              value={opt.value}
              label={opt.label}
              sub={opt.sub}
              selected={state.heatSource === opt.value}
              onSelect={setHeatSource}
            />
          ))}
        </div>
      </section>

      {/* ── Section 2: Water source ──────────────────────────────────── */}
      <section className="rec-section">
        <SectionHeading icon="💧" title="Water source" />
        <div className="rec-option-grid">
          {WATER_SOURCE_OPTIONS.map(opt => (
            <OptionCard<WaterSourceType>
              key={opt.value}
              value={opt.value}
              label={opt.label}
              sub={opt.sub}
              selected={state.waterSource === opt.value}
              onSelect={setWaterSource}
            />
          ))}
        </div>
      </section>

      {/* ── Section 3: Powerflush ────────────────────────────────────── */}
      <section className="rec-section">
        <SectionHeading icon="🚿" title="Powerflush" />
        <div className="rec-option-grid rec-option-grid--compact">
          {POWERFLUSH_OPTIONS.map(opt => (
            <OptionCard<PowerflushType>
              key={opt.value}
              value={opt.value}
              label={opt.label}
              sub={opt.sub}
              selected={state.powerflush === opt.value}
              onSelect={setPowerflush}
            />
          ))}
        </div>
      </section>

      {/* ── Section 4: Filter ────────────────────────────────────────── */}
      <section className="rec-section">
        <SectionHeading icon="🧲" title="Filter" />
        <div className="rec-option-grid rec-option-grid--compact">
          {FILTER_OPTIONS.map(opt => (
            <OptionCard<FilterType>
              key={opt.value}
              value={opt.value}
              label={opt.label}
              sub={opt.sub}
              selected={state.filter === opt.value}
              onSelect={setFilter}
            />
          ))}
        </div>
      </section>

      {/* ── Section 5: Additions ─────────────────────────────────────── */}
      <section className="rec-section">
        <SectionHeading icon="➕" title="Additions" />
        <div className="rec-additions-list">
          <AdditionToggle
            checked={state.additions.sealedSystemKit}
            label="Sealed system kit"
            sub="Expansion vessel, filling loop, pressure gauge"
            onChange={v => setAddition('sealedSystemKit', v)}
          />
          <AdditionToggle
            checked={state.additions.smartControls}
            label="Smart controls"
            sub="Programmable room thermostat with scheduling"
            onChange={v => setAddition('smartControls', v)}
          />
          <AdditionToggle
            checked={state.additions.trvs}
            label="TRVs"
            sub="Thermostatic radiator valves throughout"
            onChange={v => setAddition('trvs', v)}
          />
          <AdditionToggle
            checked={state.additions.weatherCompensation}
            label="Weather compensation"
            sub="Outdoor sensor for modulating flow temperature"
            onChange={v => setAddition('weatherCompensation', v)}
          />
          <AdditionToggle
            checked={state.additions.replacementRadiators}
            label="Replacement radiators"
            sub="Upsize or replace to match new heat source output"
            onChange={v => setAddition('replacementRadiators', v)}
          />
          <AdditionToggle
            checked={state.additions.mixergy}
            label="Mixergy"
            sub="Smart stratified cylinder upgrade"
            onChange={v => setAddition('mixergy', v)}
          />
        </div>
      </section>

      {/* ── Section 6: Surveyor notes ────────────────────────────────── */}
      <section className="rec-section">
        <SectionHeading icon="📝" title="Surveyor notes" />
        <textarea
          className="rec-notes"
          placeholder="Any additional notes, access constraints, or site-specific considerations…"
          value={state.notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
        />
      </section>

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <div className="rec-step__nav">
        <button type="button" className="rec-nav-btn rec-nav-btn--back" onClick={onPrev}>
          ← Back
        </button>
        <button
          type="button"
          className="rec-nav-btn rec-nav-btn--next"
          onClick={onNext}
          disabled={!canProceed}
          title={!canProceed ? 'Select a heat source and water source to continue' : undefined}
        >
          Complete survey →
        </button>
      </div>
    </div>
  );
}
