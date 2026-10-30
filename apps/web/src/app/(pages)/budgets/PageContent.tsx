"use client";

import { Badge } from "@fynlo/ui/components/badge";
import { Button } from "@fynlo/ui/components/button";
import { Modal } from "@fynlo/ui/components/modal";
import { Pencil, Plus, Target } from "lucide-react";
import { type FormEvent, useState } from "react";

import { CategoryIcon } from "@/components/CategoryIcon";
import { EmptyState } from "@/components/EmptyState";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { budgetSummary } from "@/utils/finance";
import { formatGrouped, formatRupiah } from "@/utils/format";

const WARNING_AT = 75;

export default function PageContent() {
  const { budgets, categories, saveBudget, transactions } = useFinance();
  const { toast } = useTransactionSheet();
  const [editing, setEditing] = useState<null | {
    categoryId: string;
    limit: number;
  }>(null);
  const [submitted, setSubmitted] = useState(false);

  const now = new Date();
  const { limit, remaining, spent, spentMap } = budgetSummary(
    budgets,
    transactions,
    now,
  );
  const usedPercent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const daysLeft =
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() -
    now.getDate();
  const expenseCategories = categories.filter((c) => c.type === "expense");
  const unbudgeted = expenseCategories.find(
    (c) => !budgets.some((b) => b.categoryId === c.id),
  );

  function openEditor(categoryId: string, value: number) {
    setSubmitted(false);
    setEditing({ categoryId, limit: value });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!editing || !editing.categoryId || editing.limit <= 0) return;
    saveBudget(editing);
    setEditing(null);
    toast("Budget saved");
  }

  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <h1>Monthly Budgets</h1>
          <p>Plan your spending and stay on track toward your goals.</p>
        </div>
        <Button onClick={() => openEditor(unbudgeted?.id ?? "", 0)}>
          <Plus aria-hidden="true" size={17} />
          Create Budget
        </Button>
      </div>

      <div className="budget-hero card">
        <div>
          <span>
            {now.toLocaleDateString("en-GB", { month: "long" }).toUpperCase()}{" "}
            BUDGET
          </span>
          <strong>
            {formatRupiah(spent)} <small>of {formatRupiah(limit)}</small>
          </strong>
          <p>
            {remaining >= 0 ? "Remaining" : "Over by"}{" "}
            <b>{formatRupiah(Math.abs(remaining))}</b>
            {remaining >= 0 &&
              ` for ${daysLeft} more ${daysLeft === 1 ? "day" : "days"}`}
          </p>
        </div>
        <div
          className="budget-ring"
          style={{
            background: `conic-gradient(${remaining < 0 ? "#f43f5e" : "var(--primary)"} ${Math.min(usedPercent, 100)}%,var(--surface-2) 0)`,
          }}
        >
          <div>
            <b>{usedPercent}%</b>
            <span>used</span>
          </div>
        </div>
        <div className="budget-health">
          <Badge
            tone={
              budgets.length === 0
                ? "neutral"
                : remaining < 0
                  ? "danger"
                  : usedPercent > WARNING_AT + 15
                    ? "warning"
                    : "success"
            }
          >
            {budgets.length === 0
              ? "No budgets yet"
              : remaining < 0
                ? "Over budget"
                : usedPercent > WARNING_AT + 15
                  ? "Almost used up"
                  : "Healthy budget"}
          </Badge>
          <span>
            {budgets.length === 0
              ? "Create a budget to start tracking your spending."
              : remaining < 0
                ? "You have spent more than planned this month."
                : "Your spending is still in line with this month's plan."}
          </span>
        </div>
      </div>

      <div className="section-heading">
        <div>
          <h2>Budgets by Category</h2>
          <p>Track the spending limit for each category</p>
        </div>
      </div>
      {budgets.length === 0 && (
        <div className="card">
          <EmptyState
            description="Set a monthly limit for a category to see it here."
            icon={Target}
            title="No budgets yet"
          />
        </div>
      )}
      <div className="budget-grid">
        {budgets.map((budget) => {
          const category = categories.find((c) => c.id === budget.categoryId);
          const used = spentMap.get(budget.categoryId) ?? 0;
          const percent = Math.round((used / budget.limit) * 100);
          const over = percent > 100;
          const warn = !over && percent > WARNING_AT;
          return (
            <div className="card budget-card" key={budget.categoryId}>
              <div className="budget-title">
                <div className={`tx-icon cat-${category?.icon}`}>
                  <CategoryIcon icon={category?.icon ?? ""} />
                </div>
                <div>
                  <b>{category?.name}</b>
                  <span>
                    {over ? "Over limit" : warn ? "Near limit" : "Within limit"}
                  </span>
                </div>
                <Button
                  aria-label={`Edit ${category?.name} budget`}
                  kind="ghost"
                  onClick={() => openEditor(budget.categoryId, budget.limit)}
                >
                  <Pencil aria-hidden="true" size={16} />
                </Button>
              </div>
              <div className="budget-values">
                <b>{formatRupiah(used)}</b>
                <span>of {formatRupiah(budget.limit)}</span>
              </div>
              <div
                aria-label={`${category?.name} budget used`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.min(percent, 100)}
                className={`progress ${over ? "over" : warn ? "warn" : ""}`}
                role="progressbar"
              >
                <i style={{ width: `${Math.min(percent, 100)}%` }} />
              </div>
              <div className="budget-bottom">
                <span>{percent}% used</span>
                <b>
                  {over
                    ? `${formatRupiah(used - budget.limit)} over limit`
                    : `${formatRupiah(budget.limit - used)} left`}
                </b>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        onClose={() => setEditing(null)}
        open={editing !== null}
        title="Set Budget"
      >
        {editing && (
          <form noValidate onSubmit={submit}>
            <label>
              Category
              <select
                onChange={(event) =>
                  setEditing({ ...editing, categoryId: event.target.value })
                }
                value={editing.categoryId}
              >
                <option value="">Choose a category</option>
                {expenseCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {submitted && !editing.categoryId && (
                <span className="field-error">Choose a category</span>
              )}
            </label>
            <label>
              Budget limit
              <input
                autoFocus
                inputMode="numeric"
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    limit: Number(
                      event.target.value.replace(/\D/g, "").slice(0, 13),
                    ),
                  })
                }
                placeholder="Rp0"
                value={editing.limit ? `Rp${formatGrouped(editing.limit)}` : ""}
              />
              {submitted && editing.limit <= 0 && (
                <span className="field-error">
                  Enter a limit greater than 0
                </span>
              )}
            </label>
            <div className="modal-actions">
              <Button kind="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Budget</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
