import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CaretDown, CaretRight, Trash, Plus, Lightning } from "@phosphor-icons/react";
import { formatINR, formatNumber, patchEntry, deleteEntry, createEntry, bulkRate } from "@/lib/api";
import { toast } from "sonner";

const RateInput = ({ value, onCommit, testid }) => {
  const [v, setV] = useState(value ?? 0);
  return (
    <Input
      type="number"
      inputMode="decimal"
      step="0.01"
      value={v}
      data-testid={testid}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const nv = parseFloat(v);
        if (!Number.isNaN(nv) && nv !== value) onCommit(nv);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="h-8 w-24 text-right font-mono-num text-sm"
      aria-label="Rate per piece"
    />
  );
};

export const EntriesTable = ({ entries, month, onChange }) => {
  const [openDates, setOpenDates] = useState({});
  const [newEntry, setNewEntry] = useState({}); // per-date draft
  const [bulk, setBulk] = useState({ item: "", rate: "" });

  const grouped = useMemo(() => {
    const g = {};
    for (const e of entries) {
      (g[e.date] = g[e.date] || []).push(e);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

  const itemNames = useMemo(() => {
    const s = new Set();
    entries.forEach((e) => s.add(e.item));
    return Array.from(s).sort();
  }, [entries]);

  const updateRate = async (id, rate) => {
    try {
      await patchEntry(id, { rate });
      toast.success("Rate updated");
      onChange && onChange();
    } catch (e) {
      toast.error("Update failed");
    }
  };

  const removeEntry = async (id) => {
    try {
      await deleteEntry(id);
      toast.success("Entry deleted");
      onChange && onChange();
    } catch (e) {
      toast.error("Delete failed");
    }
  };

  const addEntry = async (date) => {
    const draft = newEntry[date];
    if (!draft?.item || !draft?.pcs) {
      toast.error("Enter item and pcs");
      return;
    }
    try {
      await createEntry({ date, item: draft.item.trim(), pcs: parseFloat(draft.pcs), rate: parseFloat(draft.rate || 0) });
      setNewEntry({ ...newEntry, [date]: { item: "", pcs: "", rate: "" } });
      toast.success("Entry added");
      onChange && onChange();
    } catch (e) {
      toast.error("Add failed");
    }
  };

  const applyBulk = async () => {
    if (!bulk.item || bulk.rate === "") {
      toast.error("Pick an item and rate");
      return;
    }
    try {
      const r = await bulkRate({ item: bulk.item, rate: parseFloat(bulk.rate), month });
      toast.success(`Applied rate to ${r.updated} entries of ${bulk.item}`);
      setBulk({ item: "", rate: "" });
      onChange && onChange();
    } catch (e) {
      toast.error("Bulk update failed");
    }
  };

  return (
    <Card className="p-0 overflow-hidden border border-black/5 shadow-sm bg-white" data-testid="entries-table">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-neutral-100">
        <div>
          <h3 className="font-display font-semibold text-lg text-neutral-900">Daily Entries</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Add rate for each row to calculate daily and monthly totals.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            data-testid="bulk-item-select"
            value={bulk.item}
            onChange={(e) => setBulk({ ...bulk, item: e.target.value })}
            className="h-9 rounded-md border border-neutral-300 text-sm px-2 bg-white"
          >
            <option value="">Bulk apply rate to item…</option>
            {itemNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <Input
            type="number"
            placeholder="Rate"
            value={bulk.rate}
            data-testid="bulk-rate-input"
            onChange={(e) => setBulk({ ...bulk, rate: e.target.value })}
            className="h-9 w-24 text-right font-mono-num"
          />
          <Button
            onClick={applyBulk}
            data-testid="bulk-apply-btn"
            className="h-9 bg-amber-500 hover:bg-amber-600 text-white rounded-full px-4"
          >
            <Lightning size={14} weight="fill" className="mr-1" />Apply
          </Button>
        </div>
      </div>

      <div className="max-h-[720px] overflow-auto">
        {grouped.length === 0 && (
          <div className="p-10 text-center text-sm text-neutral-500">No entries yet. Upload a PDF or add manually.</div>
        )}
        {grouped.map(([date, rows]) => {
          const open = openDates[date] ?? true;
          const dayPcs = rows.reduce((a, r) => a + (r.pcs || 0), 0);
          const dayRev = rows.reduce((a, r) => a + (r.pcs || 0) * (r.rate || 0), 0);
          return (
            <div key={date} className="border-b border-neutral-100 last:border-b-0">
              <button
                data-testid={`day-toggle-${date}`}
                onClick={() => setOpenDates({ ...openDates, [date]: !open })}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 text-left"
              >
                <div className="flex items-center gap-2">
                  {open ? <CaretDown size={16} /> : <CaretRight size={16} />}
                  <span className="font-display font-semibold text-neutral-900">{date}</span>
                  <span className="text-xs text-neutral-500 ml-2">{rows.length} items</span>
                </div>
                <div className="flex items-center gap-6 text-sm font-mono-num">
                  <span className="text-neutral-600">{formatNumber(dayPcs)} pcs</span>
                  <span className="text-emerald-700 font-semibold">{formatINR(dayRev)}</span>
                </div>
              </button>
              {open && (
                <div className="px-4 pb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.15em] text-neutral-500">
                        <th className="text-left font-medium py-2 w-1/2">Item</th>
                        <th className="text-right font-medium py-2">Pcs</th>
                        <th className="text-right font-medium py-2">Rate (₹)</th>
                        <th className="text-right font-medium py-2">Total</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                          <td className="py-2 pr-2 text-neutral-800">{r.item}</td>
                          <td className="py-2 text-right font-mono-num">{formatNumber(r.pcs)}</td>
                          <td className="py-2 text-right">
                            <div className="flex justify-end">
                              <RateInput
                                value={r.rate}
                                onCommit={(v) => updateRate(r.id, v)}
                                testid={`rate-input-${r.id}`}
                              />
                            </div>
                          </td>
                          <td className="py-2 text-right font-mono-num font-semibold text-emerald-700" data-testid={`row-total-${r.id}`}>
                            {formatINR((r.pcs || 0) * (r.rate || 0))}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              data-testid={`delete-entry-${r.id}`}
                              onClick={() => removeEntry(r.id)}
                              className="text-neutral-400 hover:text-red-600 p-1"
                              aria-label="Delete entry"
                            >
                              <Trash size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-neutral-100 bg-neutral-50/50">
                        <td className="py-2 pr-2">
                          <Input
                            placeholder="Item name"
                            value={newEntry[date]?.item || ""}
                            data-testid={`new-item-${date}`}
                            onChange={(e) => setNewEntry({ ...newEntry, [date]: { ...(newEntry[date] || {}), item: e.target.value } })}
                            className="h-8"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <Input
                            type="number"
                            placeholder="Pcs"
                            value={newEntry[date]?.pcs || ""}
                            data-testid={`new-pcs-${date}`}
                            onChange={(e) => setNewEntry({ ...newEntry, [date]: { ...(newEntry[date] || {}), pcs: e.target.value } })}
                            className="h-8 w-24 ml-auto text-right font-mono-num"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <Input
                            type="number"
                            placeholder="Rate"
                            value={newEntry[date]?.rate || ""}
                            data-testid={`new-rate-${date}`}
                            onChange={(e) => setNewEntry({ ...newEntry, [date]: { ...(newEntry[date] || {}), rate: e.target.value } })}
                            className="h-8 w-24 ml-auto text-right font-mono-num"
                          />
                        </td>
                        <td className="py-2 text-right"></td>
                        <td className="py-2 text-right">
                          <button
                            data-testid={`add-entry-${date}`}
                            onClick={() => addEntry(date)}
                            className="text-emerald-700 hover:text-emerald-900 p-1"
                            aria-label="Add entry"
                          >
                            <Plus size={16} weight="bold" />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
