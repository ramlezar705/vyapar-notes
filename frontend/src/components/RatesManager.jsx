import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MagnifyingGlass, ListChecks, Lightning } from "@phosphor-icons/react";
import { formatINR, formatNumber, bulkRatesApply } from "@/lib/api";
import { toast } from "sonner";

/**
 * items: [{item, pcs, revenue, entries}] from summary
 * itemRates: {item: rate}
 * month: 'YYYY-MM'
 */
export const RatesManager = ({ items, itemRates, month, onChange }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState({}); // {item: rateStr}
  const [scope, setScope] = useState("forward"); // 'forward' | 'month' | 'all'
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // Seed drafts from current effective rate on the row (revenue/pcs) or memory
      const seed = {};
      for (const it of items) {
        const effective = it.pcs > 0 ? it.revenue / it.pcs : 0;
        const r = effective || itemRates[it.item] || 0;
        seed[it.item] = r ? String(r) : "";
      }
      setDraft(seed);
    }
  }, [open, items, itemRates]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    return items.filter((it) => re.test(it.item));
  }, [items, q]);

  const changedCount = useMemo(() => {
    let n = 0;
    for (const it of items) {
      const effective = it.pcs > 0 ? it.revenue / it.pcs : 0;
      const cur = effective || itemRates[it.item] || 0;
      const nv = parseFloat(draft[it.item] || "0");
      if (!Number.isNaN(nv) && nv !== cur) n += 1;
    }
    return n;
  }, [draft, items, itemRates]);

  const applyFilteredRate = (rate) => {
    const r = parseFloat(rate);
    if (Number.isNaN(r)) return;
    const next = { ...draft };
    for (const it of filtered) next[it.item] = String(r);
    setDraft(next);
  };

  const save = async () => {
    const rates = {};
    for (const it of items) {
      const effective = it.pcs > 0 ? it.revenue / it.pcs : 0;
      const cur = effective || itemRates[it.item] || 0;
      const nv = parseFloat(draft[it.item] || "0");
      if (!Number.isNaN(nv) && nv !== cur) rates[it.item] = nv;
    }
    if (Object.keys(rates).length === 0) {
      toast.info("No changes to save");
      return;
    }
    setSaving(true);
    try {
      const res = await bulkRatesApply({ month, scope, rates });
      toast.success(`Applied rates to ${res.items} items (${res.updated} entries)`);
      setOpen(false);
      onChange && onChange();
    } catch (e) {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const [quickRate, setQuickRate] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          data-testid="open-rates-manager"
          className="h-9 bg-[#0D5C46] hover:bg-[#0a4d3a] text-white rounded-full px-4"
        >
          <ListChecks size={16} weight="bold" className="mr-1" /> Manage Rates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Rate Manager</DialogTitle>
          <DialogDescription>
            Type rates for many items at once — no need to open dropdowns every time.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 py-1">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlass size={16} className="absolute left-2.5 top-2.5 text-neutral-400" />
            <Input
              placeholder="Search item (e.g. aand, aj, best)…"
              value={q}
              data-testid="rates-search"
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <div className="flex items-center gap-1 border border-neutral-200 rounded-full p-0.5 text-xs">
            <button
              data-testid="scope-forward-btn"
              onClick={() => setScope("forward")}
              title="Apply to this month and all future months (past months untouched)"
              className={`px-3 py-1 rounded-full transition-colors ${scope === "forward" ? "bg-[#0D5C46] text-white" : "text-neutral-600"}`}
            >This month + forward</button>
            <button
              data-testid="scope-month-btn"
              onClick={() => setScope("month")}
              title="Apply only to this month"
              className={`px-3 py-1 rounded-full transition-colors ${scope === "month" ? "bg-[#0D5C46] text-white" : "text-neutral-600"}`}
            >Only this month</button>
          </div>
        </div>

        {q && filtered.length > 0 && (
          <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <Lightning size={16} weight="fill" className="text-amber-600" />
            <span className="text-neutral-700">Apply one rate to all {filtered.length} filtered items:</span>
            <Input
              type="number"
              placeholder="Rate"
              value={quickRate}
              data-testid="quick-fill-rate"
              onChange={(e) => setQuickRate(e.target.value)}
              className="h-8 w-24 text-right font-mono-num"
            />
            <Button
              size="sm"
              data-testid="quick-fill-apply"
              onClick={() => { applyFilteredRate(quickRate); setQuickRate(""); }}
              className="h-8 bg-amber-500 hover:bg-amber-600 text-white rounded-full"
            >Fill</Button>
          </div>
        )}

        <div className="max-h-[420px] overflow-auto rounded-lg border border-neutral-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 border-b border-neutral-100">
                <th className="text-left font-medium py-2 px-3">Item</th>
                <th className="text-right font-medium py-2 px-3">Pcs</th>
                <th className="text-right font-medium py-2 px-3 w-28">Rate (₹)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.item} className="border-b border-neutral-50 hover:bg-neutral-50/60" data-testid={`rate-manager-row-${it.item}`}>
                  <td className="py-2 px-3 text-neutral-800">{it.item}</td>
                  <td className="py-2 px-3 text-right font-mono-num text-neutral-600">{formatNumber(it.pcs)}</td>
                  <td className="py-2 px-3 text-right">
                    <Input
                      type="number"
                      value={draft[it.item] ?? ""}
                      data-testid={`manager-rate-${it.item}`}
                      onChange={(e) => setDraft({ ...draft, [it.item]: e.target.value })}
                      className="h-8 w-24 ml-auto text-right font-mono-num"
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={3} className="text-center text-sm text-neutral-500 py-10">No items match.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <div className="flex-1 text-sm text-neutral-600">
            {changedCount > 0 ? <span className="text-emerald-700 font-medium">{changedCount} changes ready</span> : "No changes yet"}
          </div>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            data-testid="save-rates-btn"
            onClick={save}
            disabled={saving || changedCount === 0}
            className="bg-[#0D5C46] hover:bg-[#0a4d3a] text-white"
          >
            {saving ? "Saving…" : "Save rates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
