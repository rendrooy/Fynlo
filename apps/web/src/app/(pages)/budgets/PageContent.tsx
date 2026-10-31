"use client";

import { Badge } from "@fynlo/ui/components/badge";
import { Button } from "@fynlo/ui/components/button";
import { Modal } from "@fynlo/ui/components/modal";
import { Select } from "@fynlo/ui/components/select";
import { Pencil, Plus, Target } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { CategoryIcon } from "@/components/CategoryIcon";
import { EmptyState } from "@/components/EmptyState";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { ApiError } from "@/services/api";
import { categoryOptions } from "@/utils/category-options";
import { budgetSummary, periodRange } from "@/utils/finance";
import {
  formatDayShort,
  formatGrouped,
  formatRupiah,
  parseIsoDate,
  toIsoDate,
} from "@/utils/format";

const WARNING_AT = 75;
const DAY_MS = 86400000;

interface Editing {
  categoryId: string;
  groupId: string;
  /** Unset while creating a new budget. */
  id?: string;
  limit: number;
  periodId: string;
}

export default function PageContent() {
  const {
    budgetGroups,
    budgetPeriods,
    budgets,
    budgetsStatus,
    categories,
    createBudget,
    deleteBudget,
    loadBudgets,
    transactions,
    updateBudget,
  } = useFinance();
  const { toast } = useTransactionSheet();
  const [chosenPeriodId, setPeriodId] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const now = new Date();
  const today = toIsoDate(now);
  const period =
    budgetPeriods.find((p) => p.id === chosenPeriodId) ??
    budgetPeriods.find((p) => budgets.some((b) => b.periodId === p.id)) ??
    budgetPeriods[0];
  const range = period ? periodRange(period, now) : { from: today, to: today };
  const shown = budgets.filter((b) => b.periodId === period?.id);
  const { limit, remaining, spent, spentMap } = budgetSummary(
    shown,
    transactions,
    range,
  );
  const usedPercent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const daysLeft = Math.round(
    (parseIsoDate(range.to).getTime() - parseIsoDate(today).getTime()) / DAY_MS,
  );
  const expenseCategories = categories.filter((c) => c.type === "expense");
  const editedPeriodId = editing?.periodId;
  const available = expenseCategories.filter(
    (c) =>
      !budgets.some(
        (b) => b.categoryId === c.id && b.periodId === editedPeriodId,
      ),
  );
  const editedCategory = categories.find((c) => c.id === editing?.categoryId);
  const visibleGroups = budgetGroups.filter((g) =>
    shown.some((b) => b.groupId === g.id),
  );

  function openNew() {
    const periodId = period?.id ?? "";
    setSubmitted(false);
    setError("");
    setEditing({
      categoryId:
        expenseCategories.find(
          (c) =>
            !budgets.some(
              (b) => b.categoryId === c.id && b.periodId === periodId,
            ),
        )?.id ?? "",
      groupId: budgetGroups[0]?.id ?? "",
      limit: 0,
      periodId,
    });
  }

  function changePeriod(periodId: string) {
    if (!editing) return;
    const taken =
      !editing.id &&
      budgets.some(
        (b) => b.categoryId === editing.categoryId && b.periodId === periodId,
      );
    setEditing({
      ...editing,
      categoryId: taken ? "" : editing.categoryId,
      periodId,
    });
  }

  async function run(action: () => Promise<void>, message: string) {
    setError("");
    setSaving(true);
    try {
      await action();
      setEditing(null);
      toast(message);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (
      !editing ||
      !editing.categoryId ||
      !editing.periodId ||
      !editing.groupId ||
      editing.limit <= 0
    ) {
      return;
    }
    const { categoryId, groupId, id, limit: newLimit, periodId } = editing;
    void run(
      () =>
        id
          ? updateBudget(id, { groupId, limit: newLimit, periodId })
          : createBudget({ categoryId, groupId, limit: newLimit, periodId }),
      "Budget saved",
    );
    setPeriodId(periodId);
  }

  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <h1>Budgets</h1>
          <p>Plan your spending and stay on track toward your goals.</p>
        </div>
        <div className="account-actions">
          <Link className="btn secondary" href="/settings/budgets">
            Periods & Groups
          </Link>
          <Button onClick={openNew}>
            <Plus aria-hidden="true" size={17} />
            Create Budget
          </Button>
        </div>
      </div>

      {budgetsStatus === "error" && (
        <div className="card empty">
          <b>Couldn&apos;t load your budgets</b>
          <span>Check your connection and try again.</span>
          <Button kind="secondary" onClick={() => void loadBudgets()}>
            Try again
          </Button>
        </div>
      )}
      {budgetsStatus === "loading" && (
        <div className="card empty">
          <span>Loading budgets...</span>
        </div>
      )}

      {budgetsStatus === "ready" && period && (
        <>
          <div className="budget-period-filter">
            <Select
              aria-label="Budget period"
              onChange={setPeriodId}
              options={budgetPeriods.map((p) => ({
                label: p.name,
                value: p.id,
              }))}
              value={period.id}
            />
            <span>
              {formatDayShort(range.from)} – {formatDayShort(range.to)}
            </span>
          </div>

          <div className="budget-hero card">
            <div>
              <span>{period.name.toUpperCase()} BUDGET</span>
              <strong>
                {formatRupiah(spent)} <small>of {formatRupiah(limit)}</small>
              </strong>
              <p>
                {remaining >= 0 ? "Remaining" : "Over by"}{" "}
                <b>{formatRupiah(Math.abs(remaining))}</b>
                {remaining >= 0 &&
                  daysLeft >= 0 &&
                  today >= range.from &&
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
                  shown.length === 0
                    ? "neutral"
                    : remaining < 0
                      ? "danger"
                      : usedPercent > WARNING_AT + 15
                        ? "warning"
                        : "success"
                }
              >
                {shown.length === 0
                  ? "No budgets yet"
                  : remaining < 0
                    ? "Over budget"
                    : usedPercent > WARNING_AT + 15
                      ? "Almost used up"
                      : "Healthy budget"}
              </Badge>
              <span>
                {shown.length === 0
                  ? "Create a budget to start tracking your spending."
                  : remaining < 0
                    ? "You have spent more than planned in this period."
                    : "Your spending is still in line with this period's plan."}
              </span>
            </div>
          </div>

          {shown.length === 0 && (
            <div className="card mt-4">
              <EmptyState
                description="Set a limit for a category to see it here."
                icon={Target}
                title="No budgets in this period"
              />
            </div>
          )}

          {visibleGroups.map((group) => {
            const members = shown.filter((b) => b.groupId === group.id);
            const groupTotals = budgetSummary(members, transactions, range);
            return (
              <section key={group.id}>
                <div className="section-heading">
                  <div>
                    <h2>{group.name}</h2>
                    <p>
                      {formatRupiah(groupTotals.spent)} of{" "}
                      {formatRupiah(groupTotals.limit)}
                    </p>
                  </div>
                </div>
                <div className="budget-grid">
                  {members.map((budget) => {
                    const category = categories.find(
                      (c) => c.id === budget.categoryId,
                    );
                    const used = spentMap.get(budget.categoryId) ?? 0;
                    const percent = Math.round((used / budget.limit) * 100);
                    const over = percent > 100;
                    const warn = !over && percent > WARNING_AT;
                    return (
                      <div className="card budget-card" key={budget.id}>
                        <div className="budget-title">
                          <div className={`tx-icon cat-${category?.icon}`}>
                            <CategoryIcon icon={category?.icon ?? ""} />
                          </div>
                          <div>
                            <b>{category?.name}</b>
                            <span>
                              {over
                                ? "Over limit"
                                : warn
                                  ? "Near limit"
                                  : "Within limit"}
                            </span>
                          </div>
                          <Button
                            aria-label={`Edit ${category?.name} budget`}
                            kind="ghost"
                            onClick={() => {
                              setSubmitted(false);
                              setError("");
                              setEditing({ ...budget });
                            }}
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
              </section>
            );
          })}
        </>
      )}

      <Modal
        onClose={() => setEditing(null)}
        open={editing !== null}
        title={editing?.id ? "Edit Budget" : "Create Budget"}
      >
        {editing && (
          <form noValidate onSubmit={submit}>
            <label>
              Category
              {/* To budget another category, delete this one and create a new budget. */}
              {editing.id ? (
                <input disabled value={editedCategory?.name ?? ""} />
              ) : (
                <Select
                  onChange={(categoryId) =>
                    setEditing({ ...editing, categoryId })
                  }
                  options={categoryOptions(available)}
                  placeholder={
                    available.length === 0
                      ? "Every category has a budget here"
                      : "Choose a category"
                  }
                  value={editing.categoryId}
                />
              )}
              {submitted && !editing.categoryId && (
                <span className="field-error">Choose a category</span>
              )}
            </label>
            <div className="form-grid">
              <label>
                Period
                <Select
                  onChange={changePeriod}
                  options={budgetPeriods.map((p) => ({
                    label: p.name,
                    value: p.id,
                  }))}
                  placeholder="Add a period first"
                  value={editing.periodId}
                />
                {submitted && !editing.periodId && (
                  <span className="field-error">Choose a period</span>
                )}
              </label>
              <label>
                Group
                <Select
                  onChange={(groupId) => setEditing({ ...editing, groupId })}
                  options={budgetGroups.map((g) => ({
                    label: g.name,
                    value: g.id,
                  }))}
                  placeholder="Add a group first"
                  value={editing.groupId}
                />
                {submitted && !editing.groupId && (
                  <span className="field-error">Choose a group</span>
                )}
              </label>
            </div>
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
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              {editing.id && (
                <Button
                  disabled={saving}
                  kind="danger"
                  onClick={() => {
                    const { id } = editing;
                    if (id) void run(() => deleteBudget(id), "Budget deleted");
                  }}
                >
                  Delete
                </Button>
              )}
              <Button kind="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button disabled={saving} type="submit">
                {saving ? "Saving..." : "Save Budget"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
