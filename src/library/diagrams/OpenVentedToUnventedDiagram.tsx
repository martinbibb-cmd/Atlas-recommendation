import './diagrams.css';
import { BeforeAfterSplit } from './primitives/BeforeAfterSplit';
import { ExplanationCallout } from './primitives/ExplanationCallout';
import { SystemTopologyPanel } from './primitives/SystemTopologyPanel';
import { WaterStoreTank } from './primitives/WaterStoreTank';

const SCREEN_READER_SUMMARY =
  'Side-by-side diagram. Left: open-vented system with cold water storage tank in loft and vented hot water cylinder. Right: sealed system with unvented cylinder fed directly by mains. Loft tanks are removed. Heating circuit remains unchanged.';

const WHAT_THIS_MEANS =
  'Switching to a sealed system with an unvented cylinder removes loft tanks and brings mains pressure to hot water outlets. The heating circuit and radiators remain unchanged.';

export interface OpenVentedToUnventedDiagramProps {
  printSafe?: boolean;
}

export function OpenVentedToUnventedDiagram({ printSafe = false }: OpenVentedToUnventedDiagramProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives"
      aria-label="Open-vented to sealed and unvented diagram"
      data-print-safe={printSafe ? 'true' : undefined}
    >
      <BeforeAfterSplit
        beforeLabel="Before: open-vented"
        afterLabel="After: sealed + unvented"
        screenReaderSummary={SCREEN_READER_SUMMARY}
        before={
          <SystemTopologyPanel
            label="Open-vented system"
            screenReaderSummary="Loft cold water storage tank feeds vented hot water cylinder at low tank-fed pressure."
          >
            <WaterStoreTank
              label="Cold water storage tank (loft)"
              capacityLabel="100–150 L"
              pressureLabel="Tank-fed supply"
            />
            <WaterStoreTank
              label="Vented hot water cylinder"
              capacityLabel="110–140 L"
              pressureLabel="Tank-fed supply"
            />
            <p className="atlas-edu-diagram__label">Heating circuit: unchanged</p>
          </SystemTopologyPanel>
        }
        after={
          <SystemTopologyPanel
            label="Sealed system with unvented cylinder"
            screenReaderSummary="Loft tanks removed. Unvented cylinder fed directly by mains at full mains pressure."
          >
            <WaterStoreTank
              label="Unvented cylinder"
              capacityLabel="150–250 L"
              pressureLabel="Mains-fed supply"
            />
            <p className="atlas-edu-diagram__label">Loft tanks: removed</p>
            <p className="atlas-edu-diagram__label">Heating circuit: unchanged</p>
          </SystemTopologyPanel>
        }
      />

      <ExplanationCallout
        label="What stays the same"
        body="The heating circuit, radiators, and boiler are retained. Only the hot water storage side changes: loft tanks are removed and a mains-fed unvented cylinder replaces the vented cylinder."
      />

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
