'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { MonthTotal } from '../types/receipt';

interface MonthlyBarChartProps {
  data: MonthTotal[];
  currency: string;
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

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

  const value = Number(payload[0]?.value ?? 0);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
        {formatAmount(value, currency)}
      </p>
    </div>
  );
}

export function MonthlyBarChart({ data, currency }: MonthlyBarChartProps) {
  const chartData = data.map((d) => ({
    name: MONTH_LABELS[d.month - 1],
    total: d.total,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
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
        <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
