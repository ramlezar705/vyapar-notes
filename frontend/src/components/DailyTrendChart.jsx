import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatINR } from "@/lib/api";

export const DailyTrendChart = ({ data }) => {
  // data: [{date: 'YYYY-MM-DD', revenue, pcs}]
  const chartData = data.map((d) => ({
    day: d.date.slice(-2),
    date: d.date,
    revenue: Math.round(d.revenue || 0),
    pcs: d.pcs || 0,
  }));

  return (
    <div className="h-[300px] w-full" data-testid="daily-trend-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={{ stroke: "#E5E7EB" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
          />
          <Tooltip
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(l, payload) => (payload?.[0]?.payload?.date ? payload[0].payload.date : `Day ${l}`)}
            formatter={(v, name) => (name === "Revenue" ? formatINR(v) : v)}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#0D5C46"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#C2410C", stroke: "#0D5C46", strokeWidth: 1 }}
            activeDot={{ r: 6, fill: "#C2410C", stroke: "#0D5C46", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
