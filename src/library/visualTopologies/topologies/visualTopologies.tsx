import type { CSSProperties, ReactNode } from 'react';
import {
  ABVPrimitive,
  BoilerPrimitive,
  CylinderPrimitive,
  ExpansionVesselPrimitive,
  FillingLoopPrimitive,
  HeaderTankPrimitive,
  MagneticFilterPrimitive,
  MixergyCylinderPrimitive,
  PipeLoopPrimitive,
  PowerflushMachinePrimitive,
  PressureGaugePrimitive,
  PumpPrimitive,
  RadiatorPrimitive,
  ThermalStorePrimitive,
} from '../../visualPrimitives/primitives';
import {
  AUX_COLOUR,
  FLOW_COLOUR,
  PIPE_STROKE_BRANCH,
  PIPE_STROKE_MAIN,
  PIPE_LABEL_FONT_SIZE,
  PIPE_LABEL_STANDOFF,
  PRINT_FLOW_COLOUR,
  PRINT_RETURN_COLOUR,
  RETURN_COLOUR,
  RETURN_PIPE_DASH,
  PRINT_RETURN_DASH,
} from '../../visualPrimitives/primitiveTokens';
import type { VisualTopologyRenderOptions } from './types';
import type { VisualTopologyId } from '../visualTopologyRegistry';

function frameStyle(mobileWidth: boolean): CSSProperties {
  return {
    position: 'relative',
    width: mobileWidth ? 320 : 860,
    height: mobileWidth ? 500 : 430,
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    background: '#fff',
    overflow: 'hidden',
  };
}

function nodeStyle(left: number, top: number): CSSProperties {
  return { position: 'absolute', left, top };
}

function TopologyNode({
  role,
  left,
  top,
  children,
}: {
  role: string;
  left: number;
  top: number;
  children: ReactNode;
}) {
  return (
    <div data-topology-component-role={role} style={nodeStyle(left, top)}>
      {children}
    </div>
  );
}

function noCylinderNoteStyle(): CSSProperties {
  return { position: 'absolute', right: 20, bottom: 18, fontSize: 12, color: '#475569' };
}

function pressureStateLabelStyle(): CSSProperties {
  return { position: 'absolute', left: 614, top: 22, fontSize: 11, color: '#6b7280', display: 'grid', gap: 98 };
}

function pipeStroke(printSafe: boolean, flow: boolean): string {
  if (flow) return printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR;
  return printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR;
}

function pipeDash(printSafe: boolean, flow: boolean): string | undefined {
  if (flow) return undefined;
  return printSafe ? PRINT_RETURN_DASH : RETURN_PIPE_DASH;
}

const SM_SCALE = 0.7;

type PortPoint = { x: number; y: number };

function scaledPoint(x: number, y: number): PortPoint {
  return { x: x * SM_SCALE, y: y * SM_SCALE };
}

function offsetPoint(left: number, top: number, point: PortPoint): PortPoint {
  return { x: left + point.x, y: top + point.y };
}

const CYLINDER_SM_PORTS = {
  hotOut: scaledPoint(42, 0),
  coldIn: scaledPoint(42, 132),
  coilFlowIn: scaledPoint(0, 87),
  coilFlowOut: scaledPoint(84, 100),
  safetyDischarge: scaledPoint(70, 90),
};

const THERMAL_STORE_SM_PORTS = {
  primaryIn: scaledPoint(4, 36),
  primaryOut: scaledPoint(4, 108),
  potableHotOut: scaledPoint(88, 36),
  potableColdIn: scaledPoint(88, 108),
};

const MAGNETIC_FILTER_SM_PORTS = {
  inlet: scaledPoint(4, 52),
  outlet: scaledPoint(156, 52),
};

/**
 * Returns SVG text props with a canonical 8px standoff from the pipe line.
 * direction: 'above' places label above (y offset = -standoff),
 *             'below' places label below (y offset = +standoff + fontSize).
 */
