'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyPoint } from '@/lib/analytics';
import { formatIDR, formatIDRCompact } from '@/lib/utils';

/**
 * Grafik batang: pemasukan vs pengeluaran 6 bulan terakhir.
 * Dua batang berdampingan per bulan supaya mudah dibandingkan.
 */

interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-soft">
      <p className="mb-1 text-xs font-semibold text-foreground">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.name}:</span>
          <span className="tabular font-medium text-foreground">
            {formatIDR(Number(item.value ?? 0))}
          </span>
        </p>
      ))}
    </div>
  );
}

export function MonthlyBarChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(value: number) => formatIDRCompact(value)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--accent))', opacity: 0.4 }} />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}
          />
          <Bar dataKey="income" name="Pemasukan" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={38} />
          <Bar dataKey="expense" name="Pengeluaran" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={38} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
