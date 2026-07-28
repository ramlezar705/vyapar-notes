import { useCallback, useEffect, useMemo, useState } from "react";
import { CurrencyInr, Package, Calendar, Trophy, ChartLineUp, ChartBar, Storefront, TrashSimple, WhatsappLogo, Lock, LockOpen, ShieldCheck } from "@phosphor-icons/react";
import { KpiCard } from "@/components/KpiCard";
import { PdfUpload } from "@/components/PdfUpload";
import { EntriesTable } from "@/components/EntriesTable";
import { ItemSummaryTable } from "@/components/ItemSummaryTable";
import { DailyTrendChart } from "@/components/DailyTrendChart";
import { TopItemsChart } from "@/components/TopItemsChart";
import { KeywordSearch } from "@/components/KeywordSearch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { fetchMonths, fetchEntries, fetchSummary, fetchItemRates, formatINR, formatNumber, monthLabel, deleteMonth } from "@/lib/api";
import { toast } from "sonner";

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function Dashboard() {
  const [months, setMonths] = useState([]);
  const [month, setMonth] = useState(null);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [itemRates, setItemRates] = useState({});
  const [loading, setLoading] = useState(false);
  const [unlockedPast, setUnlockedPast] = useState(false);

  // Latest month (newest with data) is treated as current/editable. Older months are settled/locked by default.
  const latestMonth = useMemo(() => months[0] || null, [months]);
  const isPastMonth = useMemo(() => Boolean(month && latestMonth && month < latestMonth), [month, latestMonth]);
  const locked = isPastMonth && !unlockedPast;

  // Reset unlock when switching months
  useEffect(() => {
    setUnlockedPast(false);
  }, [month]);

  const refreshMonths = useCallback(async () => {
    const ms = await fetchMonths();
    setMonths(ms);
    return ms;
  }, []);

  const refresh = useCallback(async (targetMonth) => {
    if (!targetMonth) {
      setEntries([]);
      setSummary(null);
      return;
    }
    setLoading(true);
    try {
      const [es, sm, rates] = await Promise.all([fetchEntries(targetMonth), fetchSummary(targetMonth), fetchItemRates()]);
      setEntries(es);
      setSummary(sm);
      setItemRates(rates);
    } catch (e) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const ms = await refreshMonths();
      const initial = ms[0] || currentMonthKey();
      setMonth(initial);
      await refresh(initial);
    })();
  }, [refreshMonths, refresh]);

  const onUploadDone = async () => {
    const ms = await refreshMonths();
    const first = ms[0] || currentMonthKey();
    setMonth(first);
    await refresh(first);
  };

  const onDataChange = () => refresh(month);

  const onDeleteMonth = async () => {
    if (!month) return;
    try {
      const r = await deleteMonth(month);
      toast.success(`Deleted ${r.deleted} entries for ${monthLabel(month)}`);
      const ms = await refreshMonths();
      const nxt = ms[0] || null;
      setMonth(nxt);
      await refresh(nxt);
    } catch (e) {
      toast.error("Delete failed");
    }
  };

  const empty = !summary || summary.total_entries === 0;

  const shareMonthlySummary = () => {
    if (!summary) return;
    const lines = [];
    lines.push(`*Monthly Report* — ${monthLabel(month)}`);
    lines.push("");
    lines.push(`*Total revenue:* ${formatINR(summary.total_revenue)}`);
    lines.push(`*Total pcs:* ${formatNumber(summary.total_pcs)}`);
    lines.push(`*Active days:* ${summary.active_days}`);
    if (summary.top_item_by_revenue) lines.push(`*Top item:* ${summary.top_item_by_revenue}`);
    lines.push("");
    lines.push("*Top 5 items by revenue:*");
    const top = [...(summary.items || [])].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    for (const it of top) {
      lines.push(`• ${it.item}: ${formatNumber(it.pcs)} pcs — ${formatINR(it.revenue)}`);
    }
    lines.push("");
    lines.push("_via Vyapar.Notes_");
    const url = `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const revenueByDay = summary?.daily || [];
  const items = summary?.items || [];

  return (
    <div className="min-h-screen grain-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0D5C46] flex items-center justify-center shrink-0">
              <Storefront size={20} weight="duotone" className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-semibold tracking-tight text-neutral-900 leading-tight">
                Vyapar<span className="text-emerald-600">.</span>Notes
              </h1>
              <p className="hidden sm:block text-[11px] uppercase tracking-[0.2em] text-neutral-500">Business Analytics from your Apple Notes</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <label htmlFor="month-select" className="hidden sm:inline text-xs uppercase tracking-[0.15em] text-neutral-500 font-medium">Month</label>
            <select
              id="month-select"
              data-testid="month-select"
              value={month || ""}
              onChange={(e) => {
                setMonth(e.target.value);
                refresh(e.target.value);
              }}
              className={`h-9 sm:h-10 rounded-full border text-sm px-3 sm:px-4 pr-8 bg-white font-medium ${isPastMonth ? "border-amber-300 text-amber-800" : "border-neutral-300"}`}
            >
              {months.length === 0 && <option value="">No data</option>}
              {months.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}{months[0] !== m ? " · settled" : ""}</option>
              ))}
            </select>
            {isPastMonth && (
              <span
                data-testid="settled-badge"
                title="Settled — protected from bulk changes"
                className="flex items-center gap-1 text-[11px] uppercase tracking-[0.15em] font-medium text-amber-800 bg-amber-100 border border-amber-200 rounded-full px-2 py-1"
              >
                <ShieldCheck size={12} weight="fill" /> Settled
              </span>
            )}
            {month && !empty && (
              <Button
                variant="outline"
                size="sm"
                data-testid="share-month-btn"
                onClick={shareMonthlySummary}
                className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-2 sm:px-3"
                title="Share monthly summary on WhatsApp"
              >
                <WhatsappLogo size={14} weight="fill" className="sm:mr-1" /> <span className="hidden sm:inline">Share month</span>
              </Button>
            )}
            {month && !empty && !locked && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="delete-month-btn" className="rounded-full border-red-200 text-red-700 hover:bg-red-50 px-2 sm:px-3" title="Clear this month's data">
                    <TrashSimple size={14} className="sm:mr-1" /> <span className="hidden sm:inline">Clear month</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all data for {monthLabel(month)}?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently remove all entries for this month. This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction data-testid="confirm-delete-month" onClick={onDeleteMonth} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Upload */}
        <PdfUpload onDone={onUploadDone} />

        {empty ? (
          <Card className="p-10 text-center border border-black/5 shadow-sm bg-white" data-testid="empty-state">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
              <ChartLineUp size={32} weight="duotone" className="text-emerald-700" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-neutral-900">Ready when you are</h2>
            <p className="mt-2 text-neutral-500 max-w-md mx-auto">
              Upload your Apple Notes PDF (with date headers like 1-6 and pcs / item tables) to see daily totals, monthly totals and beautiful charts.
            </p>
          </Card>
        ) : (
          <>
            {/* Data safety banner */}
            {isPastMonth && (
              <div
                data-testid="past-month-banner"
                className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 sm:p-4 ${
                  locked
                    ? "bg-amber-50 border-amber-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${locked ? "bg-amber-100" : "bg-red-100"}`}>
                  {locked ? (
                    <Lock size={20} weight="duotone" className="text-amber-700" />
                  ) : (
                    <LockOpen size={20} weight="duotone" className="text-red-700" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-display font-semibold ${locked ? "text-amber-900" : "text-red-900"}`}>
                    {locked
                      ? `${monthLabel(month)} is a settled month — juno hisab safe chhe`
                      : `Editing enabled for ${monthLabel(month)} — changes will overwrite past records`}
                  </p>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    {locked
                      ? "Rates, entries, and delete are locked to protect old accounts. New rates you set in the current month never touch this data."
                      : "Be careful. Only edit if you truly need to correct past records."}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="toggle-unlock-past"
                  onClick={() => setUnlockedPast((v) => !v)}
                  className={`rounded-full ${locked ? "border-amber-300 text-amber-800 hover:bg-amber-100" : "border-red-300 text-red-800 hover:bg-red-100"}`}
                >
                  {locked ? (<><LockOpen size={14} className="mr-1" /> Unlock to edit</>) : (<><Lock size={14} className="mr-1" /> Lock again</>)}
                </Button>
              </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard
                label="Monthly Revenue"
                value={formatINR(summary.total_revenue)}
                sub={`${summary.total_entries} entries`}
                icon={CurrencyInr}
                accent="text-emerald-700"
                testid="kpi-revenue"
              />
              <KpiCard
                label="Total Pcs"
                value={formatNumber(summary.total_pcs)}
                sub="Across all items"
                icon={Package}
                testid="kpi-pcs"
              />
              <KpiCard
                label="Active Days"
                value={summary.active_days}
                sub={`in ${monthLabel(month)}`}
                icon={Calendar}
                testid="kpi-days"
              />
              <KpiCard
                label="Top Item (Pcs)"
                value={summary.top_item_by_pcs || "—"}
                sub={summary.top_item_by_revenue && summary.top_item_by_revenue !== summary.top_item_by_pcs ? `By revenue: ${summary.top_item_by_revenue}` : "Leading item"}
                icon={Trophy}
                testid="kpi-top-item"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card className="xl:col-span-2 p-4 border border-black/5 shadow-sm bg-white" data-testid="daily-trend-card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-display font-semibold text-lg text-neutral-900">Daily Sales Trend</h3>
                    <p className="text-xs text-neutral-500">Revenue per day in {monthLabel(month)}</p>
                  </div>
                  <ChartLineUp size={22} weight="duotone" className="text-neutral-400" />
                </div>
                <DailyTrendChart data={revenueByDay} />
              </Card>

              <Card className="p-4 border border-black/5 shadow-sm bg-white" data-testid="top-items-card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-display font-semibold text-lg text-neutral-900">Top Items</h3>
                    <p className="text-xs text-neutral-500">Best performers this month</p>
                  </div>
                  <ChartBar size={22} weight="duotone" className="text-neutral-400" />
                </div>
                <Tabs defaultValue="pcs" className="w-full">
                  <TabsList className="grid grid-cols-2 w-full mb-2">
                    <TabsTrigger value="pcs" data-testid="tab-top-pcs">By Pcs</TabsTrigger>
                    <TabsTrigger value="revenue" data-testid="tab-top-revenue">By Revenue</TabsTrigger>
                  </TabsList>
                  <TabsContent value="pcs">
                    <TopItemsChart data={items} metric="pcs" />
                  </TabsContent>
                  <TabsContent value="revenue">
                    <TopItemsChart data={[...items].sort((a, b) => b.revenue - a.revenue)} metric="revenue" />
                  </TabsContent>
                </Tabs>
              </Card>
            </div>

            {/* Entries table */}
            <EntriesTable entries={entries} month={month} itemRates={itemRates} summaryItems={items} locked={locked} onChange={onDataChange} />

            {/* Keyword search */}
            <KeywordSearch items={items} />

            {/* Item summary */}
            <ItemSummaryTable items={items} />
          </>
        )}

        <footer className="py-8 text-center text-xs text-neutral-400">
          Built with care for smart shopkeepers • {loading ? "Refreshing…" : "Live"}
        </footer>
      </main>
    </div>
  );
}
