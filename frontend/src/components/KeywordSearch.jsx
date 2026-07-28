import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { MagnifyingGlass, Package, CurrencyInr } from "@phosphor-icons/react";
import { formatINR, formatNumber } from "@/lib/api";

const COLORS = ["#0D5C46", "#10B981", "#F59E0B", "#EA580C", "#0891B2", "#7C3AED", "#DB2777", "#059669", "#DC2626", "#4F46E5", "#22C55E", "#EF4444"];

/**
 * items: [{item, pcs, revenue, entries}] from summary
 */
export const KeywordSearch = ({ items }) => {
  const [q, setQ] = useState("");

  const { matched, totalPcs, totalRev } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return { matched: [], totalPcs: 0, totalRev: 0 };
    // Escape regex special chars, then match as a WHOLE WORD (word boundary), case-insensitive.
    // So "aj" matches "Shivark aj" but NOT "Tifa raju"; "aand" matches "Best aand" etc.
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    const m = items.filter((it) => re.test(it.item));
    const totalPcs = m.reduce((a, x) => a + (x.pcs || 0), 0);
    const totalRev = m.reduce((a, x) => a + (x.revenue || 0), 0);
    return { matched: m, totalPcs, totalRev };
  }, [items, q]);

  const chartData = matched.slice(0, 15).map((d, i) => ({
    item: d.item.length > 16 ? d.item.slice(0, 15) + "…" : d.item,
    fullItem: d.item,
    pcs: d.pcs,
    revenue: Math.round(d.revenue || 0),
    color: COLORS[i % COLORS.length],
  }));

  return (
    <Card className="p-4 sm:p-5 border-0 ring-1 ring-neutral-200 shadow-[0_1px_2px_rgba(31,25,23,0.04),0_10px_30px_-16px_rgba(31,25,23,0.15)] bg-white" data-testid="keyword-search-card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display font-semibold text-xl text-neutral-900">Keyword Search</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Type any word (e.g. "aand", "aj") to group all matching items with pcs and revenue.</p>
        </div>
      </div>

      <div className="relative mb-3">
        <MagnifyingGlass size={16} className="absolute left-3 top-3 text-neutral-400" />
        <Input
          placeholder="Type a keyword…"
          value={q}
          data-testid="keyword-search-input"
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {!q.trim() ? (
        <div className="text-sm text-neutral-500 py-6 text-center">
          Try typing <span className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded">aand</span>, <span className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded">aj</span> or any part of an item name.
        </div>
      ) : matched.length === 0 ? (
        <div className="text-sm text-neutral-500 py-6 text-center">No items match "{q}"</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center gap-3" data-testid="keyword-total-pcs">
              <Package size={22} weight="duotone" className="text-emerald-700" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-emerald-800">Total Pcs</p>
                <p className="font-display font-semibold text-xl text-emerald-800 font-mono-num">{formatNumber(totalPcs)}</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 flex items-center gap-3" data-testid="keyword-total-rev">
              <CurrencyInr size={22} weight="duotone" className="text-amber-700" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-amber-800">Total Revenue</p>
                <p className="font-display font-semibold text-xl text-amber-800 font-mono-num">{formatINR(totalRev)}</p>
              </div>
            </div>
          </div>

          <div className="h-[220px]" data-testid="keyword-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                />
                <YAxis
                  type="category"
                  dataKey="item"
                  tick={{ fontSize: 10, fill: "#374151" }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  contentStyle={{ background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(l, p) => p?.[0]?.payload?.fullItem || l}
                  formatter={(v, n) => (n === "pcs" ? formatNumber(v) + " pcs" : formatINR(v))}
                />
                <Bar dataKey="pcs" radius={[0, 6, 6, 0]}>
                  {chartData.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 max-h-[260px] overflow-auto rounded-lg border border-neutral-100">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 border-b border-neutral-100">
                  <th className="text-left font-medium py-2 px-3">Item</th>
                  <th className="text-right font-medium py-2 px-3">Pcs</th>
                  <th className="text-right font-medium py-2 px-3">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {matched.map((it) => (
                  <tr key={it.item} className="border-b border-neutral-50 hover:bg-neutral-50/60" data-testid={`keyword-row-${it.item}`}>
                    <td className="py-1.5 px-3 text-neutral-800">{it.item}</td>
                    <td className="py-1.5 px-3 text-right font-mono-num">{formatNumber(it.pcs)}</td>
                    <td className="py-1.5 px-3 text-right font-mono-num text-emerald-700">{formatINR(it.revenue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-200 bg-neutral-50 font-semibold">
                  <td className="py-2 px-3 text-neutral-700">Total ({matched.length} items)</td>
                  <td className="py-2 px-3 text-right font-mono-num text-neutral-800">{formatNumber(totalPcs)}</td>
                  <td className="py-2 px-3 text-right font-mono-num text-emerald-700">{formatINR(totalRev)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Card>
  );
};
