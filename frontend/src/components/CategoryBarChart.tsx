import { CategorySummary } from '../types/receipt';

interface CategoryBarChartProps {
  data: CategorySummary[];
  currency: string;
}

const BAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-pink-500',
];

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CategoryBarChart({ data, currency }: CategoryBarChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-600">データがありません</p>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.total));

  return (
    <div className="flex flex-col gap-3">
      {data.map((item, i) => (
        <div key={item.category} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-right text-xs text-zinc-500 dark:text-zinc-400">
            {item.category}
          </span>
          <div className="flex flex-1 items-center gap-2">
            <div className="relative h-6 flex-1 rounded-sm bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`absolute inset-y-0 left-0 rounded-sm ${BAR_COLORS[i % BAR_COLORS.length]}`}
                style={{ width: `${(item.total / maxTotal) * 100}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
              {formatAmount(item.total, currency)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
