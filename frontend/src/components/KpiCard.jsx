import { Card } from "@/components/ui/card";

export const KpiCard = ({ label, value, sub, icon: Icon, accent = "text-neutral-900", testid }) => {
  return (
    <Card
      data-testid={testid}
      className="relative p-5 border border-black/5 shadow-sm bg-white overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-500 font-medium font-display">
          {label}
        </p>
        {Icon && <Icon size={22} weight="duotone" className="text-neutral-400" />}
      </div>
      <div className={`mt-4 text-3xl font-display font-semibold tracking-tight ${accent} font-mono-num`}>
        {value}
      </div>
      {sub && <p className="mt-1 text-xs text-neutral-500">{sub}</p>}
    </Card>
  );
};
