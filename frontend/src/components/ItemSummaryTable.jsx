import { Card } from "@/components/ui/card";
import { formatINR, formatNumber } from "@/lib/api";

export const ItemSummaryTable = ({ items }) => {
  const totalPcs = items.reduce((a, x) => a + (x.pcs || 0), 0);
  const totalRev = items.reduce((a, x) => a + (x.revenue || 0), 0);

  return (
    <Card className="p-0 overflow-hidden border-0 ring-1 ring-neutral-200 shadow-[0_1px_2px_rgba(31,25,23,0.04),0_10px_30px_-16px_rgba(31,25,23,0.15)] bg-white" data-testid="item-summary-table">
      <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-xl text-neutral-900">Item-wise Monthly Summary</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Total pcs and revenue per item across the month.</p>
        </div>
        <span className="text-xs text-neutral-500 font-mono-num">{items.length} items</span>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 border-b border-neutral-100">
              <th className="text-left font-medium py-2 px-4">Item</th>
              <th className="text-right font-medium py-2 px-4">Entries</th>
              <th className="text-right font-medium py-2 px-4">Total Pcs</th>
              <th className="text-right font-medium py-2 px-4">Revenue</th>
              <th className="text-right font-medium py-2 px-4">Share</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const share = totalRev > 0 ? (it.revenue / totalRev) * 100 : 0;
              return (
                <tr key={it.item} className="border-b border-neutral-50 hover:bg-neutral-50/60" data-testid={`item-row-${it.item}`}>
                  <td className="py-2 px-4 text-neutral-800">{it.item}</td>
                  <td className="py-2 px-4 text-right font-mono-num text-neutral-600">{it.entries}</td>
                  <td className="py-2 px-4 text-right font-mono-num">{formatNumber(it.pcs)}</td>
                  <td className="py-2 px-4 text-right font-mono-num font-semibold text-emerald-700">{formatINR(it.revenue)}</td>
                  <td className="py-2 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, share)}%` }} />
                      </div>
                      <span className="text-xs text-neutral-500 font-mono-num w-10 text-right">{share.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-sm text-neutral-500 py-10">No items yet.</td>
              </tr>
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="border-t border-neutral-200 bg-neutral-50 font-semibold">
                <td className="py-2 px-4 text-neutral-700">Total</td>
                <td className="py-2 px-4 text-right font-mono-num text-neutral-700">{items.reduce((a, x) => a + x.entries, 0)}</td>
                <td className="py-2 px-4 text-right font-mono-num text-neutral-700">{formatNumber(totalPcs)}</td>
                <td className="py-2 px-4 text-right font-mono-num text-emerald-700">{formatINR(totalRev)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
};
