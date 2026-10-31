"use client";

import type { BudgetGroupInterface, BudgetPeriodInterface } from "@fynlo/types";

import { Button } from "@fynlo/ui/components/button";
import { Modal } from "@fynlo/ui/components/modal";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { ApiError } from "@/services/api";
import { periodRange } from "@/utils/finance";
import { formatDayShort } from "@/utils/format";

import { BudgetGroupForm } from "./components/BudgetGroupForm";
import { BudgetPeriodForm } from "./components/BudgetPeriodForm";

type Deleting =
  | { group: BudgetGroupInterface; kind: "group" }
  | { kind: "period"; period: BudgetPeriodInterface };

const countLabel = (count: number) =>
  `${count} ${count === 1 ? "budget" : "budgets"}`;

export default function PageContent() {
  const {
    budgetGroups,
    budgetPeriods,
    budgets,
    budgetsStatus,
    deleteBudgetGroup,
    deleteBudgetPeriod,
    loadBudgets,
  } = useFinance();
  const { toast } = useTransactionSheet();
  const [periodForm, setPeriodForm] = useState<null | {
    editing?: BudgetPeriodInterface;
  }>(null);
  const [groupForm, setGroupForm] = useState<null | {
    editing?: BudgetGroupInterface;
  }>(null);
  const [deleting, setDeleting] = useState<Deleting | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  function closeDelete() {
    setDeleting(null);
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError("");
    setIsDeleting(true);
    try {
      if (deleting.kind === "period") {
        await deleteBudgetPeriod(deleting.period.id);
        toast("Period deleted");
      } else {
        await deleteBudgetGroup(deleting.group.id);
        toast("Group deleted");
      }
      closeDelete();
    } catch (error) {
      setDeleteError(
        error instanceof ApiError ? error.message : "Please try again.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="page settings-page">
      <Link className="btn ghost back-link" href="/settings">
        <ArrowLeft aria-hidden="true" size={15} />
        Settings
      </Link>
      <div className="page-intro">
        <div>
          <h1>Budget Periods & Groups</h1>
          <p>Decide when budgets reset and how they are organized.</p>
        </div>
      </div>

      {budgetsStatus === "error" && (
        <div className="card empty">
          <b>Couldn&apos;t load your budget setup</b>
          <span>Check your connection and try again.</span>
          <Button kind="secondary" onClick={() => void loadBudgets()}>
            Try again
          </Button>
        </div>
      )}
      {budgetsStatus === "loading" && (
        <div className="card empty">
          <span>Loading...</span>
        </div>
      )}

      {budgetsStatus === "ready" && (
        <>
          <div className="section-heading">
            <div>
              <h2>Periods</h2>
              <p>Spending is counted within the period&apos;s current dates.</p>
            </div>
            <Button kind="secondary" onClick={() => setPeriodForm({})}>
              <Plus aria-hidden="true" size={17} />
              Add Period
            </Button>
          </div>
          <div className="card manage-list">
            {budgetPeriods.map((period) => {
              const count = budgets.filter(
                (b) => b.periodId === period.id,
              ).length;
              return (
                <div className="manage-row" key={period.id}>
                  <div className="manage-copy">
                    <b>{period.name}</b>
                    <span>
                      {describe(period)} · {countLabel(count)}
                    </span>
                  </div>
                  <div className="account-actions">
                    <Button
                      kind="ghost"
                      onClick={() => setPeriodForm({ editing: period })}
                    >
                      Edit
                    </Button>
                    <Button
                      disabled={count > 0}
                      kind="ghost"
                      onClick={() => setDeleting({ kind: "period", period })}
                      title={
                        count > 0
                          ? "Move or delete the budgets in this period first"
                          : undefined
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="section-heading">
            <div>
              <h2>Groups</h2>
              <p>Budgets on the Budgets page are listed under these groups.</p>
            </div>
            <Button kind="secondary" onClick={() => setGroupForm({})}>
              <Plus aria-hidden="true" size={17} />
              Add Group
            </Button>
          </div>
          <div className="card manage-list">
            {budgetGroups.map((group) => {
              const count = budgets.filter(
                (b) => b.groupId === group.id,
              ).length;
              return (
                <div className="manage-row" key={group.id}>
                  <div className="manage-copy">
                    <b>{group.name}</b>
                    <span>{countLabel(count)}</span>
                  </div>
                  <div className="account-actions">
                    <Button
                      kind="ghost"
                      onClick={() => setGroupForm({ editing: group })}
                    >
                      Rename
                    </Button>
                    <Button
                      disabled={count > 0}
                      kind="ghost"
                      onClick={() => setDeleting({ group, kind: "group" })}
                      title={
                        count > 0
                          ? "Move or delete the budgets in this group first"
                          : undefined
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Modal
        onClose={() => setPeriodForm(null)}
        open={periodForm !== null}
        title={periodForm?.editing ? "Edit Period" : "Add Period"}
      >
        {periodForm && (
          <BudgetPeriodForm
            editing={periodForm.editing}
            onCancel={() => setPeriodForm(null)}
            onSaved={(message) => {
              setPeriodForm(null);
              toast(message);
            }}
          />
        )}
      </Modal>

      <Modal
        onClose={() => setGroupForm(null)}
        open={groupForm !== null}
        title={groupForm?.editing ? "Rename Group" : "Add Group"}
      >
        {groupForm && (
          <BudgetGroupForm
            editing={groupForm.editing}
            onCancel={() => setGroupForm(null)}
            onSaved={(message) => {
              setGroupForm(null);
              toast(message);
            }}
          />
        )}
      </Modal>

      <Modal
        onClose={closeDelete}
        open={deleting !== null}
        title={deleting?.kind === "group" ? "Delete group?" : "Delete period?"}
      >
        <p className="modal-text">
          <b>
            {deleting?.kind === "group"
              ? deleting.group.name
              : deleting?.period.name}
          </b>{" "}
          will no longer be available for your budgets.
        </p>
        {deleteError && (
          <p className="field-error" role="alert">
            {deleteError}
          </p>
        )}
        <div className="modal-actions">
          <Button kind="secondary" onClick={closeDelete}>
            Cancel
          </Button>
          <Button
            disabled={isDeleting}
            kind="danger"
            onClick={() => void confirmDelete()}
          >
            {isDeleting
              ? "Deleting..."
              : deleting?.kind === "group"
                ? "Delete Group"
                : "Delete Period"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function describe(period: BudgetPeriodInterface) {
  const { from, to } = periodRange(period);
  const dates = `${formatDayShort(from)} – ${formatDayShort(to)}`;
  if (period.unit === "once") return `Once · ${dates}`;
  const every =
    period.intervalCount === 1
      ? `Every ${period.unit}`
      : `Every ${period.intervalCount} ${period.unit}s`;
  return `${every} · now ${dates}`;
}
