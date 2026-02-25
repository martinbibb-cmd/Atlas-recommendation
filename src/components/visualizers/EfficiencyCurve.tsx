import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { DEFAULT_NOMINAL_EFFICIENCY_PCT } from '../../engine/utils/efficiency';

// Simulates efficiency as a function of draw duration (seconds)
function generateDrawData() {
  return Array.from({ length: 20 }, (_, i) => {
    const seconds = (i + 1) * 3; // 3s to 60s

    // Combi: starts < 30% for short draws, rises toward 95% for long draws
    let combiEff: number;
    if (seconds < 10) {
      combiEff = 20 + seconds * 0.8;
    } else if (seconds < 30) {
      combiEff = 28 + (seconds - 10) * 2.5;
    } else {
      combiEff = Math.min(95, 78 + (seconds - 30) * 0.5);
    }

    // Mixergy: top-down stratification maintains stable ~95% efficiency
    const mixergyEff = DEFAULT_NOMINAL_EFFICIENCY_PCT + Math.random() * 3;

    return {
      seconds: `${seconds}s`,
      'Combi Boiler (%)': Math.round(combiEff),
      'Mixergy Cylinder (%)': Math.round(mixergyEff),
    };
  });
}

const data = generateDrawData();

export default function EfficiencyCurve() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="seconds"
          tick={{ fontSize: 10 }}
          interval={3}
          label={{ value: 'Draw Duration', position: 'insideBottom', offset: -2, fontSize: 11 }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10 }}
          label={{ value: 'Efficiency %', angle: -90, position: 'insideLeft', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{ fontSize: '0.85rem', borderRadius: '8px' }}
          formatter={(value: number | undefined, name: string | undefined) => [value !== undefined ? `${value}%` : '', name ?? '']}
        />
        <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '8px' }} />
        <ReferenceLine
          y={30}
          stroke="#e53e3e"
          strokeDasharray="4 4"
          label={{ value: '30% threshold', fontSize: 10, fill: '#e53e3e' }}
        />
        <Line
          type="monotone"
          dataKey="Combi Boiler (%)"
          stroke="#ed8936"
          strokeWidth={2.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="Mixergy Cylinder (%)"
          stroke="#3182ce"
          strokeWidth={2.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
