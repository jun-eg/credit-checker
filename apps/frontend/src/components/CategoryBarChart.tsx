'use client';

import { useSyncExternalStore } from 'react';
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { PieLabelRenderProps, TooltipContentProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { CategorySummary } from '../types/receipt';

interface CategoryBarChartProps {
  data: CategorySummary[];
  currency: string;
}

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#f43f5e',
  '#06b6d4',
  '#f97316',
  '#ec4899',
];

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function renderLabel(props: PieLabelRenderProps): string {
  const percent = props.percent ?? 0;
  if (percent < 0.05) return '';
  return `${(percent * 100).toFixed(0)}%`;
}

function CustomTooltip({
  active,
  payload,
  currency,
}: TooltipContentProps<ValueType, NameType> & { currency: string }) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  const name = String(item.name ?? '');
  const value = Number(item.value ?? 0);
  const fill = (item.payload as { fill?: string }).fill ?? '#888';

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: fill }}
        />
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {name}
        </span>
      </div>
      <p className="mt-1.5 text-right text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
        {formatAmount(value, currency)}
      </p>
    </div>
  );
}

// useSyncExternalStore でサーバー/クライアントを区別する（useEffect+setState は lint 非推奨）
const emptySubscribe = () => () => {};

export function CategoryBarChart({ data, currency }: CategoryBarChartProps) {
  // サーバー: false、クライアント: true を返す。ハイドレーション時は両者が一致する
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-600">データがありません</p>
    );
  }

  // Recharts は SSR でハイドレーションミスマッチを起こすため、クライアントのみでレンダリング
  if (!isClient) return <div className="h-80" />;

  const chartData = data.map((item, i) => ({
    name: item.category,
    total: item.total,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="total"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={110}
          label={renderLabel}
          labelLine={false}
        />
        <Tooltip
          content={(props: TooltipContentProps<ValueType, NameType>) => (
            <CustomTooltip {...props} currency={currency} />
          )}
        />
        <Legend
          formatter={(value: string) => (
            <span className="text-sm text-zinc-600 dark:text-zinc-400">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
