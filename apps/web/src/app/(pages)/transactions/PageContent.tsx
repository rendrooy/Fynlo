"use client";

import { Button } from "@fynlo/ui/components/button";
import { Segmented } from "@fynlo/ui/components/segmented";
import { Select } from "@fynlo/ui/components/select";
import { ArrowLeftRight, Download, Plus, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  currentMonthToDate,
  DateRangeFilter,
} from "@/components/DateRangeFilter";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { TransactionList } from "@/components/TransactionList";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { categoryOptions } from "@/utils/category-options";
import {
  type DateRangePreset,
  resolveDateRange,
  sortNewestFirst,
  touchesAccount,
} from "@/utils/finance";

type TypeFilter = "all" | "expense" | "income" | "transfer";

const PAGE_SIZES = [10, 25, 50, 100];

export default function PageContent() {
  const {
    accounts,
    accountsStatus,
    categories,
    transactions,
    transactionsStatus,
  } = useFinance();
  const { openSheet, toast } = useTransactionSheet();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const params = useSearchParams();
  const [chosenAccountId, setAccountId] = useState(
    params.get("accountId") ?? "all",
  );
  // A saved link can point to an account that has since been deleted.
  const accountId =
    accountsStatus === "ready" &&
    !accounts.some((account) => account.id === chosenAccountId)
      ? "all"
      : chosenAccountId;
  const [categoryId, setCategoryId] = useState("all");
  const [preset, setPreset] = useState<DateRangePreset>("all");
  const [custom, setCustom] = useState(currentMonthToDate);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0] as number);

  const { range } = resolveDateRange(preset, custom, transactions);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sortNewestFirst(transactions).filter((t) => {
      const category = categories.find((c) => c.id === t.categoryId);
      return (
        t.date >= range.from &&
        t.date <= range.to &&
        (type === "all" || t.type === type) &&
        (accountId === "all" || touchesAccount(t, accountId)) &&
        (categoryId === "all" || t.categoryId === categoryId) &&
        (!needle ||
          `${t.name} ${t.detail} ${category?.name}`
            .toLowerCase()
            .includes(needle))
      );
    });
  }, [
    accountId,
    categories,
    categoryId,
    query,
    range.from,
    range.to,
    transactions,
    type,
  ]);

  const pageCount = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  function exportCsv() {
    const quote = (value: number | string) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const rows = filtered.map((t) =>
      [
        t.date,
        t.time,
        t.name,
        t.detail,
        categories.find((c) => c.id === t.categoryId)?.name ?? "",
        accounts.find((a) => a.id === t.accountId)?.name ?? "",
        accounts.find((a) => a.id === t.toAccountId)?.name ?? "",
        t.type,
        t.amount,
      ]
        .map(quote)
        .join(","),
    );
    const csv = [
      "date,time,name,detail,category,account,to_account,type,amount",
      ...rows,
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "fynlo-transactions.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    toast("CSV exported");
  }

  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <h1>All Transactions</h1>
          <p>Search, check, and manage all of your financial activity.</p>
        </div>
        <Button kind="secondary" onClick={exportCsv}>
          <Download aria-hidden="true" size={17} />
          Export CSV
        </Button>
      </div>

      <DateRangeFilter
        custom={custom}
        onCustomChange={(next) => {
          setCustom(next);
          setPage(0);
        }}
        onPresetChange={(next) => {
          setPreset(next);
          setPage(0);
        }}
        preset={preset}
        range={range}
      />

      <div className="card filters">
        <div className="search-box">
          <Search aria-hidden="true" size={20} />
          <input
            aria-label="Search transactions"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search transactions, merchants, or notes..."
            type="search"
            value={query}
          />
        </div>
        <Select
          aria-label="Filter by account"
          className="select-filter"
          onChange={(next) => {
            setAccountId(next);
            setPage(0);
          }}
          options={[
            { label: "All accounts", value: "all" },
            ...accounts.map((account) => ({
              label: account.name,
              value: account.id,
            })),
          ]}
          value={accountId}
        />
        <Select
          aria-label="Filter by category"
          className="select-filter"
          onChange={(next) => {
            setCategoryId(next);
            setPage(0);
          }}
          options={[
            { label: "All categories", value: "all" },
            ...categoryOptions(
              categories.filter((c) => type === "all" || c.type === type),
            ),
          ]}
          value={categoryId}
        />
      </div>

      <div className="list-toolbar">
        <Segmented
          label="Filter by type"
          onChange={(next: TypeFilter) => {
            setType(next);
            setPage(0);
            const selected = categories.find((c) => c.id === categoryId);
            if (next !== "all" && selected && selected.type !== next) {
              setCategoryId("all");
            }
          }}
          options={[
            { label: "All", value: "all" },
            { label: "Income", value: "income" },
            { label: "Expenses", value: "expense" },
            { label: "Transfers", value: "transfer" },
          ]}
          value={type}
        />
        <span>
          {filtered.length}{" "}
          {filtered.length === 1 ? "transaction" : "transactions"}
        </span>
      </div>

      <section className="card table-card">
        <div className="table-head">
          <span>Transaction</span>
          <span>Account & date</span>
          <span>Category</span>
          <span>Amount</span>
          <span />
        </div>
        {visible.length > 0 ? (
          <TransactionList items={visible} />
        ) : transactionsStatus === "loading" ? (
          <div className="empty">
            <span>Loading transactions...</span>
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            description="Transactions you record will appear here."
            icon={ArrowLeftRight}
            title="No transactions yet"
          />
        ) : (
          <EmptyState
            description="Try a different keyword or filter."
            icon={Search}
            title="No matching transactions"
          />
        )}
        <Pagination
          onPageChange={(next) => {
            setPage(next);
            window.scrollTo({ top: 0 });
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
          page={safePage}
          pageSize={pageSize}
          pageSizes={PAGE_SIZES}
          total={filtered.length}
        />
      </section>

      <button
        aria-label="Add transaction"
        className="mobile-fab"
        onClick={() => openSheet()}
        type="button"
      >
        <Plus aria-hidden="true" size={20} />
      </button>
    </div>
  );
}
