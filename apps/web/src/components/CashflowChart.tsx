"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompact, formatRupiah } from "@/utils/format";

const INCOME = "var(--chart-income)";
const EXPENSE = "var(--chart-expense)";

export interface CashflowPoint {
  expense: number;
  income: number;
  label: string;
}

export function CashflowChart({
  data,
  height = 235,
}: {
  data: CashflowPoint[];
  height?: number;
}) {
  return (
    <div style={{ height, marginTop: 10 }}>
      <ResponsiveContainer
        height="100%"
        initialDimension={{ height, width: 320 }}
        minWidth={0}
        width="100%"
      >
        <AreaChart
          data={data}
          margin={{ bottom: 0, left: 0, right: 8, top: 8 }}
        >
          <defs>
            <linearGradient id="cashflow-income" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={INCOME} stopOpacity={0.2} />
              <stop offset="1" stopColor={INCOME} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="cashflow-expense" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={EXPENSE} stopOpacity={0.12} />
              <stop offset="1" stopColor={EXPENSE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            minTickGap={24}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickFormatter={(value: number) => formatCompact(value)}
            tickLine={false}
            width={36}
          />
          <Tooltip
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as CashflowPoint | undefined;
              if (!active || !point) return null;
              return (
                <div className="tooltip-card">
                  <small>{point.label}</small>
                  <span>
                    <i className="dot income" />
                    Income <b>{formatRupiah(point.income)}</b>
                  </span>
                  <span>
                    <i className="dot expense" />
                    Expenses <b>{formatRupiah(point.expense)}</b>
                  </span>
                </div>
              );
            }}
            cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Area
            dataKey="income"
            fill="url(#cashflow-income)"
            isAnimationActive={false}
            name="Income"
            stroke={INCOME}
            strokeWidth={2}
            type="monotone"
          />
          <Area
            dataKey="expense"
            fill="url(#cashflow-expense)"
            isAnimationActive={false}
            name="Expenses"
            stroke={EXPENSE}
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
