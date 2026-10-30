"use client";

import type {
  CategoryGroupInterface,
  CategoryInterface,
  TransactionType,
} from "@fynlo/types";

import { Button } from "@fynlo/ui/components/button";
import { Modal } from "@fynlo/ui/components/modal";
import { ArrowLeft, Plus, Tags } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CategoryIcon } from "@/components/CategoryIcon";
import { EmptyState } from "@/components/EmptyState";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { ApiError } from "@/services/api";

import { CategoryForm } from "./components/CategoryForm";
import { CategoryGroupForm } from "./components/CategoryGroupForm";

type Deleting =
  | { category: CategoryInterface; kind: "category" }
  | { group: CategoryGroupInterface; kind: "group" };

export default function PageContent() {
  const {
    budgets,
    categories,
    categoriesStatus,
    categoryGroups,
    deleteCategory,
    deleteCategoryGroup,
    loadCategories,
    transactions,
  } = useFinance();
  const { toast } = useTransactionSheet();
  const [type, setType] = useState<TransactionType>("expense");
  const [categoryForm, setCategoryForm] = useState<null | {
    editing?: CategoryInterface;
    groupId?: string;
  }>(null);
  const [groupForm, setGroupForm] = useState<null | {
    editing?: CategoryGroupInterface;
  }>(null);
  const [deleting, setDeleting] = useState<Deleting | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const groups = categoryGroups.filter((g) => g.type === type);

  // Budgets are still held in the browser, so the server can't see them yet.
  const isInUse = (category: CategoryInterface) =>
    transactions.some((t) => t.categoryId === category.id) ||
    budgets.some((b) => b.categoryId === category.id);

  function closeDelete() {
    setDeleting(null);
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError("");
    setIsDeleting(true);
    try {
      if (deleting.kind === "category") {
        await deleteCategory(deleting.category.id);
        toast("Category deleted");
      } else {
        await deleteCategoryGroup(deleting.group.id);
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
          <h1>Transaction Categories</h1>
          <p>Organize your categories into groups.</p>
        </div>
      </div>

      {categoriesStatus === "error" && (
        <div className="card empty">
          <b>Couldn&apos;t load your categories</b>
          <span>Check your connection and try again.</span>
          <Button kind="secondary" onClick={() => void loadCategories()}>
            Try again
          </Button>
        </div>
      )}
      {categoriesStatus === "loading" && (
        <div className="card empty">
          <span>Loading categories...</span>
        </div>
      )}

      {categoriesStatus === "ready" && (
        <>
          <div aria-label="Category type" className="type-tabs" role="group">
            {(["expense", "income"] as const).map((option) => (
              <button
                aria-pressed={type === option}
                className={type === option ? "active" : undefined}
                key={option}
                onClick={() => setType(option)}
                type="button"
              >
                {option === "expense" ? "Expense" : "Income"}
              </button>
            ))}
          </div>

          <div className="section-heading">
            <div>
              <h2>Groups</h2>
              <p>Every category belongs to one group.</p>
            </div>
            <Button kind="secondary" onClick={() => setGroupForm({})}>
              <Plus aria-hidden="true" size={17} />
              Add Group
            </Button>
          </div>

          {groups.length === 0 && (
            <div className="card">
              <EmptyState
                description="Add a group before adding your first category."
                icon={Tags}
                title="No groups yet"
              />
            </div>
          )}

          {groups.map((group) => (
            <section className="card manage-list category-group" key={group.id}>
              <div className="manage-row category-group-head">
                <div className="manage-copy">
                  <b>{group.name}</b>
                  <span>
                    {group.categoryCount}{" "}
                    {group.categoryCount === 1 ? "category" : "categories"}
                  </span>
                </div>
                <div className="account-actions">
                  <Button
                    kind="ghost"
                    onClick={() => setCategoryForm({ groupId: group.id })}
                  >
                    Add Category
                  </Button>
                  <Button
                    kind="ghost"
                    onClick={() => setGroupForm({ editing: group })}
                  >
                    Rename
                  </Button>
                  <Button
                    disabled={group.categoryCount > 0}
                    kind="ghost"
                    onClick={() => setDeleting({ group, kind: "group" })}
                    title={
                      group.categoryCount > 0
                        ? "Move or delete the categories in this group first"
                        : undefined
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
              {categories
                .filter((c) => c.groupId === group.id)
                .map((category) => (
                  <div className="manage-row" key={category.id}>
                    <div className={`tx-icon cat-${category.icon}`}>
                      <CategoryIcon icon={category.icon} />
                    </div>
                    <div className="manage-copy">
                      <b>{category.name}</b>
                    </div>
                    <div className="account-actions">
                      <Button
                        kind="ghost"
                        onClick={() => setCategoryForm({ editing: category })}
                      >
                        Edit
                      </Button>
                      <Button
                        disabled={isInUse(category)}
                        kind="ghost"
                        onClick={() =>
                          setDeleting({ category, kind: "category" })
                        }
                        title={
                          isInUse(category)
                            ? "Move or delete the transactions and budget using this category first"
                            : undefined
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
            </section>
          ))}
        </>
      )}

      <Modal
        onClose={() => setCategoryForm(null)}
        open={categoryForm !== null}
        title={categoryForm?.editing ? "Edit Category" : "Add Category"}
      >
        {categoryForm && (
          <CategoryForm
            defaultGroupId={categoryForm.groupId}
            editing={categoryForm.editing}
            onCancel={() => setCategoryForm(null)}
            onSaved={(message) => {
              setCategoryForm(null);
              toast(message);
            }}
            type={type}
          />
        )}
      </Modal>

      <Modal
        onClose={() => setGroupForm(null)}
        open={groupForm !== null}
        title={groupForm?.editing ? "Rename Group" : "Add Group"}
      >
        {groupForm && (
          <CategoryGroupForm
            editing={groupForm.editing}
            onCancel={() => setGroupForm(null)}
            onSaved={(message) => {
              setGroupForm(null);
              toast(message);
            }}
            type={type}
          />
        )}
      </Modal>

      <Modal
        onClose={closeDelete}
        open={deleting !== null}
        title={
          deleting?.kind === "group" ? "Delete group?" : "Delete category?"
        }
      >
        <p className="modal-text">
          <b>
            {deleting?.kind === "group"
              ? deleting.group.name
              : deleting?.category.name}
          </b>{" "}
          will no longer be available.
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
                : "Delete Category"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
