import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CaretDown, CaretRight, Trash, Plus, WhatsappLogo } from "@phosphor-icons/react";
import { formatINR, formatNumber, patchEntry, deleteEntry, createEntry } from "@/lib/api";
import { toast } from "sonner";
import { RatesManager } from "@/components/RatesManager";

const buildWhatsappText = (date, rows) => {
  const totalPcs = rows.reduce((a, r) => a + (r.pcs || 0), 0);
  const totalRev = rows.reduce((a, r) => a + (r.pcs || 0) * (r.rate || 0), 0);
  const lines = [];
  lines.push(`*Daily Report* ${date}`);
  lines.push("");
  for (const r of rows) {
    const rev = (r.pcs || 0) * (r.rate || 0);
    if (r.rate && r.rate > 0) {
      lines.push(`• ${r.item}: ${formatNumber(r.pcs)} × ₹${r.rate} = ${formatINR(rev)}`);
    } else {
      lines.push(`• ${r.item}: ${formatNumber(r.pcs)} pcs`);
    }
  }
  lines.push("");
  lines.push(`*Total pcs:* ${formatNumber(totalPcs)}`);
  if (totalRev > 0) lines.push(`*Total revenue:* ${formatINR(totalRev)}`);
  lines.push("");
  lines.push("_via Vyapar.Notes_");
  return lines.join("\n");
};

const shareOnWhatsapp = (text) => {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
};

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
      className="h-9 sm:h-8 w-[68px] sm:w-24 text-right font-mono-num text-sm px-2 sm:px-3"
      aria-label="Rate per piece"
    />
  );
};

