/**
 * InteractiveComfortClock – "Paint Your Day" interface
 *
 * Users click hour blocks on a 24-hour grid to toggle "At Home" vs "Away".
 * On each toggle the LifestyleSimulationModule is re-run in real-time with
 * the updated occupancy pattern so the chart updates immediately.
 *
 * For the professional signature the "double peak" (morning + evening) is
 * the baseline. Clicking additional hours adds them to the active set,
 * and the demand/temperature outputs update to show the efficiency impact
 * of adding extra heating peaks.
 */

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// A minimal inline simulation that mirrors LifestyleSimulationModule logic
// but accepts a custom hourly demand array instead of a fixed signature.
function simulateHours(
  atHomeHours: boolean[],
  heatLossKw: number,
): { hour: number; demandKw: number; boilerTempC: number; heatPumpTempC: number }[] {
  return atHomeHours.map((home, h) => {
    const demand = home ? 0.85 : 0.05;
    const demandKw = demand * heatLossKw;
    const boilerTempC = 18 + demand * 4;
    const heatPumpTempC = 19.5 + Math.sin((h / 24) * Math.PI) * 0.5;
    return { hour: h, demandKw, boilerTempC, heatPumpTempC };
  });
}

// Default professional double-peak pattern
function defaultAtHomeHours(): boolean[] {
  return Array.from({ length: 24 }, (_, h) =>
    (h >= 6 && h <= 8) || (h >= 17 && h <= 22),
  );
}

interface Props {
  /** System heat loss (kW) – scales demand axis */
  heatLossKw?: number;
}

export default function InteractiveComfortClock({ heatLossKw = 8 }: Props) {
  const [atHomeHours, setAtHomeHours] = useState<boolean[]>(defaultAtHomeHours);

  const toggleHour = (h: number) => {
    setAtHomeHours(prev => {
      const next = [...prev];
      next[h] = !next[h];
      return next;
    });
  };

  const simData = useMemo(
    () => simulateHours(atHomeHours, heatLossKw),
    [atHomeHours, heatLossKw],
  );

  const chartData = simData.map(d => ({
    hour: `${d.hour.toString().padStart(2, '0')}:00`,
    'Demand (kW)': parseFloat(d.demandKw.toFixed(2)),
    'Boiler (°C)': parseFloat(d.boilerTempC.toFixed(1)),
    'Heat Pump (°C)': parseFloat(d.heatPumpTempC.toFixed(1)),
  }));

  const atHomeCount = atHomeHours.filter(Boolean).length;
  const totalDemandKwh = simData.reduce((s, d) => s + d.demandKw, 0);

  return (
    <div>
      <p style={{ fontSize: '0.8rem', color: '#4a5568', marginBottom: 8 }}>
        Click hour blocks to toggle <strong>At Home</strong> / Away.
        The chart updates in real-time to show heating demand and temperature response.
      </p>

      {/* 24-hour grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(24, 1fr)',
          gap: 2,
          marginBottom: 12,
        }}
        aria-label="24-hour occupancy grid"
      >
        {atHomeHours.map((home, h) => (
          <button
            key={h}
            onClick={() => toggleHour(h)}
            title={`${h.toString().padStart(2, '0')}:00 – ${home ? 'At Home' : 'Away'}`}
            aria-label={`Hour ${h}: ${home ? 'At Home' : 'Away'}`}
            aria-pressed={home}
            style={{
              height: 32,
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              background: home ? '#48bb78' : '#edf2f7',
              cursor: 'pointer',
              fontSize: '0.6rem',
              color: home ? '#fff' : '#a0aec0',
              padding: 0,
              lineHeight: '32px',
            }}
          >
            {h}
          </button>
        ))}
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{
          background: '#f0fff4', border: '1px solid #68d391',
          borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem',
        }}>
          🏠 <strong>{atHomeCount}h</strong> at home
        </div>
        <div style={{
          background: '#ebf8ff', border: '1px solid #90cdf4',
          borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem',
        }}>
          ⚡ <strong>{totalDemandKwh.toFixed(1)} kWh</strong> daily demand
        </div>
        {atHomeCount > 12 && (
          <div style={{
            background: '#fffbeb', border: '1px solid #f6ad55',
            borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem',
          }}>
            ⚠️ Long occupation – consider ASHP "low & slow" mode
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
            <YAxis
              yAxisId="temp"
              domain={[17, 24]}
              tick={{ fontSize: 9 }}
              label={{ value: '°C', angle: -90, position: 'insideLeft', fontSize: 10 }}
            />
            <YAxis
              yAxisId="demand"
              orientation="right"
              tick={{ fontSize: 9 }}
              label={{ value: 'kW', angle: 90, position: 'insideRight', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{ fontSize: '0.82rem', borderRadius: 8 }}
              formatter={(value: number | undefined, name: string | undefined) => [
                value !== undefined ? value.toFixed(2) : '',
                name ?? '',
              ]}
            />
            <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 6 }} />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="Boiler (°C)"
              stroke="#ed8936"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="Heat Pump (°C)"
              stroke="#48bb78"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
            />
            <Line
              yAxisId="demand"
              type="monotone"
              dataKey="Demand (kW)"
              stroke="#a0aec0"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="2 4"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
