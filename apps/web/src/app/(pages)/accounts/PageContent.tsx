"use client";

import type { AssetKind } from "@fynlo/types";

import { Badge } from "@fynlo/ui/components/badge";
import { Button } from "@fynlo/ui/components/button";
import { Modal } from "@fynlo/ui/components/modal";
import {
  ArrowRight,
  Bike,
  Building2,
  Coins,
  Info,
  Link2,
  type LucideIcon,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AdjustBalanceForm } from "@/components/AdjustBalanceForm";
import { EmptyState } from "@/components/EmptyState";
import { assetKinds, sourceLabels } from "@/constants";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { accountBalance, inMonth, totalBalance, totals } from "@/utils/finance";
import { formatCompact, formatRupiah, formatSigned } from "@/utils/format";

const assetIcons: Record<AssetKind, LucideIcon> = {
  gold: Coins,
  investment: TrendingUp,
  property: Building2,
  vehicle: Bike,
};

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

export default function PageContent() {
  const { accounts, accountsStatus, assets, loadAccounts, transactions } =
    useFinance();

  const { toast } = useTransactionSheet();
  const [adjustingId, setAdjustingId] = useState<null | string>(null);
  const adjusting = accounts.find((a) => a.id === adjustingId);

  const now = new Date();
  const month = totals(inMonth(transactions, now));
  const tracked = totalBalance(accounts, transactions);
  const assetTotal = assets.reduce((sum, a) => sum + a.value, 0);

  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <h1>Accounts & Assets</h1>
          <p>See your balances and everything you own in one place.</p>
        </div>
        <Link className="btn primary" href="/settings/accounts">
          <Settings aria-hidden="true" size={17} />
          Manage Accounts
        </Link>
      </div>

      <div className="account-summary card">
        <div>
          <span>Net worth</span>
          <strong>{formatRupiah(tracked + assetTotal)}</strong>
          <p>
            {plural(
              accounts.filter((a) => !a.isExcluded).length,
              "active account",
            )}
            , {plural(assets.length, "asset")}
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
          <b className="negative">
            {formatRupiah(month.expense ? -month.expense : 0)}
          </b>
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
          <p>{plural(accounts.length, "source")} of funds tracked</p>
        </div>
      </div>
      {accountsStatus === "error" && (
        <div className="card empty">
          <b>Couldn&apos;t load your accounts</b>
          <span>Check your connection and try again.</span>
          <Button kind="secondary" onClick={() => void loadAccounts()}>
            Try again
          </Button>
        </div>
      )}
      {accountsStatus === "loading" && (
        <div className="card empty">
          <span>Loading accounts...</span>
        </div>
      )}
      {accountsStatus === "ready" && accounts.length === 0 && (
        <div className="card">
          <EmptyState
            description="Add accounts from Manage Accounts to see them here."
            icon={Wallet}
            title="No accounts yet"
          />
        </div>
      )}
      <div className="account-management-grid">
        {accounts.map((account) => {
          const isExcluded = account.isExcluded;
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
                  {account.typeName}
                  {account.mask && ` •• ${account.mask}`}
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
                  <b className="positive">
                    {flow.income > 0 ? "+" : ""}Rp{formatCompact(flow.income)}
                  </b>
                </div>
                <div>
                  <span>Out</span>
                  <b className="negative">
                    {flow.expense > 0 ? "-" : ""}Rp{formatCompact(flow.expense)}
                  </b>
                </div>
              </div>
              <div className="manage-foot">
                <span>
                  <Link2 aria-hidden="true" size={15} />
                  {sourceLabels[account.source]}
                </span>
                <Button
                  aria-label={`Adjust balance of ${account.name}`}
                  kind="ghost"
                  onClick={() => setAdjustingId(account.id)}
                >
                  Adjust
                </Button>
                <Link
                  aria-label={`Transactions of ${account.name}`}
                  className="btn ghost"
                  href={`/transactions?accountId=${account.id}`}
                >
                  Details <ArrowRight aria-hidden="true" size={15} />
                </Link>
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
      {assets.length === 0 && (
        <div className="card">
          <EmptyState
            description="Investments, gold, and property you own will appear here."
            icon={Coins}
            title="No assets yet"
          />
        </div>
      )}
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
      <Modal
        onClose={() => setAdjustingId(null)}
        open={adjusting !== undefined}
        title={`Adjust ${adjusting?.name ?? "Balance"}`}
      >
        {adjusting && (
          <AdjustBalanceForm
            account={adjusting}
            key={adjusting.id}
            onCancel={() => setAdjustingId(null)}
            onSaved={(message) => {
              setAdjustingId(null);
              toast(message);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
