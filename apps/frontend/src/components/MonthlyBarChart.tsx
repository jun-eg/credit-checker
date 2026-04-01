'use client';

import { useSyncExternalStore } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { MonthCategoryTotal } from '../types/receipt';

interface MonthlyBarChartProps {
  data: MonthCategoryTotal[];
  currency: string;
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const CATEGORY_COLORS: Record<string, string> = {};
const COLOR_PALETTE = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
  '#f43f5e', '#06b6d4', '#f97316', '#ec4899',
];

function getCategoryColor(category: string, allCategories: string[]): string {
  if (!CATEGORY_COLORS[category]) {
    const idx = allCategories.indexOf(category);
    CATEGORY_COLORS[category] = COLOR_PALETTE[idx % COLOR_PALETTE.length];
  }
  return CATEGORY_COLORS[category];
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatAmountShort(amount: number): string {
  if (amount >= 10000) return `${(amount / 10000).toFixed(1)}万`;
  return String(amount);
}

function CustomTooltip({
  active,
  payload,
  label,
  currency,
}: TooltipContentProps<ValueType, NameType> & { currency: string }) {
  if (!active || !payload?.length) return null;

  const items = payload.filter((p) => Number(p.value ?? 0) > 0);
  const total = items.reduce((sum, p) => sum + Number(p.value ?? 0), 0);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div key={String(item.dataKey)} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: String(item.fill ?? item.color ?? '#888') }}
              />
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{String(item.dataKey)}</span>
            </div>
            <span className="text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
              {formatAmount(Number(item.value), currency)}
            </span>
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">合計</span>
          <span className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatAmount(total, currency)}
          </span>
        </div>
      )}
    </div>
  );
}

// useSyncExternalStore でサーバー/クライアントを区別する（useEffect+setState は lint 非推奨）
const emptySubscribe = () => () => {};

export function MonthlyBarChart({ data, currency }: MonthlyBarChartProps) {
  // サーバー: false、クライアント: true を返す。ハイドレーション時は両者が一致する
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Recharts は SSR でハイドレーションミスマッチを起こすため、クライアントのみでレンダリング
  if (!isClient) return <div className="h-[280px]" />;

  // カテゴリ一覧（年間合計順に並べる）
  const categoryTotals = new Map<string, number>();
  for (const row of data) {
    categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? 0) + row.total);
  }
  const categories = [...categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  // { name: '1月', カテゴリA: 1000, カテゴリB: 500 }[] に変換
  const chartData = MONTH_LABELS.map((label, i) => {
    const month = i + 1;
    const entry: Record<string, string | number> = { name: label };
    for (const cat of categories) {
      const row = data.find((d) => d.month === month && d.category === cat);
      entry[cat] = row?.total ?? 0;
    }
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} barCategoryGap="30%">
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(113,113,122,0.15)" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#a1a1aa' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatAmountShort}
          tick={{ fontSize: 11, fill: '#a1a1aa' }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          cursor={{ fill: 'rgba(113,113,122,0.08)' }}
          content={(props: TooltipContentProps<ValueType, NameType>) => (
            <CustomTooltip {...props} currency={currency} />
          )}
        />
        <Legend
          formatter={(value: string) => (
            <span className="text-sm text-zinc-600 dark:text-zinc-400">{value}</span>
          )}
        />
        {categories.map((cat) => (
          <Bar
            key={cat}
            dataKey={cat}
            stackId="monthly"
            fill={getCategoryColor(cat, categories)}
            radius={categories.indexOf(cat) === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
