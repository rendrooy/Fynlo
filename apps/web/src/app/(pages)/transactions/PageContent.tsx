"use client";

import { Button } from "@fynlo/ui/components/button";
import { Segmented } from "@fynlo/ui/components/segmented";
import { Download, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { TransactionList } from "@/components/TransactionList";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { sortNewestFirst } from "@/utils/finance";

type TypeFilter = "all" | "expense" | "income";

const PAGE_SIZE = 10;

export default function PageContent() {
  const { accounts, categories, transactions } = useFinance();
  const { openSheet, toast } = useTransactionSheet();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [accountId, setAccountId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sortNewestFirst(transactions).filter((t) => {
      const category = categories.find((c) => c.id === t.categoryId);
      return (
        (type === "all" || t.type === type) &&
        (accountId === "all" || t.accountId === accountId) &&
        (categoryId === "all" || t.categoryId === categoryId) &&
        (!needle ||
          `${t.name} ${t.detail} ${category?.name}`
            .toLowerCase()
            .includes(needle))
      );
    });
  }, [accountId, categories, categoryId, query, transactions, type]);

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

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
        t.type,
        t.amount,
      ]
        .map(quote)
        .join(","),
    );
    const csv = [
      "date,time,name,detail,category,account,type,amount",
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
        <select
          aria-label="Filter by account"
          className="select-filter"
          onChange={(event) => {
            setAccountId(event.target.value);
            setPage(0);
          }}
          value={accountId}
        >
          <option value="all">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by category"
          className="select-filter"
          onChange={(event) => {
            setCategoryId(event.target.value);
            setPage(0);
          }}
          value={categoryId}
        >
          <option value="all">All categories</option>
          {categories
            .filter((c) => type === "all" || c.type === type)
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </select>
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
          ]}
          value={type}
        />
        <span>{filtered.length} transactions</span>
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
        ) : (
          <div className="empty">
            <div>
              <Search aria-hidden="true" size={20} />
            </div>
            <b>No matching transactions</b>
            <span>Try a different keyword or filter.</span>
          </div>
        )}
        <div className="pagination">
          <span>
            Showing {filtered.length ? start + 1 : 0}–{start + visible.length}{" "}
            of {filtered.length}
          </span>
          <div>
            <Button
              disabled={safePage === 0}
              kind="secondary"
              onClick={() => setPage(safePage - 1)}
            >
              Previous
            </Button>
            <Button
              disabled={safePage >= pageCount - 1}
              kind="secondary"
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
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
