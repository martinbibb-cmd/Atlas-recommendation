import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { buildDefaultDayModel } from '../../engine/daypainter/BuildDayModel';
import { simulateSystemDay, type DaySystemType } from '../../engine/daypainter/SimulateSystemDay';

interface Props {
  heatLossWatts: number;
  tauHours: number;
  currentSystem: DaySystemType;
  proposedSystem: DaySystemType;
}

function toTrackData(values: number[], key: string) {
  return values.map((v, i) => ({
    t: `${String(Math.floor((i * 5) / 60)).padStart(2, '0')}:${String((i * 5) % 60).padStart(2, '0')}`,
    [key]: v,
  }));
}

export default function DayPainterResults({ heatLossWatts, tauHours, currentSystem, proposedSystem }: Props) {
  const dayModel = useMemo(() => buildDefaultDayModel(), []);
  const current = useMemo(() => simulateSystemDay({ dayModel, systemType: currentSystem, heatLossWatts, tauHours }), [dayModel, currentSystem, heatLossWatts, tauHours]);
  const proposed = useMemo(() => simulateSystemDay({ dayModel, systemType: proposedSystem, heatLossWatts, tauHours }), [dayModel, proposedSystem, heatLossWatts, tauHours]);

  const demandData = current.map((row, i) => ({
    t: row.timeLabel,
    chDemandKw: row.chDemandKw,
    dhwTapDemandKw: row.dhwTapDemandKw,
    currentPlantKw: row.plantOutputKw,
    proposedPlantKw: proposed[i].plantOutputKw,
    currentChDeliveredKw: row.chDeliveredKw,
    proposedChDeliveredKw: proposed[i].chDeliveredKw,
  }));

  const internalTempData = current.map((row, i) => ({ t: row.timeLabel, currentInternalC: row.internalTempC, proposedInternalC: proposed[i].internalTempC }));
  const cylinderData = current.map((row, i) => ({ t: row.timeLabel, currentCylinderC: row.cylinderTempC, proposedCylinderC: proposed[i].cylinderTempC }));

  const causesData = toTrackData(dayModel.dhwMixedLpmByStep, 'dhwLpm');

  const showCylinder = currentSystem !== 'combi' || proposedSystem !== 'combi';

  return (
    <div>
      <p style={{ fontSize: '0.82rem', color: '#4a5568' }}>
        Day painter uses the same usage timeline for both systems. Cooldown/heating follows HLC + thermal inertia (τ),
        so internal temperature responds to boiler switching and timing.
      </p>

      <h4 style={{ margin: '0.75rem 0 0.4rem' }}>Causes — Hot water use timeline (L/min @ 40°C mixed)</h4>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={causesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" interval={23} />
            <YAxis />
            <Tooltip />
            <Line dataKey="dhwLpm" stroke="#2b6cb0" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h4 style={{ margin: '0.75rem 0 0.4rem' }}>Effects — Demand vs output</h4>
      <div style={{ height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={demandData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" interval={23} />
            <YAxis />
            <Tooltip />
            <Line dataKey="chDemandKw" stroke="#805ad5" dot={false} name="CH demand" />
            <Line dataKey="dhwTapDemandKw" stroke="#3182ce" dot={false} name="DHW tap demand" />
            <Line dataKey="currentPlantKw" stroke="#e53e3e" dot={false} name="Current plant" />
            <Line dataKey="proposedPlantKw" stroke="#38a169" dot={false} name="Proposed plant" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h4 style={{ margin: '0.75rem 0 0.4rem' }}>Actual internal temperature (°C)</h4>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={internalTempData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" interval={23} />
            <YAxis domain={[12, 24]} />
            <Tooltip />
            <Line dataKey="currentInternalC" stroke="#c53030" dot={false} name="Current internal" />
            <Line dataKey="proposedInternalC" stroke="#2f855a" dot={false} name="Proposed internal" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {showCylinder && (
        <>
          <h4 style={{ margin: '0.75rem 0 0.4rem' }}>Cylinder state (°C)</h4>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cylinderData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" interval={23} />
                <YAxis domain={[35, 65]} />
                <Tooltip />
                <Line dataKey="currentCylinderC" stroke="#dd6b20" dot={false} name="Current cylinder" />
                <Line dataKey="proposedCylinderC" stroke="#2c7a7b" dot={false} name="Proposed cylinder" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <p style={{ fontSize: '0.76rem', color: '#718096', marginTop: '0.5rem' }}>
        Loss channels: <strong>via flue</strong> and <strong>dumped to CH circuit</strong> are modelled separately; combi DHW calls pause CH service.
      </p>
    </div>
  );
}
