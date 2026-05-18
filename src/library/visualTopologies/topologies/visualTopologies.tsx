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
import type { VisualTopologyRenderOptions } from './types';
import type { VisualTopologyId } from '../visualTopologyRegistry';

const FLOW_COLOUR = '#dc2626';
const RETURN_COLOUR = '#2563eb';
const AUX_COLOUR = '#475569';

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
  if (flow) return printSafe ? '#000' : FLOW_COLOUR;
  return printSafe ? '#475569' : RETURN_COLOUR;
}

function pipeDash(printSafe: boolean, flow: boolean): string | undefined {
  if (!printSafe || flow) return undefined;
  return '7 4';
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
  const w = options.pipeTrace ? 5 : 3;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        <line x1={120} y1={140} x2={560} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={560} y1={140} x2={560} y2={205} stroke={flow} strokeWidth={w} />
        <line x1={560} y1={300} x2={120} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={120} y1={300} x2={120} y2={210} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={348} y1={140} x2={348} y2={112} stroke={flow} strokeWidth={w - 1} />
        <line x1={284} y1={112} x2={284} y2={300} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={494} y1={140} x2={494} y2={112} stroke={flow} strokeWidth={w - 1} />
        <line x1={430} y1={112} x2={430} y2={300} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />

        <line x1={560} y1={100} x2={700} y2={100} stroke={AUX_COLOUR} strokeWidth={w - 1} />
        <line x1={700} y1={100} x2={700} y2={60} stroke={AUX_COLOUR} strokeWidth={w - 1} />
        <line x1={700} y1={126} x2={700} y2={250} stroke={AUX_COLOUR} strokeWidth={w - 1} />

        <text x={578} y={132} fontSize={11} fill={flow}>Primary flow</text>
        <text x={360} y={292} fontSize={11} fill={ret}>Primary return</text>
        <text x={706} y={82} fontSize={11} fill={AUX_COLOUR}>Vent pipe</text>
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
  const w = options.pipeTrace ? 5 : 3;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        <line x1={120} y1={140} x2={520} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={520} y1={140} x2={520} y2={300} stroke={flow} strokeWidth={w} />
        <line x1={520} y1={300} x2={120} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={120} y1={300} x2={120} y2={205} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={340} y1={140} x2={340} y2={112} stroke={flow} strokeWidth={w - 1} />
        <line x1={276} y1={112} x2={276} y2={300} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={484} y1={140} x2={484} y2={112} stroke={flow} strokeWidth={w - 1} />
        <line x1={420} y1={112} x2={420} y2={300} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />

        <line x1={576} y1={250} x2={680} y2={250} stroke={pipeStroke(options.printSafe, false)} strokeWidth={w - 1} />
        <line x1={576} y1={185} x2={680} y2={185} stroke={pipeStroke(options.printSafe, true)} strokeWidth={w - 1} />
        <line x1={676} y1={170} x2={760} y2={170} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={676} y1={130} x2={760} y2={130} stroke={flow} strokeWidth={w - 1} />

        <text x={682} y={164} fontSize={11} fill={ret}>Mains cold in</text>
        <text x={682} y={124} fontSize={11} fill={flow}>Hot draw-off out</text>
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
  const w = options.pipeTrace ? 5 : 3;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        <line x1={220} y1={140} x2={620} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={620} y1={140} x2={620} y2={300} stroke={flow} strokeWidth={w} />
        <line x1={620} y1={300} x2={220} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={220} y1={300} x2={220} y2={220} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={414} y1={140} x2={414} y2={112} stroke={flow} strokeWidth={w - 1} />
        <line x1={350} y1={112} x2={350} y2={300} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={570} y1={140} x2={570} y2={112} stroke={flow} strokeWidth={w - 1} />
        <line x1={506} y1={112} x2={506} y2={300} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />

        <line x1={188} y1={250} x2={80} y2={250} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={188} y1={210} x2={80} y2={210} stroke={flow} strokeWidth={w - 1} />
        <text x={86} y={204} fontSize={11} fill={flow}>Hot water out</text>
        <text x={86} y={266} fontSize={11} fill={ret}>Mains cold in</text>
        <text x={520} y={120} fontSize={11} fill={flow}>CH flow</text>
        <text x={500} y={322} fontSize={11} fill={ret}>CH return</text>
      </PipeLayer>

      <div style={nodeStyle(142, 164)}><BoilerPrimitive variant="combi" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(340, 70)}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(496, 70)}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      {options.showLabels && <div style={noCylinderNoteStyle()}>No cylinder</div>}
    </TopologyShell>
  );
}

function MixergyStratifiedTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : 3;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        <line x1={130} y1={190} x2={370} y2={190} stroke={flow} strokeWidth={w} />
        <line x1={130} y1={290} x2={370} y2={290} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={370} y1={190} x2={480} y2={190} stroke={flow} strokeWidth={w - 1} />
        <line x1={370} y1={290} x2={480} y2={290} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />

        <line x1={540} y1={290} x2={660} y2={290} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={540} y1={178} x2={660} y2={178} stroke={flow} strokeWidth={w - 1} />
        <text x={666} y={172} fontSize={11} fill={flow}>Hot draw-off from top</text>
        <text x={666} y={304} fontSize={11} fill={ret}>Cold mains entry</text>
        <text x={378} y={184} fontSize={11} fill={flow}>Charging heat input</text>
      </PipeLayer>

      <div style={nodeStyle(66, 170)}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(170, 256)}><PumpPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(470, 140)}><MixergyCylinderPrimitive stateOfChargePct={70} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
    </TopologyShell>
  );
}

function ThermalStoreTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : 3;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        <line x1={132} y1={176} x2={420} y2={176} stroke={flow} strokeWidth={w} />
        <line x1={132} y1={286} x2={420} y2={286} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        <line x1={518} y1={226} x2={676} y2={226} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={518} y1={162} x2={676} y2={162} stroke={flow} strokeWidth={w - 1} />

        <text x={528} y={154} fontSize={11} fill={flow}>Potable hot water out</text>
        <text x={528} y={242} fontSize={11} fill={ret}>Potable mains in</text>
        <text x={170} y={165} fontSize={11} fill={flow}>Primary water loop</text>
        <text x={528} y={258} fontSize={11} fill={AUX_COLOUR}>Potable path isolated via internal coil</text>
      </PipeLayer>

      <div style={nodeStyle(64, 154)}><BoilerPrimitive variant="regular" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(170, 252)}><PumpPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
      <div style={nodeStyle(430, 114)}><ThermalStorePrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></div>
    </TopologyShell>
  );
}

function PowerflushServiceTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : 3;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);
  const dirty = options.printSafe ? '#374151' : '#92400e';
  const clean = options.printSafe ? '#111827' : '#16a34a';

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        <line x1={260} y1={140} x2={690} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={690} y1={140} x2={690} y2={290} stroke={flow} strokeWidth={w} />
        <line x1={690} y1={290} x2={260} y2={290} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={260} y1={290} x2={260} y2={170} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={390} y1={140} x2={390} y2={112} stroke={flow} strokeWidth={w - 1} />
        <line x1={326} y1={112} x2={326} y2={290} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={542} y1={140} x2={542} y2={112} stroke={flow} strokeWidth={w - 1} />
        <line x1={478} y1={112} x2={478} y2={290} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={694} y1={140} x2={694} y2={112} stroke={flow} strokeWidth={w - 1} />
        <line x1={630} y1={112} x2={630} y2={290} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />

        <line x1={230} y1={174} x2={140} y2={174} stroke={dirty} strokeWidth={w - 1} strokeDasharray="6 3" />
        <line x1={230} y1={252} x2={140} y2={252} stroke={clean} strokeWidth={w - 1} />
        <text x={62} y={168} fontSize={11} fill={dirty}>Dirty return path</text>
        <text x={62} y={268} fontSize={11} fill={clean}>Clean return path</text>
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
  const w = options.pipeTrace ? 5 : 3;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        <line x1={130} y1={140} x2={620} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={620} y1={140} x2={620} y2={300} stroke={flow} strokeWidth={w} />
        <line x1={620} y1={300} x2={130} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={130} y1={300} x2={130} y2={210} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={348} y1={140} x2={348} y2={112} stroke={flow} strokeWidth={w - 1} />
        <line x1={284} y1={112} x2={284} y2={300} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={494} y1={140} x2={494} y2={112} stroke={flow} strokeWidth={w - 1} />
        <line x1={430} y1={112} x2={430} y2={300} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={556} y1={140} x2={556} y2={300} stroke={AUX_COLOUR} strokeWidth={w - 0.5} />
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
  const w = options.pipeTrace ? 5 : 3;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        <line x1={140} y1={140} x2={560} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={560} y1={140} x2={560} y2={300} stroke={flow} strokeWidth={w} />
        <line x1={560} y1={300} x2={140} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={140} y1={300} x2={140} y2={220} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={322} y1={140} x2={322} y2={112} stroke={flow} strokeWidth={w - 1} />
        <line x1={258} y1={112} x2={258} y2={300} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={468} y1={140} x2={468} y2={112} stroke={flow} strokeWidth={w - 1} />
        <line x1={404} y1={112} x2={404} y2={300} stroke={ret} strokeWidth={w - 1} strokeDasharray={pipeDash(options.printSafe, false)} />
        <text x={590} y={282} fontSize={11} fill={ret}>Clean return into boiler</text>
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
