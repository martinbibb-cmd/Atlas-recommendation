// src/explainers/lego/animation/render/InstrumentStrip.tsx

import type { CapacitySummary } from '../capacitySummary'

interface InstrumentStripProps {
  summary: CapacitySummary
  /** Store temperature (°C) — only provided for cylinder system types. */
  storeTempC?: number
}

const COMPONENT_LABELS: Record<CapacitySummary['limitingComponent'], string> = {
  Supply:  'Mains supply',
  Pipe:    'Distribution pipework',
  Thermal: 'Combi DHW heat exchanger',
  Demand:  'Demand',
}

/** Usable hot-water threshold (°C). */
const USABLE_HOT_THRESHOLD_C = 45

/**
 * Instrument strip — shows computed capacity values, the bottleneck component,
 * and any active warnings as chips.
 */
export function InstrumentStrip({ summary, storeTempC }: InstrumentStripProps) {
  const { limitingComponent } = summary
  const isCylinder = storeTempC !== undefined
  const usableHot = isCylinder ? storeTempC >= USABLE_HOT_THRESHOLD_C : undefined

  return (
    <div className="instrument-strip">

      {/* Capacity readouts */}
      <div className="instrument-strip__readouts">
        <InstrumentReadout
          label="Demand"
          value={`${summary.demandTotalLpm.toFixed(1)} L/min`}
          highlight={false}
        />
        <InstrumentReadout
          label="Supply cap"
          value={`${summary.supplyCapLpm.toFixed(1)} L/min`}
          highlight={limitingComponent === 'Supply'}
        />
        <InstrumentReadout
          label="Pipe cap"
          value={`${summary.pipeCapLpm === Infinity ? '∞' : summary.pipeCapLpm.toFixed(1)} L/min`}
          highlight={limitingComponent === 'Pipe'}
        />
        {!isCylinder && (
          <InstrumentReadout
            label="Thermal cap"
            value={`${summary.thermalCapLpm === Infinity ? '∞' : summary.thermalCapLpm.toFixed(1)} L/min`}
            highlight={limitingComponent === 'Thermal'}
          />
        )}
        {isCylinder && (
          <>
            <InstrumentReadout
              label="Store temp"
              value={`${storeTempC.toFixed(0)} °C`}
              highlight={false}
            />
            <InstrumentReadout
              label="Usable hot water"
              value={usableHot ? 'Yes' : 'No'}
              highlight={!usableHot}
            />
          </>
        )}
        <InstrumentReadout
          label="Hydraulic flow"
          value={`${summary.hydraulicFlowLpm.toFixed(1)} L/min`}
          highlight={false}
        />
      </div>

      {/* Bottleneck label */}
      <div className="instrument-strip__bottleneck">
        <span className="instrument-strip__bottleneck-label">Bottleneck:</span>
        <span className="instrument-strip__bottleneck-value">
          {COMPONENT_LABELS[limitingComponent]}
        </span>
      </div>

      {/* Warnings */}
      {summary.warnings.length > 0 && (
        <div className="instrument-strip__warnings">
          {summary.warnings.map((w, i) => (
            <span key={i} className="instrument-strip__warning-chip">
              ⚠ {w}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function InstrumentReadout(props: { label: string; value: string; highlight: boolean }) {
  return (
    <div className={`instrument-readout${props.highlight ? ' instrument-readout--active' : ''}`}>
      <span className="instrument-readout__label">{props.label}</span>
      <span className="instrument-readout__value">{props.value}</span>
    </div>
  )
}
