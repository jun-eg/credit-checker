'use client';

import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
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
  return `${String(props.name)} ${(percent * 100).toFixed(0)}%`;
}

export function CategoryBarChart({ data, currency }: CategoryBarChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-600">データがありません</p>
    );
  }

  // Rechartsにfillを渡すことでCell不要でスライスを色付け
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
        />
        <Tooltip
          formatter={(value) => [formatAmount(Number(value), currency), '金額']}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
