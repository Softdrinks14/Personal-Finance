'use client';

import { ArrowDownRight, ArrowUpRight, Minus, PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { MonthSummary } from '@/lib/analytics';
import { cn, formatIDR } from '@/lib/utils';

/**
 * Tiga kartu ringkasan di atas dashboard:
 * Total Pemasukan, Total Pengeluaran, dan Saldo Bersih bulan ini.
 */

interface SummaryCardsProps {
  summary: MonthSummary;
  /** contoh: "Oktober 2026" */
  periodLabel: string;
}

function TrendChip({ change, invert = false }: { change: number | null; invert?: boolean }) {
  if (change === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> belum ada pembanding
      </span>
    );
  }

  const isUp = change >= 0;
  // Untuk pengeluaran, naik itu kabar kurang baik -> warnanya dibalik.
  const isGood = invert ? !isUp : isUp;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        isGood ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(change)}% vs bulan lalu
    </span>
  );
}

export function SummaryCards({ summary, periodLabel }: SummaryCardsProps) {
  const cards = [
    {
      key: 'income',
      label: 'Total Pemasukan',
      value: summary.income,
      icon: TrendingUp,
      iconClass: 'bg-success/10 text-success',
      valueClass: 'text-success',
      trend: <TrendChip change={summary.incomeChange} />,
    },
    {
      key: 'expense',
      label: 'Total Pengeluaran',
      value: summary.expense,
      icon: TrendingDown,
      iconClass: 'bg-destructive/10 text-destructive',
      valueClass: 'text-destructive',
      trend: <TrendChip change={summary.expenseChange} invert />,
    },
    {
      key: 'net',
      label: 'Saldo Bersih',
      value: summary.net,
      icon: Wallet,
      iconClass: summary.net >= 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive',
      valueClass: summary.net >= 0 ? 'text-foreground' : 'text-destructive',
      trend: (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <PiggyBank className="h-3 w-3" />
          {summary.savingRate}% dari pemasukan ditabung
        </span>
      ),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.key}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', card.iconClass)}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>

              <p className={cn('tabular text-2xl font-semibold tracking-tight', card.valueClass)}>
                {formatIDR(card.value)}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {card.trend}
                <span className="text-xs text-muted-foreground">· {periodLabel}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
