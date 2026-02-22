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
import type { OccupancyHour } from '../../engine/schema/EngineInputV2_3';

interface Props {
  data: OccupancyHour[];
}

export default function ComfortClock({ data }: Props) {
  const chartData = data.map(d => ({
    hour: `${d.hour.toString().padStart(2, '0')}:00`,
    'Boiler (°C)': d.boilerTempC,
    'Heat Pump (°C)': d.heatPumpTempC,
    'Stored Water (°C)': d.storedWaterTempC,
    'Demand (kW)': d.demandKw,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 10 }}
          interval={3}
        />
        <YAxis
          yAxisId="temp"
          domain={[17, 23]}
          tick={{ fontSize: 10 }}
          label={{ value: '°C', angle: -90, position: 'insideLeft', fontSize: 11 }}
        />
        <YAxis
          yAxisId="demand"
          orientation="right"
          tick={{ fontSize: 10 }}
          label={{ value: 'kW', angle: 90, position: 'insideRight', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{ fontSize: '0.85rem', borderRadius: '8px' }}
          formatter={(value: number | undefined, name: string | undefined) => [value !== undefined ? value.toFixed(2) : '', name ?? '']}
        />
        <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '8px' }} />
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
          yAxisId="temp"
          type="monotone"
          dataKey="Stored Water (°C)"
          stroke="#3182ce"
          strokeWidth={2}
          dot={false}
          strokeDasharray="3 3"
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
  );
}
