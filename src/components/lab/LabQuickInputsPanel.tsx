/**
 * LabQuickInputsPanel.tsx
 *
 * Minimal "Lab Quick Inputs" gate.
 *
 * Shown when the user tries to open System Lab but key simulation fields are
 * absent.  Collects only the fields that are:
 *   1. actually needed by the lab
 *   2. not already known from Fast Choice
 *   3. cheap for the user to answer
 *
 * Intentionally plain — this is a functional gate, not a polished survey.
 * Chip / segmented-button selectors for every field; no accordions, no wizard.
 */

import { useState } from 'react';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { LabQuickField } from '../../lib/lab/getMissingLabFields';
import {
  mergeLabQuickInputs,
  type LabQuickValues,
  type MainsPerformance,
} from '../../lib/lab/mergeLabQuickInputs';
import './LabQuickInputsPanel.css';

// ── Chip component ────────────────────────────────────────────────────────────

function Chip<T extends string | number>({
  value,
  selected,
  onSelect,
  label,
}: {
  value: T;
  selected: boolean;
  onSelect: (v: T) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`lqi-chip${selected ? ' lqi-chip--selected' : ''}`}
      onClick={() => onSelect(value)}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="lqi-row">
      <div className="lqi-row__label">{label}</div>
      <div className="lqi-row__chips">{children}</div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Fields that are missing from the existing partial input. */
  missingFields: LabQuickField[];
  /** Existing partial input (from Fast Choice or empty for direct home → Lab). */
  initialInput?: Partial<EngineInputV2_3>;
  /** Called with the merged, complete engine input once the user hits Run Lab. */
  onComplete: (input: EngineInputV2_3) => void;
  /** Called when the user dismisses the panel without proceeding. */
  onCancel: () => void;
}

