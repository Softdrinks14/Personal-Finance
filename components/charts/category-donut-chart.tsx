'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategorySlice } from '@/lib/analytics';
import { formatIDR } from '@/lib/utils';

/**
 * Diagram donat: pembagian pengeluaran (atau pemasukan) per kategori.
 * Tiap potongan memakai warna kategori yang sama dengan yang dipakai di tabel.
 */

interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  payload?: CategorySlice;
}

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const slice = payload[0]?.payload;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-soft">
      <p className="text-xs font-semibold text-foreground">{slice?.name ?? ''}</p>
      <p className="tabular text-xs text-muted-foreground">
        {formatIDR(Number(payload[0]?.value ?? 0))}
        {slice ? ` · ${slice.share}%` : ''}
      </p>
    </div>
  );
}

export function CategoryDonutChart({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        Belum ada data untuk ditampilkan.
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="hsl(var(--card))"
            strokeWidth={2}
          >
            {data.map((slice) => (
              <Cell key={slice.id} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
          <Legend
            iconType="circle"
            layout="horizontal"
            verticalAlign="bottom"
            wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
