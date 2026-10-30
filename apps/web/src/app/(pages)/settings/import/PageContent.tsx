"use client";

import type { StatementPreviewInterface } from "@fynlo/types";

import { Badge } from "@fynlo/ui/components/badge";
import { Button } from "@fynlo/ui/components/button";
import { Select } from "@fynlo/ui/components/select";
import { ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { statementBanks } from "@/constants";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { ApiError, previewStatementRequest } from "@/services/api";
import { categoryOptions } from "@/utils/category-options";
import { accountLabel } from "@/utils/finance";
import { formatDayShort, formatRupiah } from "@/utils/format";

const errorText = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";

export default function PageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { accounts, accountsStatus, categories, importStatement } =
    useFinance();
  const { toast } = useTransactionSheet();
  const [chosenAccountId, setAccountId] = useState(
    params.get("accountId") ?? "",
  );
  const [bank, setBank] = useState(statementBanks[0]?.value ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<null | StatementPreviewInterface>(
    null,
  );
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [chosenCategories, setChosenCategories] = useState<
    Record<number, string>
  >({});
  const [setOpening, setSetOpening] = useState(false);

  const accountId = chosenAccountId || (accounts[0]?.id ?? "");
  const account = accounts.find((a) => a.id === accountId);
  const selected = (preview?.rows ?? [])
    .map((row, index) => ({
      ...row,
      categoryId: chosenCategories[index] ?? row.categoryId,
      index,
    }))
    .filter((row) => !excluded.has(row.index));
  const income = selected
    .filter((row) => row.type === "income")
    .reduce((sum, row) => sum + row.amount, 0);
  const expense = selected
    .filter((row) => row.type === "expense")
    .reduce((sum, row) => sum + row.amount, 0);

  async function read(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!file || !accountId) return;
    setError("");
    setBusy(true);
    try {
      const result = await previewStatementRequest({
        accountId,
        bank,
        file,
        password,
      });
      setPreview(result);
      setExcluded(
        new Set(
          result.rows.flatMap((row, index) => (row.isDuplicate ? [index] : [])),
        ),
      );
      setChosenCategories({});
      setSetOpening(result.canSetOpeningBalance);
      setPassword("");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!preview || selected.length === 0) return;
    setError("");
    setBusy(true);
    try {
      await importStatement({
        accountId,
        openingBalance: setOpening ? preview.openingBalance : null,
        rows: selected.map((row) => ({
          amount: row.amount,
          categoryId: row.categoryId,
          date: row.date,
          detail: row.detail,
          name: row.name,
          time: row.time,
          type: row.type,
        })),
      });
      toast(`${selected.length} transactions imported`);
      router.push("/transactions");
    } catch (caught) {
      setError(errorText(caught));
      setBusy(false);
    }
  }

  function toggle(index: number) {
    const next = new Set(excluded);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setExcluded(next);
  }

  return (
    <div className="page settings-page">
      <Link className="btn ghost back-link" href="/settings/accounts">
        <ArrowLeft aria-hidden="true" size={15} />
        Accounts
      </Link>
      <div className="page-intro">
        <div>
          <h1>Import Statement</h1>
          <p>Add past transactions from a bank statement PDF.</p>
        </div>
      </div>

      {!preview ? (
        <form className="card import-form" noValidate onSubmit={read}>
          <div className="form-grid">
            <label>
              Account
              <Select
                onChange={setAccountId}
                options={accounts.map((a) => ({
                  label: accountLabel(a),
                  value: a.id,
                }))}
                placeholder="Add an account first"
                value={accountId}
              />
              {submitted && !accountId && (
                <span className="field-error">Add an account first</span>
              )}
            </label>
            <label>
              Bank
              <Select
                onChange={setBank}
                options={statementBanks}
                value={bank}
              />
            </label>
          </div>
          <label>
            Statement PDF
            <input
              accept="application/pdf,.pdf"
              className="file-input"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            {submitted && !file && (
              <span className="field-error">Choose a PDF file</span>
            )}
          </label>
          <label>
            PDF password (if locked)
            <input
              autoComplete="off"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <p className="import-note">
            The file and password are used only to read this statement. Neither
            is saved.
          </p>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button
              disabled={busy || accountsStatus === "loading"}
              type="submit"
            >
              {busy ? "Reading..." : "Read Statement"}
            </Button>
          </div>
        </form>
      ) : (
        <>
          {preview.isDifferentAccount && (
            <div className="notice">
              <Info aria-hidden="true" size={20} />
              <div>
                <b>This may be a different account</b>
                <span>
                  The statement ends in {preview.accountMask}, but{" "}
                  {account?.name} ends in {account?.mask}.
                </span>
              </div>
            </div>
          )}

          <div className="card import-summary">
            <div>
              <span>Selected</span>
              <b>
                {selected.length} of {preview.rows.length}
              </b>
            </div>
            <div>
              <span>Income</span>
              <b>{formatRupiah(income)}</b>
            </div>
            <div>
              <span>Expenses</span>
              <b>{formatRupiah(expense)}</b>
            </div>
            <div>
              <span>Statement closing balance</span>
              <b>{formatRupiah(preview.closingBalance)}</b>
            </div>
          </div>

          {preview.canSetOpeningBalance && (
            <label className="checkbox-field">
              <input
                checked={setOpening}
                onChange={(event) => setSetOpening(event.target.checked)}
                type="checkbox"
              />
              Set this account&apos;s opening balance to{" "}
              {formatRupiah(preview.openingBalance)}, the balance before this
              statement
            </label>
          )}

          <div className="card manage-list">
            {preview.rows.map((row, index) => (
              <div className="manage-row import-row" key={index}>
                <input
                  aria-label={`Import ${row.name}`}
                  checked={!excluded.has(index)}
                  onChange={() => toggle(index)}
                  type="checkbox"
                />
                <div className="manage-copy">
                  <b>{row.name}</b>
                  <span>
                    {formatDayShort(row.date)}, {row.time.slice(0, 5)}
                    {row.detail && ` · ${row.detail}`}
                  </span>
                </div>
                {row.isDuplicate && (
                  <Badge tone="warning">Possible duplicate</Badge>
                )}
                <div className="import-category">
                  <Select
                    aria-label={`Category for ${row.name}`}
                    onChange={(value) =>
                      setChosenCategories((current) => ({
                        ...current,
                        [index]: value,
                      }))
                    }
                    options={categoryOptions(
                      categories.filter((c) => c.type === row.type),
                    )}
                    placeholder="Uncategorized"
                    value={chosenCategories[index] ?? row.categoryId ?? ""}
                  />
                </div>
                <strong className={row.type === "income" ? "positive" : ""}>
                  {formatRupiah(
                    row.type === "income" ? row.amount : -row.amount,
                  )}
                </strong>
              </div>
            ))}
          </div>

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button
              kind="secondary"
              onClick={() => {
                setPreview(null);
                setError("");
              }}
            >
              Back
            </Button>
            <Button
              disabled={busy || selected.length === 0}
              onClick={() => void save()}
            >
              {busy ? "Importing..." : `Import ${selected.length} Transactions`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