export default function LabQuickInputsPanel({
  missingFields,
  initialInput = {},
  onComplete,
  onCancel,
}: Props) {
  const missingIds = new Set(missingFields.map(f => f.id));

  const [quick, setQuick] = useState<LabQuickValues>({});
  /** Tracks whether the user explicitly answered "Not sure" for plan type. */
  const [planTypeNotSure, setPlanTypeNotSure] = useState(false);

  function set<K extends keyof LabQuickValues>(key: K, value: LabQuickValues[K]) {
    setQuick(prev => ({ ...prev, [key]: value }));
  }

  // Determine which fields to show (only the ones flagged as missing)
  const showSystemType    = missingIds.has('systemType');
  const showBathrooms     = missingIds.has('bathroomCount');
  const showOccupancy     = missingIds.has('occupancyCount');
  const showMains         = missingIds.has('mainsPerformance');
  const showPrimaryPipe   = missingIds.has('primaryPipeSize');
  const showPlanType      = missingIds.has('planType');

  // Show cylinder-type chip only when system requires a stored cylinder
  const effectiveSystemType = initialInput.currentHeatSourceType ?? quick.currentHeatSourceType;
  const needsCylinder =
    effectiveSystemType === 'system' ||
    effectiveSystemType === 'regular' ||
    effectiveSystemType === 'ashp';

  // "Plan type" answered when user picked y_plan/s_plan OR said "Not sure"
  const planTypeAnswered =
    quick.systemPlanType != null || planTypeNotSure;

  // Validate: all shown required fields must have an answer
  const answered = (
    (!showSystemType  || quick.currentHeatSourceType != null) &&
    (!showBathrooms   || quick.bathroomCount != null) &&
    (!showOccupancy   || quick.occupancyCount != null) &&
    (!showMains       || quick.mainsPerformance != null) &&
    (!showPrimaryPipe || quick.primaryPipeDiameter != null) &&
    (!showPlanType    || planTypeAnswered)
  );

  function handleRunLab() {
    const merged = mergeLabQuickInputs(initialInput, quick);
    onComplete(merged);
  }

  const fieldCount = missingFields.length;

  return (
    <div className="lqi-wrap">
      <div className="lqi-card">

        {/* Header */}
        <div className="lqi-header">
          <button className="back-btn" onClick={onCancel} aria-label="Cancel">← Back</button>
          <h2 className="lqi-title">A few quick inputs are needed to run the simulator.</h2>
          <p className="lqi-subtitle">
            {fieldCount === 1
              ? '1 field needed before the lab can run.'
              : `${fieldCount} fields needed before the lab can run.`}
          </p>
        </div>

        {/* Fields */}
        <div className="lqi-fields">

          {showSystemType && (
            <FieldRow label="System">
              {(
                [
                  { value: 'combi',   label: 'Combi' },
                  { value: 'system',  label: 'System + cylinder' },
                  { value: 'regular', label: 'Regular' },
                  { value: 'ashp',    label: 'Heat pump' },
                ] as { value: 'combi' | 'system' | 'regular' | 'ashp'; label: string }[]
              ).map(opt => (
                <Chip
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  selected={quick.currentHeatSourceType === opt.value}
                  onSelect={v => set('currentHeatSourceType', v)}
                />
              ))}
            </FieldRow>
          )}

          {showBathrooms && (
            <FieldRow label="Bathrooms">
              {([1, 2, 3] as const).map(n => (
                <Chip
                  key={n}
                  value={n}
                  label={n === 3 ? '3+' : String(n)}
                  selected={quick.bathroomCount === n}
                  onSelect={v => set('bathroomCount', v)}
                />
              ))}
            </FieldRow>
          )}

          {showOccupancy && (
            <FieldRow label="Occupancy">
              {(
                [
                  { value: 2 as const, label: '1–2' },
                  { value: 3 as const, label: '3–4' },
                  { value: 5 as const, label: '5+' },
                ]
              ).map(opt => (
                <Chip
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  selected={quick.occupancyCount === opt.value}
                  onSelect={v => set('occupancyCount', v)}
                />
              ))}
            </FieldRow>
          )}

          {showMains && (
            <FieldRow label="Mains performance">
              {(
                [
                  { value: 'good'       as MainsPerformance, label: 'Good' },
                  { value: 'borderline' as MainsPerformance, label: 'Borderline' },
                  { value: 'weak'       as MainsPerformance, label: 'Weak' },
                ]
              ).map(opt => (
                <Chip
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  selected={quick.mainsPerformance === opt.value}
                  onSelect={v => set('mainsPerformance', v)}
                />
              ))}
            </FieldRow>
          )}

          {showPrimaryPipe && (
            <FieldRow label="Primary pipe">
              {(
                [
                  { value: 15 as const, label: '15 mm' },
                  { value: 22 as const, label: '22 mm' },
                  { value: 28 as const, label: '28 mm' },
                ]
              ).map(opt => (
                <Chip
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  selected={quick.primaryPipeDiameter === opt.value}
                  onSelect={v => set('primaryPipeDiameter', v)}
                />
              ))}
            </FieldRow>
          )}

          {/* Conditional: cylinder type when system has stored DHW */}
          {needsCylinder && (
            <FieldRow label="Cylinder type">
              {(
                [
                  { value: 'standard' as const, label: 'Standard' },
                  { value: 'mixergy'  as const, label: 'Stored hot water with top-down heating and active stratification.' },
                  { value: 'unvented' as const, label: 'Unvented (mains-fed supply)' },
                ]
              ).map(opt => (
                <Chip
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  selected={quick.cylinderType === opt.value}
                  onSelect={v => set('cylinderType', v)}
                />
              ))}
            </FieldRow>
          )}

          {showPlanType && (
            <FieldRow label="Heating / hot water layout">
              {(
                [
                  { value: 'y_plan' as const, label: 'Y-plan' },
                  { value: 's_plan' as const, label: 'S-plan' },
                ]
              ).map(opt => (
                <Chip
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  selected={quick.systemPlanType === opt.value}
                  onSelect={v => {
                    set('systemPlanType', v);
                    setPlanTypeNotSure(false);
                  }}
                />
              ))}
              {(() => {
                const notSureSelected = planTypeNotSure && quick.systemPlanType == null;
                return (
                  <button
                    type="button"
                    className={`lqi-chip${notSureSelected ? ' lqi-chip--selected' : ''}`}
                    onClick={() => {
                      setQuick(prev => ({ ...prev, systemPlanType: undefined }));
                      setPlanTypeNotSure(true);
                    }}
                    aria-pressed={notSureSelected}
                  >
                    Not sure
                  </button>
                );
              })()}
            </FieldRow>
          )}
        </div>

        {/* Actions */}
        <div className="lqi-actions">
          <button
            type="button"
            className="cta-btn lqi-run-btn"
            onClick={handleRunLab}
            disabled={!answered}
            aria-disabled={!answered}
          >
            Run Lab →
          </button>
          {!answered && (
            <p className="lqi-hint" role="status">
              Answer all highlighted fields above to enable the lab.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
