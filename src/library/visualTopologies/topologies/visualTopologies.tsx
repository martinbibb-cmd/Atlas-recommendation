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
        <line x1={120} y1={140} x2={560} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={560} y1={140} x2={560} y2={205} stroke={flow} strokeWidth={w} />
        {/*
          Return pipe — routes through pump (inline).
          Right segment: from cylinder/rads rightward to pump outlet (x=223).
          Vertical jog UP from y=300 to pump pipe centre y=267.
          Pump handles x=159–223 at y=267.
          Left segment: pump inlet (x=159) to boiler column (x=120).
          Vertical rise to boiler connection.
        */}
        <line x1={560} y1={300} x2={223} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={223} y1={300} x2={223} y2={267} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="pump-topology-circuit" />
        <line x1={159} y1={267} x2={120} y2={267} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={120} y1={267} x2={120} y2={210} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Radiator branch spurs */}
        <line x1={348} y1={140} x2={348} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={284} y1={112} x2={284} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={494} y1={140} x2={494} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={430} y1={112} x2={430} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/*
          Vent pipe — routed right of cylinder (x=700) to avoid crossing the
          primary flow pipe at y=140. Exits cylinder top, rises to header tank.
          No-crossing rule: vent pipe stays east of x=560 at all times.
        */}
        <line x1={700} y1={170} x2={700} y2={60} stroke={AUX_COLOUR} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={700} y1={196} x2={700} y2={250} stroke={AUX_COLOUR} strokeWidth={PIPE_STROKE_BRANCH} />

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
        <text {...pipeLabelProps(706, 130, 'above', AUX_COLOUR)}>Vent pipe</text>
      </PipeLayer>

      <div style={nodeStyle(56, 160)}><BoilerPrimitive variant="regular" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(156, 246)}><PumpPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(274, 70)}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(420, 70)}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(666, 18)}><HeaderTankPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(520, 170)}><CylinderPrimitive variant="vented" fillLevel={0.7} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
    </TopologyShell>
  );
}

function SealedUnventedCylinderTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary flow ring */}
        <line x1={120} y1={140} x2={520} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={520} y1={140} x2={520} y2={300} stroke={flow} strokeWidth={w} />
        {/*
          Return pipe — routes through pump (inline).
          Right segment to pump outlet (x=223), jog UP from y=300 to pump y=267,
          pump handles x=159–223, left segment to boiler column.
        */}
        <line x1={520} y1={300} x2={223} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={223} y1={300} x2={223} y2={267} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="pump-topology-circuit" />
        <line x1={159} y1={267} x2={120} y2={267} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={120} y1={267} x2={120} y2={205} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Radiator branch spurs */}
        <line x1={340} y1={140} x2={340} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={276} y1={112} x2={276} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={484} y1={140} x2={484} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={420} y1={112} x2={420} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Cylinder DHW stubs */}
        <line x1={576} y1={250} x2={680} y2={250} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={576} y1={185} x2={680} y2={185} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={676} y1={170} x2={760} y2={170} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={676} y1={130} x2={760} y2={130} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        {/* G3 D2 discharge route — continuous fall away from cylinder */}
        <line
          x1={590}
          y1={282}
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
        <text {...pipeLabelProps(682, 170, 'above', ret)}>Mains cold in</text>
        <text {...pipeLabelProps(682, 130, 'above', flow)}>Hot draw-off out</text>
        <text {...pipeLabelProps(646, 318, 'below', AUX_COLOUR)}>D2 safety discharge</text>
      </PipeLayer>

      <div style={nodeStyle(56, 156)}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(156, 246)}><PumpPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(266, 70)}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(410, 70)}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(520, 160)}><CylinderPrimitive variant="unvented" fillLevel={0.75} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(364, 252)}><FillingLoopPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(635, 250)}><ExpansionVesselPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(610, 88)}><PressureGaugePrimitive pressureBar={1.3} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
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

      <div style={nodeStyle(142, 164)}><BoilerPrimitive variant="combi" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(340, 70)}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(496, 70)}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
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
        {/*
          Return pipe — routes through pump (inline).
          Pump at (170,256): inlet x=173, outlet x=237, centre y=277.
          Return from cylinder (right) to pump outlet, jog UP from y=290 to y=277,
          pump handles x=173–237, left segment to boiler column.
        */}
        <line x1={370} y1={290} x2={237} y2={290} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={237} y1={290} x2={237} y2={277} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="pump-topology-circuit" />
        <line x1={173} y1={277} x2={130} y2={277} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={130} y1={277} x2={130} y2={248} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

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

      <div style={nodeStyle(66, 170)}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(170, 256)}><PumpPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(470, 140)}><MixergyCylinderPrimitive stateOfChargePct={70} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
    </TopologyShell>
  );
}

function ThermalStoreTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/*
          PRIMARY water loop — system/boiler water stored in vessel body (amber).
          Flow from boiler → store primary-in (left-top of store).
          Return from store primary-out (left-bottom) → pump → boiler.
        */}
        <line x1={132} y1={176} x2={420} y2={176} stroke={flow} strokeWidth={w} data-testid="thermal-store-primary-pipe" />
        {/*
          Return pipe — routes through pump (inline).
          Pump at (170,252): inlet x=173, outlet x=237, centre y=273.
          Return from store to pump outlet, jog UP from y=286 to y=273,
          pump handles x=173–237, left segment to boiler column.
        */}
        <line x1={420} y1={286} x2={237} y2={286} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="thermal-store-primary-pipe" />
        <line x1={237} y1={286} x2={237} y2={273} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="pump-topology-circuit" />
        <line x1={173} y1={273} x2={132} y2={273} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={132} y1={273} x2={132} y2={232} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/*
          POTABLE water path — cold mains enters coil (bottom-right of store),
          heated by primary water, exits as hot DHW (top-right of store).
          Separate from primary loop — no shared pipe segments.
        */}
        <line x1={518} y1={226} x2={676} y2={226} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="thermal-store-potable-pipe" />
        <line x1={518} y1={162} x2={676} y2={162} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} data-testid="thermal-store-potable-pipe" />

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

      <div style={nodeStyle(64, 154)}><BoilerPrimitive variant="regular" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(170, 252)}><PumpPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(430, 114)}><ThermalStorePrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
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

      <div style={nodeStyle(26, 168)}><PowerflushMachinePrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(316, 70)}><RadiatorPrimitive size="sm" temperatureTone="cool" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(468, 70)}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(620, 70)}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(690, 188)}><BoilerPrimitive variant="regular" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(560, 248)}><MagneticFilterPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
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
        <line x1={620} y1={140} x2={620} y2={300} stroke={flow} strokeWidth={w} />
        {/*
          Return pipe — routes through pump (inline).
          Pump at (165,248): inlet x=168, outlet x=232, centre y=269.
          Right segment to pump outlet, jog UP from y=300 to y=269,
          pump handles x=168–232, left segment to boiler column.
        */}
        <line x1={620} y1={300} x2={232} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={232} y1={300} x2={232} y2={269} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="pump-topology-circuit" />
        <line x1={168} y1={269} x2={130} y2={269} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={130} y1={269} x2={130} y2={210} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Radiator branch spurs */}
        <line x1={348} y1={140} x2={348} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={284} y1={112} x2={284} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={494} y1={140} x2={494} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={430} y1={112} x2={430} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        {/* ABV bridge — maintains PIPE_STROKE_BRANCH (AUX path) */}
        <line x1={556} y1={140} x2={556} y2={300} stroke={AUX_COLOUR} strokeWidth={PIPE_STROKE_BRANCH} />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={375} y={140} direction="right" color={flow} />
            <MidPipeArrow midX={375} y={300} direction="left" color={ret} />
          </>
        )}
      </PipeLayer>

      <div style={nodeStyle(60, 164)}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(165, 248)}><PumpPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(274, 70)}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(420, 70)}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(470, 176)}><ABVPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
    </TopologyShell>
  );
}

function MagneticFilterOnReturnTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary ring */}
        <line x1={140} y1={140} x2={560} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={560} y1={140} x2={560} y2={300} stroke={flow} strokeWidth={w} />
        <line x1={560} y1={300} x2={140} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
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
      </PipeLayer>

      <div style={nodeStyle(70, 164)}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(248, 70)}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(394, 70)}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(520, 246)}><MagneticFilterPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
    </TopologyShell>
  );
}

function SystemPressureLayoutTopology({ options }: { options: VisualTopologyRenderOptions }) {
  return (
    <TopologyShell options={options}>
      <div style={nodeStyle(46, 154)}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(190, 116)}><PipeLoopPrimitive size="md" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(468, 210)}><ExpansionVesselPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(612, 58)}><PressureGaugePrimitive pressureBar={0.5} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(612, 170)}><PressureGaugePrimitive pressureBar={1.3} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(612, 282)}><PressureGaugePrimitive pressureBar={2.8} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
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
