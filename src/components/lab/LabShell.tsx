/**
 * LabShell — System Lab shell.
 *
 * Renders HouseFirstSimulatorDashboard, the canonical house-first UI for the
 * System Simulator at /?lab=1 and the System Lab card.
 *
 * The house-first model replaces the previous scroll-heavy tab stack with:
 *   - central persistent house view (HouseStatusPanel)
 *   - roof-side heat source and efficiency widgets
 *   - live toast narration
 *   - draw-off telemetry chips beside active outlets
 *   - left slide-over: setup / configuration
 *   - right slide-over: engineering / efficiency detail
 *   - bottom sheet: timeline + scenarios
 *   - top sheet: warnings / physics explainers
 */

import HouseFirstSimulatorDashboard from '../../explainers/lego/simulator/HouseFirstSimulatorDashboard';

interface Props {
  onHome: () => void;
  engineInput?: import('../../engine/schema/EngineInputV2_3').EngineInputV2_3;
}

export default function LabShell({ onHome }: Props) {
  return <HouseFirstSimulatorDashboard onHome={onHome} />;
}