function pipeLabelProps(
  x: number,
  pipeY: number,
  direction: 'above' | 'below',
  fill: string,
): { x: number; y: number; fontSize: number; fontFamily: string; fill: string } {
  const y =
    direction === 'above'
      ? pipeY - PIPE_LABEL_STANDOFF
      : pipeY + PIPE_LABEL_STANDOFF + PIPE_LABEL_FONT_SIZE;
  return { x, y, fontSize: PIPE_LABEL_FONT_SIZE, fontFamily: 'system-ui, sans-serif', fill };
}

/**
 * Renders a directional arrowhead mid-pipe when pipeTrace mode is active.
 * Placed at (midX, y) pointing in the given direction.
 */
function MidPipeArrow({
  midX,
  y,
  direction,
  color,
}: {
  midX: number;
  y: number;
  direction: 'right' | 'left' | 'down' | 'up';
  color: string;
}) {
  const size = 5;
  let points: string;
  switch (direction) {
    case 'right':
      points = `${midX - size},${y - size} ${midX + size},${y} ${midX - size},${y + size}`;
      break;
    case 'left':
      points = `${midX + size},${y - size} ${midX - size},${y} ${midX + size},${y + size}`;
      break;
    case 'down':
      points = `${midX - size},${y - size} ${midX},${y + size} ${midX + size},${y - size}`;
      break;
    case 'up':
      points = `${midX - size},${y + size} ${midX},${y - size} ${midX + size},${y + size}`;
      break;
  }
  return <polygon points={points} fill={color} />;
}

function PipeLayer({
  children,
  mobileWidth,
}: {
  children: ReactNode;
  mobileWidth: boolean;
}) {
  return (
    <svg
      width={mobileWidth ? 320 : 860}
      height={mobileWidth ? 500 : 430}
      viewBox={mobileWidth ? '0 0 320 500' : '0 0 860 430'}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function TopologyShell({
  options,
  children,
}: {
  options: VisualTopologyRenderOptions;
  children: ReactNode;
}) {
  return <div style={frameStyle(options.mobileWidth)}>{children}</div>;
}

function OpenVentedVentedCylinderTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary flow ring */}
        <line x1={120} y1={140} x2={248} y2={140} stroke={flow} strokeWidth={w} />
        <line
          x1={248}
          y1={140}
          x2={312}
          y2={140}
          stroke={flow}
          strokeWidth={w}
          data-testid="pump-topology-circuit"
        />
        <line x1={312} y1={140} x2={560} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={560} y1={140} x2={560} y2={205} stroke={flow} strokeWidth={w} />
        {/*
          Return rail for primary loop.
        */}
        <line x1={560} y1={300} x2={223} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={223} y1={300} x2={120} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={120} y1={300} x2={120} y2={210} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Radiator branch spurs */}
        <line x1={348} y1={140} x2={348} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={284} y1={112} x2={284} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={494} y1={140} x2={494} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={430} y1={112} x2={430} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Close-coupled vent and feed pair near neutral point; pump sits downstream on flow. */}
        <line
          x1={176}
          y1={140}
          x2={176}
          y2={60}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="open-vented-close-coupled-vent"
        />
        <line
          x1={192}
          y1={140}
          x2={192}
          y2={300}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="open-vented-close-coupled-feed"
        />
        <line x1={176} y1={60} x2={700} y2={60} stroke={AUX_COLOUR} strokeWidth={PIPE_STROKE_BRANCH} />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={340} y={140} direction="right" color={flow} />
            <MidPipeArrow midX={340} y={300} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels — canonical standoff via pipeLabelProps */}
        <text {...pipeLabelProps(578, 140, 'above', flow)}>Primary flow</text>
        <text {...pipeLabelProps(360, 300, 'below', ret)}>Primary return</text>
        <text {...pipeLabelProps(706, 60, 'above', AUX_COLOUR)}>Close-coupled vent/feed</text>
      </PipeLayer>

      <TopologyNode role="boiler" left={56} top={160}><BoilerPrimitive variant="regular" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="primary_flow_pump_downstream_vent_feed" left={245} top={119}><PumpPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_1" left={274} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_2" left={420} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="header_tank" left={666} top={18}><HeaderTankPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="vented_cylinder" left={520} top={170}><CylinderPrimitive variant="vented" fillLevel={0.7} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}

function SealedUnventedCylinderTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);
  const cylinderPorts = {
    hotOut: offsetPoint(520, 160, CYLINDER_SM_PORTS.hotOut),
    coldIn: offsetPoint(520, 160, CYLINDER_SM_PORTS.coldIn),
    coilFlowIn: offsetPoint(520, 160, CYLINDER_SM_PORTS.coilFlowIn),
    coilFlowOut: offsetPoint(520, 160, CYLINDER_SM_PORTS.coilFlowOut),
    safetyDischarge: offsetPoint(520, 160, CYLINDER_SM_PORTS.safetyDischarge),
  };

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary flow ring */}
        <line x1={120} y1={140} x2={520} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={520} y1={140} x2={520} y2={cylinderPorts.coilFlowIn.y} stroke={flow} strokeWidth={w} />
        {/* Return pipe — system boiler internal pump assumed; no external pump primitive. */}
        <line x1={520} y1={300} x2={120} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={120} y1={300} x2={120} y2={205} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Radiator branch spurs */}
        <line x1={340} y1={140} x2={340} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={276} y1={112} x2={276} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={484} y1={140} x2={484} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={420} y1={112} x2={420} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Cylinder DHW stubs */}
        <line
          x1={cylinderPorts.coilFlowOut.x}
          y1={cylinderPorts.coilFlowOut.y}
          x2={680}
          y2={cylinderPorts.coilFlowOut.y}
          stroke={ret}
          strokeWidth={PIPE_STROKE_BRANCH}
          strokeDasharray={pipeDash(options.printSafe, false)}
          data-testid="sealed-unvented-expansion-vessel-return-branch"
        />
        <line x1={520} y1={cylinderPorts.coilFlowIn.y} x2={680} y2={cylinderPorts.coilFlowIn.y} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={cylinderPorts.coldIn.x} y1={cylinderPorts.coldIn.y} x2={760} y2={cylinderPorts.coldIn.y} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={cylinderPorts.hotOut.x} y1={cylinderPorts.hotOut.y} x2={760} y2={cylinderPorts.hotOut.y} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        {/* G3 D2 discharge route — continuous fall away from cylinder */}
        <line
          x1={cylinderPorts.safetyDischarge.x}
          y1={cylinderPorts.safetyDischarge.y}
          x2={760}
          y2={334}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="d2-discharge-pipe"
        />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={320} y={140} direction="right" color={flow} />
            <MidPipeArrow midX={320} y={300} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(682, cylinderPorts.coldIn.y, 'above', ret)}>Mains cold in</text>
        <text {...pipeLabelProps(682, cylinderPorts.hotOut.y, 'above', flow)}>Hot draw-off out</text>
        <text {...pipeLabelProps(646, 318, 'below', AUX_COLOUR)}>D2 safety discharge</text>
      </PipeLayer>

      <TopologyNode role="boiler" left={56} top={156}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_1" left={266} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_2" left={410} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="unvented_cylinder" left={520} top={160}><CylinderPrimitive variant="unvented" fillLevel={0.75} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="filling_loop_disconnected_default" left={364} top={252}><FillingLoopPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="expansion_vessel_on_primary_return" left={635} top={250}><ExpansionVesselPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pressure_gauge" left={610} top={88}><PressureGaugePrimitive pressureBar={1.3} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}

function CombiDirectHotWaterTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary CH ring */}
        <line x1={220} y1={140} x2={620} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={620} y1={140} x2={620} y2={300} stroke={flow} strokeWidth={w} />
        <line x1={620} y1={300} x2={220} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={220} y1={300} x2={220} y2={220} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Radiator branch spurs */}
        <line x1={414} y1={140} x2={414} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={350} y1={112} x2={350} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={570} y1={140} x2={570} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={506} y1={112} x2={506} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* DHW stubs from combi */}
        <line x1={188} y1={250} x2={80} y2={250} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={188} y1={210} x2={80} y2={210} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={420} y={140} direction="right" color={flow} />
            <MidPipeArrow midX={420} y={300} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(86, 210, 'above', flow)}>Hot water out</text>
        <text {...pipeLabelProps(86, 250, 'below', ret)}>Mains cold in</text>
        <text {...pipeLabelProps(520, 140, 'above', flow)}>CH flow</text>
        <text {...pipeLabelProps(500, 300, 'below', ret)}>CH return</text>
      </PipeLayer>

      <TopologyNode role="combi_boiler" left={142} top={164}><BoilerPrimitive variant="combi" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_1" left={340} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_2" left={496} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      {options.showLabels && <div style={noCylinderNoteStyle()}>No cylinder</div>}
    </TopologyShell>
  );
}

function MixergyStratifiedTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary charging loop */}
        <line x1={130} y1={190} x2={370} y2={190} stroke={flow} strokeWidth={w} />
        {/* Return pipe — system boiler internal pump assumed; no external pump primitive. */}
        <line x1={370} y1={290} x2={130} y2={290} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={130} y1={290} x2={130} y2={248} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Cylinder charging stubs */}
        <line x1={370} y1={190} x2={480} y2={190} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={370} y1={290} x2={480} y2={290} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* DHW stubs */}
        <line x1={540} y1={290} x2={660} y2={290} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={540} y1={178} x2={660} y2={178} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={250} y={190} direction="right" color={flow} />
            <MidPipeArrow midX={250} y={290} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(666, 178, 'above', flow)}>Hot draw-off from top</text>
        <text {...pipeLabelProps(666, 290, 'below', ret)}>Cold mains entry</text>
        <text {...pipeLabelProps(378, 190, 'above', flow)}>Charging heat input</text>
      </PipeLayer>

      <TopologyNode role="boiler" left={66} top={170}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="mixergy_cylinder" left={470} top={140}><MixergyCylinderPrimitive stateOfChargePct={70} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}

function ThermalStoreTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);
  const storePorts = {
    primaryIn: offsetPoint(430, 114, THERMAL_STORE_SM_PORTS.primaryIn),
    primaryOut: offsetPoint(430, 114, THERMAL_STORE_SM_PORTS.primaryOut),
    potableHotOut: offsetPoint(430, 114, THERMAL_STORE_SM_PORTS.potableHotOut),
    potableColdIn: offsetPoint(430, 114, THERMAL_STORE_SM_PORTS.potableColdIn),
  };

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/*
          PRIMARY water loop — system/boiler water stored in vessel body (amber).
          Flow from boiler → store primary-in (left-top of store).
          Return from store primary-out (left-bottom) → pump → boiler.
        */}
        {/* Flow passes through external pump on primary flow (regular boiler layout). */}
        <line x1={132} y1={176} x2={173} y2={176} stroke={flow} strokeWidth={w} data-testid="thermal-store-primary-pipe" />
        <line x1={237} y1={176} x2={420} y2={176} stroke={flow} strokeWidth={w} data-testid="pump-topology-circuit" />
        <line x1={420} y1={176} x2={storePorts.primaryIn.x} y2={176} stroke={flow} strokeWidth={w} data-testid="thermal-store-primary-pipe" />
        <line x1={storePorts.primaryIn.x} y1={176} x2={storePorts.primaryIn.x} y2={storePorts.primaryIn.y} stroke={flow} strokeWidth={w} />
        {/* Return path back to boiler (no pump on return). */}
        <line x1={storePorts.primaryOut.x} y1={storePorts.primaryOut.y} x2={storePorts.primaryOut.x} y2={286} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={420} y1={286} x2={132} y2={286} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="thermal-store-primary-pipe" />
        <line x1={storePorts.primaryOut.x} y1={286} x2={420} y2={286} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="thermal-store-primary-pipe" />
        <line x1={132} y1={286} x2={132} y2={232} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/*
          POTABLE water path — cold mains enters coil (bottom-right of store),
          heated by primary water, exits as hot DHW (top-right of store).
          Separate from primary loop — no shared pipe segments.
        */}
        <line x1={storePorts.potableColdIn.x} y1={storePorts.potableColdIn.y} x2={storePorts.potableColdIn.x} y2={226} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={storePorts.potableColdIn.x} y1={226} x2={676} y2={226} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="thermal-store-potable-pipe" />
        <line x1={storePorts.potableHotOut.x} y1={storePorts.potableHotOut.y} x2={storePorts.potableHotOut.x} y2={162} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={storePorts.potableHotOut.x} y1={162} x2={676} y2={162} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} data-testid="thermal-store-potable-pipe" />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={276} y={176} direction="right" color={flow} />
            <MidPipeArrow midX={276} y={286} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(528, 162, 'above', flow)}>Potable hot water out</text>
        <text {...pipeLabelProps(528, 226, 'below', ret)}>Potable mains in</text>
        <text {...pipeLabelProps(170, 176, 'above', flow)}>Primary water loop</text>
        <text {...pipeLabelProps(528, 246, 'below', options.printSafe ? '#000' : '#334155')}>Potable path isolated via internal coil</text>
      </PipeLayer>

      <TopologyNode role="boiler" left={64} top={154}><BoilerPrimitive variant="regular" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pump" left={170} top={155}><PumpPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="thermal_store" left={430} top={114}><ThermalStorePrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}

function PowerflushServiceTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);
  const dirty = options.printSafe ? '#374151' : '#92400e';
  const clean = options.printSafe ? '#111827' : '#16a34a';

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary flow ring */}
        <line x1={260} y1={140} x2={690} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={690} y1={140} x2={690} y2={290} stroke={flow} strokeWidth={w} />
        <line x1={690} y1={290} x2={260} y2={290} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={260} y1={290} x2={260} y2={170} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Radiator branch spurs */}
        <line x1={390} y1={140} x2={390} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={326} y1={112} x2={326} y2={290} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={542} y1={140} x2={542} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={478} y1={112} x2={478} y2={290} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={694} y1={140} x2={694} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={630} y1={112} x2={630} y2={290} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Powerflush machine hose connections */}
        <line x1={230} y1={174} x2={140} y2={174} stroke={dirty} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray="6 3" />
        <line x1={230} y1={252} x2={140} y2={252} stroke={clean} strokeWidth={PIPE_STROKE_BRANCH} />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={475} y={140} direction="right" color={flow} />
            <MidPipeArrow midX={475} y={290} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(62, 174, 'above', dirty)}>Dirty return path</text>
        <text {...pipeLabelProps(62, 252, 'below', clean)}>Clean return path</text>
      </PipeLayer>

      <TopologyNode role="powerflush_machine" left={26} top={168}><PowerflushMachinePrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_1" left={316} top={70}><RadiatorPrimitive size="sm" temperatureTone="cool" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_2" left={468} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_3" left={620} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="boiler" left={690} top={188}><BoilerPrimitive variant="regular" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="magnetic_filter_return_before_boiler" left={560} top={248}><MagneticFilterPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}

function AbvProtectedLoopTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary ring */}
        <line x1={130} y1={140} x2={620} y2={140} stroke={flow} strokeWidth={w} />
        <line
          x1={620}
          y1={140}
          x2={620}
          y2={300}
          stroke={flow}
          strokeWidth={w}
          data-testid="abv-restriction-boundary"
        />
        {/* Return path — system boiler internal pump assumed; no external pump primitive. */}
        <line x1={620} y1={300} x2={130} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={130} y1={300} x2={130} y2={210} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Radiator branch spurs */}
        <line x1={348} y1={140} x2={348} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={284} y1={112} x2={284} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={494} y1={140} x2={494} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={430} y1={112} x2={430} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        {/* ABV bridge — maintains PIPE_STROKE_BRANCH (AUX path) */}
        <line
          x1={556}
          y1={140}
          x2={556}
          y2={300}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="abv-downstream-boiler-upstream-restrictions-bridge"
        />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={375} y={140} direction="right" color={flow} />
            <MidPipeArrow midX={375} y={300} direction="left" color={ret} />
          </>
        )}
      </PipeLayer>

      <TopologyNode role="boiler" left={60} top={164}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="restriction_radiator_branch_1" left={274} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="restriction_radiator_branch_2" left={420} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="abv_after_boiler_before_restrictions" left={470} top={176}><ABVPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}

function MagneticFilterOnReturnTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);
  const filterPorts = {
    inlet: offsetPoint(188, 246, MAGNETIC_FILTER_SM_PORTS.inlet),
    outlet: offsetPoint(188, 246, MAGNETIC_FILTER_SM_PORTS.outlet),
  };

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary ring */}
        <line x1={140} y1={140} x2={560} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={560} y1={140} x2={560} y2={300} stroke={flow} strokeWidth={w} />
        <line x1={560} y1={300} x2={filterPorts.outlet.x} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={filterPorts.outlet.x} y1={300} x2={filterPorts.outlet.x} y2={filterPorts.outlet.y} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={filterPorts.inlet.x} y1={filterPorts.inlet.y} x2={filterPorts.inlet.x} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={filterPorts.inlet.x} y1={300} x2={140} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={140} y1={300} x2={140} y2={220} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Radiator branch spurs */}
        <line x1={322} y1={140} x2={322} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={258} y1={112} x2={258} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={468} y1={140} x2={468} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={404} y1={112} x2={404} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={350} y={140} direction="right" color={flow} />
            <MidPipeArrow midX={350} y={300} direction="left" color={ret} />
          </>
        )}

        {/* Pipe label */}
        <text {...pipeLabelProps(590, 300, 'above', ret)}>Clean return into boiler</text>
        <line
          x1={Math.min(filterPorts.inlet.x, filterPorts.outlet.x)}
          y1={300}
          x2={Math.max(filterPorts.inlet.x, filterPorts.outlet.x)}
          y2={300}
          stroke="transparent"
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="magnetic-filter-final-return-before-boiler"
        />
      </PipeLayer>

      <TopologyNode role="boiler" left={70} top={164}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_1" left={248} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_2" left={394} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="magnetic_filter_return_final_before_boiler" left={188} top={246}><MagneticFilterPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}

function SystemPressureLayoutTopology({ options }: { options: VisualTopologyRenderOptions }) {
  return (
    <TopologyShell options={options}>
      <TopologyNode role="boiler" left={46} top={154}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pipe_loop" left={190} top={116}><PipeLoopPrimitive size="md" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="expansion_vessel" left={468} top={210}><ExpansionVesselPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pressure_gauge_low" left={612} top={58}><PressureGaugePrimitive pressureBar={0.5} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pressure_gauge_normal" left={612} top={170}><PressureGaugePrimitive pressureBar={1.3} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pressure_gauge_high" left={612} top={282}><PressureGaugePrimitive pressureBar={2.8} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      {options.showLabels && (
        <div style={pressureStateLabelStyle()}>
          <span>Low state</span>
          <span>Normal state</span>
          <span>High state</span>
        </div>
      )}
    </TopologyShell>
  );
}

export function renderVisualTopology(
  topologyId: VisualTopologyId,
  options: VisualTopologyRenderOptions,
): ReactNode {
  switch (topologyId) {
    case 'open_vented_vented_cylinder':
      return <OpenVentedVentedCylinderTopology options={options} />;
    case 'sealed_unvented_cylinder':
      return <SealedUnventedCylinderTopology options={options} />;
    case 'combi_direct_hot_water':
      return <CombiDirectHotWaterTopology options={options} />;
    case 'mixergy_stratified_cylinder':
      return <MixergyStratifiedTopology options={options} />;
    case 'thermal_store_layout':
      return <ThermalStoreTopology options={options} />;
    case 'powerflush_service_layout':
      return <PowerflushServiceTopology options={options} />;
    case 'abv_protected_heating_loop':
      return <AbvProtectedLoopTopology options={options} />;
    case 'magnetic_filter_on_return':
      return <MagneticFilterOnReturnTopology options={options} />;
    case 'system_pressure_layout':
      return <SystemPressureLayoutTopology options={options} />;
    default:
      return null;
  }
}
