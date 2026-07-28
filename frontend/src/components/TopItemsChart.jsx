import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { formatINR, formatNumber } from "@/lib/api";

const COLORS = ["#0D5C46", "#C2410C", "#F59E0B", "#B45309", "#0891B2", "#7C3AED", "#DB2777", "#059669", "#DC2626", "#4F46E5"];

export const TopItemsChart = ({ data, metric = "pcs" }) => {
  // data: sorted items list
  const top = data.slice(0, 10).map((d, i) => ({
    item: d.item.length > 14 ? d.item.slice(0, 13) + "…" : d.item,
    fullItem: d.item,
    value: metric === "pcs" ? d.pcs : d.revenue,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="h-[300px] w-full" data-testid={`top-items-chart-${metric}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
          />
          <YAxis
            type="category"
            dataKey="item"
            tick={{ fontSize: 11, fill: "#374151" }}
            axisLine={false}
            tickLine={false}
            width={100}
          />
          <Tooltip
            contentStyle={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(l, payload) => payload?.[0]?.payload?.fullItem || l}
            formatter={(v) => (metric === "revenue" ? formatINR(v) : formatNumber(v) + " pcs")}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
            {top.map((entry, index) => (
              <Cell key={`c-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
