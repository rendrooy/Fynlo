"use client";

import type { AssetKind } from "@fynlo/types";

import { Badge } from "@fynlo/ui/components/badge";
import { Button } from "@fynlo/ui/components/button";
import {
  Bike,
  Building2,
  Coins,
  Info,
  Link2,
  type LucideIcon,
  Plus,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

import {
  accountKinds,
  assetKinds,
  NOT_AVAILABLE,
  sourceLabels,
} from "@/constants";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { accountBalance, inMonth, totals } from "@/utils/finance";
import { formatCompact, formatRupiah, formatSigned } from "@/utils/format";

const assetIcons: Record<AssetKind, LucideIcon> = {
  gold: Coins,
  investment: TrendingUp,
  property: Building2,
  vehicle: Bike,
};

export default function PageContent() {
  const { accounts, assets, transactions } = useFinance();
  const { toast } = useTransactionSheet();
  const [excluded, setExcluded] = useState<string[]>([]);

  const now = new Date();
  const month = totals(inMonth(transactions, now));
  const tracked = accounts
    .filter((a) => !excluded.includes(a.id))
    .reduce((sum, a) => sum + accountBalance(a, transactions), 0);
  const assetTotal = assets.reduce((sum, a) => sum + a.value, 0);

  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <h1>Accounts & Assets</h1>
          <p>Manage every source of funds and asset you track in Fynlo.</p>
        </div>
        <Button onClick={() => toast(NOT_AVAILABLE)}>
          <Plus aria-hidden="true" size={17} />
          Add Account
        </Button>
      </div>

      <div className="account-summary card">
        <div>
          <span>Net worth</span>
          <strong>{formatRupiah(tracked + assetTotal)}</strong>
          <p>
            {accounts.length - excluded.length} active accounts, {assets.length}{" "}
            assets
          </p>
        </div>
        <div className="summary-stat">
          <span>Account balance</span>
          <b>{formatRupiah(tracked)}</b>
        </div>
        <div className="summary-stat">
          <span>Income this month</span>
          <b className="positive">{formatSigned(month.income)}</b>
        </div>
        <div className="summary-stat">
          <span>Expenses this month</span>
          <b className="negative">{formatRupiah(-month.expense)}</b>
        </div>
      </div>

      <div className="notice">
        <Info aria-hidden="true" size={20} />
        <div>
          <b>About account balances</b>
          <span>
            Fynlo estimates balances from detected transactions. This is not an
            official balance from your bank, and you can correct it at any time.
          </span>
        </div>
      </div>

      <div className="section-heading">
        <div>
          <h2>Accounts & Pockets</h2>
          <p>{accounts.length} sources of funds tracked</p>
        </div>
      </div>
      <div className="account-management-grid">
        {accounts.map((account) => {
          const isExcluded = excluded.includes(account.id);
          const estimated = account.source === "email";
          const flow = totals(
            inMonth(
              transactions.filter((t) => t.accountId === account.id),
              now,
            ),
          );
          return (
            <div className="card manage-account" key={account.id}>
              <div className="account-head">
                <div
                  className="bank-logo"
                  style={{ background: account.color }}
                >
                  {account.name[0]}
                </div>
                <Badge
                  tone={
                    isExcluded ? "neutral" : estimated ? "warning" : "success"
                  }
                >
                  {isExcluded ? "Excluded" : estimated ? "Estimated" : "Active"}
                </Badge>
              </div>
              <div>
                <b>{account.name}</b>
                <span>
                  {accountKinds[account.kind]} •• {account.mask}
                </span>
              </div>
              <strong>
                {formatRupiah(accountBalance(account, transactions))}
              </strong>
              <span className="muted">
                {estimated ? "Estimated" : "Recorded"} balance
              </span>
              <div className="inout">
                <div>
                  <span>In</span>
                  <b className="positive">+Rp{formatCompact(flow.income)}</b>
                </div>
                <div>
                  <span>Out</span>
                  <b className="negative">-Rp{formatCompact(flow.expense)}</b>
                </div>
              </div>
              <div className="manage-foot">
                <span>
                  <Link2 aria-hidden="true" size={15} />
                  {sourceLabels[account.source]}
                </span>
                <Button
                  kind="ghost"
                  onClick={() =>
                    setExcluded(
                      isExcluded
                        ? excluded.filter((id) => id !== account.id)
                        : [...excluded, account.id],
                    )
                  }
                >
                  {isExcluded ? "Include" : "Exclude"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-heading">
        <div>
          <h2>Assets</h2>
          <p>Worth {formatRupiah(assetTotal)} in total</p>
        </div>
      </div>
      <div className="assets-grid">
        {assets.map((asset) => {
          const Icon = assetIcons[asset.kind];
          return (
            <div className="card asset-card" key={asset.id}>
              <div className="tx-icon cat-wallet">
                <Icon aria-hidden="true" size={20} />
              </div>
              <div>
                <b>{asset.name}</b>
                <span>{assetKinds[asset.kind]}</span>
              </div>
              <strong>{formatRupiah(asset.value)}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}