export const EntriesTable = ({ entries, month, itemRates = {}, summaryItems = [], onChange }) => {
  const [openDates, setOpenDates] = useState({});
  const [newEntry, setNewEntry] = useState({}); // per-date draft

  const grouped = useMemo(() => {
    const g = {};
    for (const e of entries) {
      (g[e.date] = g[e.date] || []).push(e);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

  const updateRate = async (id, rate) => {
    try {
      const res = await patchEntry(id, { rate });
      const applied = res?.auto_applied || 0;
      if (applied > 0) {
        toast.success(`Rate updated. Applied to ${applied} more ${applied === 1 ? "entry" : "entries"} in this month and forward.`);
      } else {
        toast.success("Rate updated");
      }
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

  return (
    <Card className="p-0 overflow-hidden border border-black/5 shadow-sm bg-white" data-testid="entries-table">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 border-b border-neutral-100">
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-lg text-neutral-900">Daily Entries</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Add rate for each row — daily and monthly totals auto-calculate.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RatesManager items={summaryItems} itemRates={itemRates} month={month} onChange={onChange} />
        </div>
      </div>

      <div className="max-h-[720px] overflow-x-auto overflow-y-auto">
        {grouped.length === 0 && (
          <div className="p-10 text-center text-sm text-neutral-500">No entries yet. Upload a PDF or add manually.</div>
        )}
        {grouped.map(([date, rows]) => {
          const open = openDates[date] ?? true;
          const dayPcs = rows.reduce((a, r) => a + (r.pcs || 0), 0);
          const dayRev = rows.reduce((a, r) => a + (r.pcs || 0) * (r.rate || 0), 0);
          return (
            <div key={date} className="border-b border-neutral-100 last:border-b-0">
              <div className="w-full flex flex-wrap items-center justify-between gap-y-1 px-3 sm:px-4 py-3 hover:bg-neutral-50">
                <button
                  data-testid={`day-toggle-${date}`}
                  onClick={() => setOpenDates({ ...openDates, [date]: !open })}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  {open ? <CaretDown size={16} /> : <CaretRight size={16} />}
                  <span className="font-display font-semibold text-neutral-900 whitespace-nowrap">{date}</span>
                  <span className="hidden sm:inline text-xs text-neutral-500 ml-2 whitespace-nowrap">{rows.length} items</span>
                </button>
                <div className="flex items-center gap-2 sm:gap-4 text-sm font-mono-num shrink-0">
                  <span className="text-neutral-600 whitespace-nowrap text-xs sm:text-sm">{formatNumber(dayPcs)} pcs</span>
                  <span className="text-emerald-700 font-semibold whitespace-nowrap">{formatINR(dayRev)}</span>
                  <button
                    data-testid={`share-day-${date}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      shareOnWhatsapp(buildWhatsappText(date, rows));
                    }}
                    title="Share on WhatsApp"
                    className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-full px-2 py-1 transition-colors"
                  >
                    <WhatsappLogo size={18} weight="fill" />
                    <span className="text-xs font-medium hidden sm:inline">Share</span>
                  </button>
                </div>
              </div>
              {open && (
                <div className="px-3 sm:px-4 pb-4">
                  <table className="w-full text-sm table-fixed">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.15em] text-neutral-500">
                        <th className="text-left font-medium py-2">Item</th>
                        <th className="text-right font-medium py-2 w-[52px] sm:w-auto">Pcs</th>
                        <th className="text-right font-medium py-2 w-[76px] sm:w-auto">Rate</th>
                        <th className="text-right font-medium py-2 w-[72px] sm:w-auto">Total</th>
                        <th className="w-6 sm:w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                          <td className="py-2 pr-1 sm:pr-2 text-neutral-800 truncate max-w-0" title={r.item}>{r.item}</td>
                          <td className="py-2 text-right font-mono-num text-xs sm:text-sm">{formatNumber(r.pcs)}</td>
                          <td className="py-2 text-right">
                            <div className="flex justify-end">
                              <RateInput
                                value={r.rate}
                                onCommit={(v) => updateRate(r.id, v)}
                                testid={`rate-input-${r.id}`}
                              />
                            </div>
                          </td>
                          <td className="py-2 text-right font-mono-num font-semibold text-emerald-700 text-xs sm:text-sm" data-testid={`row-total-${r.id}`}>
                            {formatINR((r.pcs || 0) * (r.rate || 0))}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              data-testid={`delete-entry-${r.id}`}
                              onClick={() => removeEntry(r.id)}
                              className="text-neutral-400 hover:text-red-600 p-1"
                              aria-label="Delete entry"
                            >
                              <Trash size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-neutral-100 bg-neutral-50/50">
                        <td className="py-2 pr-2">
                          <Input
                            placeholder="Item name"
                            list={`itemlist-${date}`}
                            value={newEntry[date]?.item || ""}
                            data-testid={`new-item-${date}`}
                            onChange={(e) => {
                              const val = e.target.value;
                              const known = itemRates[val.trim()];
                              setNewEntry({
                                ...newEntry,
                                [date]: {
                                  ...(newEntry[date] || {}),
                                  item: val,
                                  rate: newEntry[date]?.rate || (known ? String(known) : ""),
                                },
                              });
                            }}
                            className="h-8"
                          />
                          <datalist id={`itemlist-${date}`}>
                            {Object.keys(itemRates).map((n) => (
                              <option key={n} value={n} />
                            ))}
                          </datalist>
                        </td>
                        <td className="py-2 text-right">
                          <Input
                            type="number"
                            placeholder="Pcs"
                            value={newEntry[date]?.pcs || ""}
                            data-testid={`new-pcs-${date}`}
                            onChange={(e) => setNewEntry({ ...newEntry, [date]: { ...(newEntry[date] || {}), pcs: e.target.value } })}
                            className="h-9 sm:h-8 w-full max-w-[68px] sm:max-w-24 ml-auto text-right font-mono-num px-2 sm:px-3"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <Input
                            type="number"
                            placeholder="Rate"
                            value={newEntry[date]?.rate || ""}
                            data-testid={`new-rate-${date}`}
                            onChange={(e) => setNewEntry({ ...newEntry, [date]: { ...(newEntry[date] || {}), rate: e.target.value } })}
                            className="h-9 sm:h-8 w-full max-w-[68px] sm:max-w-24 ml-auto text-right font-mono-num px-2 sm:px-3"
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
