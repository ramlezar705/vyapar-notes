import { Card } from "@/components/ui/card";

export const KpiCard = ({ label, value, sub, icon: Icon, tone = "default", testid, delay = 0 }) => {
  const tones = {
    default: { bg: "bg-white", ring: "ring-neutral-200", num: "text-neutral-900", iconBg: "bg-neutral-100", iconColor: "text-neutral-500" },
    revenue: { bg: "bg-white", ring: "ring-emerald-100", num: "text-[#0D5C46]", iconBg: "bg-emerald-50", iconColor: "text-emerald-700" },
    accent:  { bg: "bg-white", ring: "ring-orange-100",  num: "text-[#C2410C]", iconBg: "bg-orange-50",  iconColor: "text-orange-700" },
    calendar:{ bg: "bg-white", ring: "ring-amber-100",   num: "text-neutral-900", iconBg: "bg-amber-50",  iconColor: "text-amber-700" },
    trophy:  { bg: "bg-white", ring: "ring-neutral-200", num: "text-neutral-900", iconBg: "bg-neutral-100", iconColor: "text-neutral-700" },
  };
  const t = tones[tone] || tones.default;
  return (
    <Card
      data-testid={testid}
      style={{ animationDelay: `${delay}ms` }}
      className={`rise relative p-5 sm:p-6 border-0 ring-1 ${t.ring} shadow-[0_1px_2px_rgba(31,25,23,0.04),0_10px_30px_-16px_rgba(31,25,23,0.15)] ${t.bg} overflow-hidden hover:shadow-[0_1px_2px_rgba(31,25,23,0.05),0_20px_40px_-20px_rgba(31,25,23,0.25)] transition-shadow duration-500`}
    >
      <div className="flex items-start justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-medium">
          {label}
        </p>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg ${t.iconBg} flex items-center justify-center`}>
            <Icon size={16} weight="duotone" className={t.iconColor} />
          </div>
        )}
      </div>
      <div className={`mt-6 numeric text-[34px] sm:text-[42px] leading-none font-semibold ${t.num}`}>
        {value}
      </div>
      {sub && <p className="mt-2 text-xs text-neutral-500">{sub}</p>}
    </Card>
  );
};
