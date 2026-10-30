"use client";

import type { AccountInterface, AccountTypeInterface } from "@fynlo/types";

import { Badge } from "@fynlo/ui/components/badge";
import { Button } from "@fynlo/ui/components/button";
import { Modal } from "@fynlo/ui/components/modal";
import { ArrowLeft, Plus, Tags, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AccountForm } from "@/components/AccountForm";
import { EmptyState } from "@/components/EmptyState";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { ApiError } from "@/services/api";
import { accountBalance } from "@/utils/finance";
import { formatRupiah } from "@/utils/format";

import { AccountTypeForm } from "./components/AccountTypeForm";

type Deleting =
  | { account: AccountInterface; kind: "account" }
  | { kind: "type"; type: AccountTypeInterface };

const errorText = (error: unknown) =>
  error instanceof ApiError ? error.message : "Please try again.";

export default function PageContent() {
  const {
    accounts,
    accountsStatus,
    accountTypes,
    deleteAccount,
    deleteAccountType,
    loadAccounts,
    transactions,
    updateAccount,
  } = useFinance();
  const { toast } = useTransactionSheet();
  const [accountForm, setAccountForm] = useState<null | {
    editing?: AccountInterface;
  }>(null);
  const [typeForm, setTypeForm] = useState<null | {
    editing?: AccountTypeInterface;
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
      if (deleting.kind === "account") {
        await deleteAccount(deleting.account.id);
        toast("Account deleted");
      } else {
        await deleteAccountType(deleting.type.id);
        toast("Account type deleted");
      }
      closeDelete();
    } catch (error) {
      setDeleteError(errorText(error));
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
          <h1>Accounts & Types</h1>
          <p>Add, edit, and organize your accounts and their types.</p>
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

      {accountsStatus === "ready" && (
        <>
          <div className="section-heading">
            <div>
              <h2>Accounts</h2>
              <p>Excluded accounts stay here but don&apos;t count in totals.</p>
            </div>
            <Button onClick={() => setAccountForm({})}>
              <Plus aria-hidden="true" size={17} />
              Add Account
            </Button>
          </div>
          {accounts.length === 0 ? (
            <div className="card">
              <EmptyState
                description="Add your first account to start tracking balances."
                icon={Wallet}
                title="No accounts yet"
              />
            </div>
          ) : (
            <div className="card manage-list">
              {accounts.map((account) => (
                <div className="manage-row" key={account.id}>
                  <div
                    className="bank-logo"
                    style={{ background: account.color }}
                  >
                    {account.name[0]}
                  </div>
                  <div className="manage-copy">
                    <b>{account.name}</b>
                    <span>
                      {account.typeName}
                      {account.mask && ` •• ${account.mask}`}
                    </span>
                  </div>
                  {account.isExcluded && <Badge>Excluded</Badge>}
                  <strong>
                    {formatRupiah(accountBalance(account, transactions))}
                  </strong>
                  <div className="account-actions">
                    <Button
                      kind="ghost"
                      onClick={() => {
                        updateAccount(account.id, {
                          isExcluded: !account.isExcluded,
                        }).catch((error: unknown) =>
                          toast(errorText(error), true),
                        );
                      }}
                    >
                      {account.isExcluded ? "Include" : "Exclude"}
                    </Button>
                    <Button
                      kind="ghost"
                      onClick={() => setAccountForm({ editing: account })}
                    >
                      Edit
                    </Button>
                    <Button
                      kind="ghost"
                      onClick={() => setDeleting({ account, kind: "account" })}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="section-heading">
            <div>
              <h2>Account Types</h2>
              <p>Group your accounts, for example by bank or credit card.</p>
            </div>
            <Button kind="secondary" onClick={() => setTypeForm({})}>
              <Plus aria-hidden="true" size={17} />
              Add Type
            </Button>
          </div>
          {accountTypes.length === 0 ? (
            <div className="card">
              <EmptyState
                description="Add a type before adding your first account."
                icon={Tags}
                title="No account types yet"
              />
            </div>
          ) : (
            <div className="card manage-list">
              {accountTypes.map((type) => (
                <div className="manage-row" key={type.id}>
                  <div className="manage-copy">
                    <b>{type.name}</b>
                    <span>
                      {type.accountCount}{" "}
                      {type.accountCount === 1 ? "account" : "accounts"}
                    </span>
                  </div>
                  <div className="account-actions">
                    <Button
                      kind="ghost"
                      onClick={() => setTypeForm({ editing: type })}
                    >
                      Rename
                    </Button>
                    <Button
                      disabled={type.accountCount > 0}
                      kind="ghost"
                      onClick={() => setDeleting({ kind: "type", type })}
                      title={
                        type.accountCount > 0
                          ? "Move or delete the accounts using this type first"
                          : undefined
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        onClose={() => setAccountForm(null)}
        open={accountForm !== null}
        title={accountForm?.editing ? "Edit Account" : "Add Account"}
      >
        {accountForm && (
          <AccountForm
            editing={accountForm.editing}
            onCancel={() => setAccountForm(null)}
            onSaved={(message) => {
              setAccountForm(null);
              toast(message);
            }}
          />
        )}
      </Modal>

      <Modal
        onClose={() => setTypeForm(null)}
        open={typeForm !== null}
        title={typeForm?.editing ? "Rename Type" : "Add Type"}
      >
        {typeForm && (
          <AccountTypeForm
            editing={typeForm.editing}
            onCancel={() => setTypeForm(null)}
            onSaved={(message) => {
              setTypeForm(null);
              toast(message);
            }}
          />
        )}
      </Modal>

      <Modal
        onClose={closeDelete}
        open={deleting !== null}
        title={deleting?.kind === "type" ? "Delete type?" : "Delete account?"}
      >
        <p className="modal-text">
          {deleting?.kind === "type" ? (
            <>
              <b>{deleting.type.name}</b> will no longer be available for your
              accounts.
            </>
          ) : (
            <>
              <b>{deleting?.account.name}</b> will disappear from your accounts
              and totals.
            </>
          )}
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
              : deleting?.kind === "type"
                ? "Delete Type"
                : "Delete Account"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
