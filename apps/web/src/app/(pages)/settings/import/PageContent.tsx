"use client";

import type {
  AccountInterface,
  StatementPreviewInterface,
  StatementSectionInterface,
} from "@fynlo/types";

import { Badge } from "@fynlo/ui/components/badge";
import { Button } from "@fynlo/ui/components/button";
import { Modal } from "@fynlo/ui/components/modal";
import { Select } from "@fynlo/ui/components/select";
import { ArrowLeft, ChevronDown, Info, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { AccountForm } from "@/components/AccountForm";
import { statementBanks } from "@/constants";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { ApiError, previewStatementRequest } from "@/services/api";
import { categoryOptions } from "@/utils/category-options";
import { accountLabel } from "@/utils/finance";
import { formatDayShort, formatRupiah } from "@/utils/format";
import { mergeStatements, type StatementGap } from "@/utils/statement-merge";

// Marks a dropdown value as the other side of a transfer, not a category.
const TRANSFER = "transfer:";
const SKIP = "skip";
const SINGLE_SECTION = "main";
const MAX_FILES = 12;

interface FileResult {
  count?: number;
  error?: string;
  name: string;
}

const errorText = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";

const fileHash = async (file: File) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
  ).join();

const rowKey = (section: StatementSectionInterface, index: number) =>
  `${section.key}:${index}`;

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
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<null | {
    done: number;
    name: string;
    total: number;
  }>(null);
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [gaps, setGaps] = useState<StatementGap[]>([]);
  const [mismatchedKeys, setMismatchedKeys] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pockets, setPockets] = useState<null | StatementSectionInterface[]>(
    null,
  );
  const [pocketAccounts, setPocketAccounts] = useState<Record<string, string>>(
    {},
  );
  const [creatingFor, setCreatingFor] =
    useState<null | StatementSectionInterface>(null);
  const [preview, setPreview] = useState<null | StatementPreviewInterface>(
    null,
  );
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [chosenCategories, setChosenCategories] = useState<
    Record<string, string>
  >({});
  const [openingKeys, setOpeningKeys] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const hasPockets =
    statementBanks.find((b) => b.value === bank)?.hasPockets ?? false;
  const accountId = chosenAccountId || (accounts[0]?.id ?? "");
  const sections = (preview?.sections ?? []).filter((s) => s.accountId);

  const rowsOf = (section: StatementSectionInterface) =>
    section.rows.flatMap((row, index) => {
      if (row.isMirror) return [];
      const key = rowKey(section, index);
      const choice =
        chosenCategories[key] ??
        (row.transferAccountId
          ? `${TRANSFER}${row.transferAccountId}`
          : row.categoryId);
      const isTransfer = choice?.startsWith(TRANSFER) ?? false;
      return [
        {
          ...row,
          categoryId: isTransfer ? null : choice,
          choice,
          key,
          transferAccountId: isTransfer
            ? (choice as string).slice(TRANSFER.length)
            : null,
        },
      ];
    });
  const allRows = sections.flatMap(rowsOf);
  const selected = allRows.filter((row) => !excluded.has(row.key));
  const income = selected
    .filter((row) => row.type === "income" && !row.transferAccountId)
    .reduce((sum, row) => sum + row.amount, 0);
  const expense = selected
    .filter((row) => row.type === "expense" && !row.transferAccountId)
    .reduce((sum, row) => sum + row.amount, 0);
  const mappedIds = Object.values(pocketAccounts).filter((id) => id !== SKIP);
  const hasRepeatedAccount = new Set(mappedIds).size !== mappedIds.length;

  /** Sends one file at a time, for real progress and to keep the server's memory low. */
  async function readFiles(chosen: Record<string, string>) {
    const results: FileResult[] = [];
    const statements: { name: string; preview: StatementPreviewInterface }[] =
      [];
    const hashes = new Map<string, string>();
    for (const [index, file] of files.entries()) {
      setProgress({ done: index, name: file.name, total: files.length });
      const hash = await fileHash(file);
      const original = hashes.get(hash);
      if (original) {
        results.push({
          error: `Same file as ${original}, skipped`,
          name: file.name,
        });
        continue;
      }
      hashes.set(hash, file.name);
      try {
        const result = await previewStatementRequest({
          accounts: chosen,
          bank,
          file,
          password,
        });
        statements.push({ name: file.name, preview: result });
        results.push({
          count: result.sections.reduce(
            (sum, section) => sum + section.rows.length,
            0,
          ),
          name: file.name,
        });
      } catch (caught) {
        results.push({ error: errorText(caught), name: file.name });
      }
    }
    setProgress(null);
    setFileResults(results);
    return { results, statements };
  }

  async function loadPreview(chosen: Record<string, string>) {
    setError("");
    setBusy(true);
    const { results, statements } = await readFiles(chosen);
    setBusy(false);
    if (statements.length === 0) {
      setError(results[0]?.error ?? "No statement could be read");
      return;
    }
    const merged = mergeStatements(statements);
    const chosenSections = merged.preview.sections.filter((s) => s.accountId);
    setPreview(merged.preview);
    setGaps(merged.gaps);
    setMismatchedKeys(merged.mismatchedKeys);
    setExcluded(
      new Set(
        chosenSections.flatMap((section) =>
          section.rows.flatMap((row, index) =>
            row.isDuplicate ? [rowKey(section, index)] : [],
          ),
        ),
      ),
    );
    setChosenCategories({});
    // A long statement stays scannable: only the first pocket starts open.
    setCollapsed(new Set(chosenSections.slice(1).map((s) => s.key)));
    setOpeningKeys(
      new Set(
        chosenSections.filter((s) => s.canSetOpeningBalance).map((s) => s.key),
      ),
    );
  }

  async function read(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (files.length === 0 || files.length > MAX_FILES) return;
    if (!hasPockets) {
      if (accountId) await loadPreview({ [SINGLE_SECTION]: accountId });
      return;
    }
    setError("");
    setBusy(true);
    const { results, statements } = await readFiles({});
    setBusy(false);
    if (statements.length === 0) {
      setError(results[0]?.error ?? "No statement could be read");
      return;
    }
    const active = mergeStatements(statements).preview.sections.filter(
      (s) => s.rows.length > 0,
    );
    setPockets(active);
    setPocketAccounts(
      Object.fromEntries(
        active.map((s) => [s.key, s.suggestedAccountId ?? SKIP]),
      ),
    );
  }

  async function save() {
    if (selected.length === 0) return;
    setError("");
    setBusy(true);
    try {
      await importStatement({
        sections: sections.map((section) => ({
          accountId: section.accountId as string,
          openingBalance: openingKeys.has(section.key)
            ? section.openingBalance
            : null,
          rows: rowsOf(section)
            .filter((row) => !excluded.has(row.key))
            .map((row) => ({
              amount: row.amount,
              categoryId: row.categoryId,
              date: row.date,
              detail: row.detail,
              name: row.name,
              time: row.time,
              transferAccountId: row.transferAccountId,
              type: row.type,
            })),
        })),
      });
      toast(`${selected.length} transactions imported`);
      router.push("/transactions");
    } catch (caught) {
      setError(errorText(caught));
      setBusy(false);
    }
  }

  function toggle(key: string) {
    const next = new Set(excluded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExcluded(next);
  }

  function toggleSection(key: string) {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCollapsed(next);
  }

  function toggleOpening(key: string) {
    const next = new Set(openingKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpeningKeys(next);
  }

  const fileList = fileResults.length > 1 && (
    <div className="card manage-list import-files">
      {fileResults.map((result) => (
        <div className="manage-row" key={result.name}>
          <div className="manage-copy">
            <b>{result.name}</b>
            <span>
              {result.error ??
                `${result.count} ${result.count === 1 ? "transaction" : "transactions"}`}
            </span>
          </div>
          <Badge tone={result.error ? "warning" : "success"}>
            {result.error ? "Not included" : "Read"}
          </Badge>
        </div>
      ))}
    </div>
  );

  const progressBar = progress && (
    <div className="import-progress">
      <span>
        Reading {progress.done + 1} of {progress.total}: {progress.name}
      </span>
      <div
        aria-label="Reading statements"
        aria-valuemax={progress.total}
        aria-valuemin={0}
        aria-valuenow={progress.done}
        className="progress"
        role="progressbar"
      >
        <i style={{ width: `${(progress.done / progress.total) * 100}%` }} />
      </div>
    </div>
  );

  const accountById = (id: null | string): AccountInterface | undefined =>
    accounts.find((a) => a.id === id);

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

      {!pockets && !preview && (
        <form className="card import-form" noValidate onSubmit={read}>
          <div className="form-grid">
            <label>
              Bank
              <Select
                onChange={setBank}
                options={statementBanks}
                value={bank}
              />
            </label>
            {!hasPockets && (
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
            )}
          </div>
          <label>
            Statement PDFs
            <input
              accept="application/pdf,.pdf"
              className="file-input"
              multiple
              onChange={(event) =>
                setFiles(Array.from(event.target.files ?? []))
              }
              type="file"
            />
            {submitted && files.length === 0 && (
              <span className="field-error">Choose a PDF file</span>
            )}
            {files.length > MAX_FILES && (
              <span className="field-error">
                Choose at most {MAX_FILES} files at once
              </span>
            )}
          </label>
          <label>
            PDF password (if locked, the same for all files)
            <input
              autoComplete="off"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <p className="import-note">
            Files and the password are used only to read these statements.
            Neither is saved.
          </p>
          {progressBar}
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
      )}

      {pockets && !preview && (
        <>
          {fileList}
          <div className="section-heading">
            <div>
              <h2>Choose an account for each pocket</h2>
              <p>Moves between chosen pockets are saved as one transfer.</p>
            </div>
          </div>
          <div className="card">
            {pockets.length === 0 && (
              <div className="empty">
                <span>This statement has no transactions.</span>
              </div>
            )}
            {pockets.map((pocket) => (
              <div className="import-map-row" key={pocket.key}>
                <div className="manage-copy">
                  <b>{pocket.name}</b>
                  <span>
                    {pocket.rows.length}{" "}
                    {pocket.rows.length === 1 ? "transaction" : "transactions"}
                  </span>
                </div>
                <div className="import-map-select">
                  <Select
                    aria-label={`Account for ${pocket.name}`}
                    onChange={(value) =>
                      setPocketAccounts((current) => ({
                        ...current,
                        [pocket.key]: value,
                      }))
                    }
                    options={[
                      { label: "Skip this pocket", value: SKIP },
                      ...accounts.map((a) => ({
                        label: accountLabel(a),
                        value: a.id,
                      })),
                    ]}
                    value={pocketAccounts[pocket.key] ?? SKIP}
                  />
                </div>
                <Button kind="ghost" onClick={() => setCreatingFor(pocket)}>
                  <Plus aria-hidden="true" size={15} />
                  New Account
                </Button>
              </div>
            ))}
          </div>
          {progressBar}
          {hasRepeatedAccount && (
            <p className="field-error" role="alert">
              Choose a different account for each pocket
            </p>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button
              kind="secondary"
              onClick={() => {
                setPockets(null);
                setError("");
              }}
            >
              Back
            </Button>
            <Button
              disabled={busy || mappedIds.length === 0 || hasRepeatedAccount}
              onClick={() =>
                void loadPreview(
                  Object.fromEntries(
                    Object.entries(pocketAccounts).filter(
                      ([, id]) => id !== SKIP,
                    ),
                  ),
                )
              }
            >
              {busy ? "Reading..." : "Continue"}
            </Button>
          </div>
        </>
      )}

      {preview && (
        <>
          {fileList}
          {gaps.map((gap) => (
            <div className="notice" key={`${gap.sectionKey}${gap.to}`}>
              <Info aria-hidden="true" size={20} />
              <div>
                <b>A statement may be missing</b>
                <span>
                  {gap.from} ends at {formatRupiah(gap.fromBalance)}, but{" "}
                  {gap.to} starts at {formatRupiah(gap.toBalance)}.
                </span>
              </div>
            </div>
          ))}
          <div className="card import-summary">
            <div>
              <span>Selected</span>
              <b>
                {selected.length} of {allRows.length}
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
              <span>Transfers</span>
              <b>{selected.filter((r) => r.transferAccountId).length}</b>
            </div>
          </div>

          {sections.map((section) => {
            const account = accountById(section.accountId);
            const others = accounts.filter((a) => a.id !== section.accountId);
            const rows = rowsOf(section);
            const isCollapsed = collapsed.has(section.key);
            const chosenCount = rows.filter(
              (row) => !excluded.has(row.key),
            ).length;
            return (
              <section className="import-section" key={section.key}>
                <button
                  aria-expanded={!isCollapsed}
                  className="import-section-toggle"
                  onClick={() => toggleSection(section.key)}
                  type="button"
                >
                  <span>
                    <b>{accountLabel(account)}</b>
                    <small>
                      Statement closing balance{" "}
                      {formatRupiah(section.closingBalance)}
                    </small>
                  </span>
                  <Badge>
                    {chosenCount} of {rows.length} selected
                  </Badge>
                  <ChevronDown aria-hidden="true" size={18} />
                </button>
                <div hidden={isCollapsed}>
                  {mismatchedKeys.includes(section.key) && (
                    <div className="notice mb-4">
                      <Info aria-hidden="true" size={20} />
                      <div>
                        <b>These files show different account numbers</b>
                        <span>Check that they all belong to this account.</span>
                      </div>
                    </div>
                  )}
                  {section.isDifferentAccount && (
                    <div className="notice mb-4">
                      <Info aria-hidden="true" size={20} />
                      <div>
                        <b>This may be a different account</b>
                        <span>
                          The statement ends in {section.accountMask}, but{" "}
                          {account?.name} ends in {account?.mask}.
                        </span>
                      </div>
                    </div>
                  )}
                  {section.canSetOpeningBalance && (
                    <label className="import-opening">
                      <input
                        checked={openingKeys.has(section.key)}
                        onChange={() => toggleOpening(section.key)}
                        type="checkbox"
                      />
                      <span>
                        <b>Use as opening balance</b>
                        <small>
                          {formatRupiah(section.openingBalance)}, the balance
                          before this statement
                        </small>
                      </span>
                    </label>
                  )}
                  <div className="card manage-list">
                    {rows.length === 0 && (
                      <div className="empty">
                        <span>
                          Every transaction here is a transfer shown under the
                          other account.
                        </span>
                      </div>
                    )}
                    {rows.map((row) => (
                      <div className="manage-row import-row" key={row.key}>
                        <input
                          aria-label={`Import ${row.name}`}
                          checked={!excluded.has(row.key)}
                          onChange={() => toggle(row.key)}
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
                        {row.isPossibleTransfer &&
                          !row.transferAccountId &&
                          !chosenCategories[row.key] &&
                          others.length > 0 && <Badge>Possible transfer</Badge>}
                        <div className="import-category">
                          <Select
                            aria-label={`Category for ${row.name}`}
                            onChange={(value) =>
                              setChosenCategories((current) => ({
                                ...current,
                                [row.key]: value,
                              }))
                            }
                            options={[
                              ...categoryOptions(
                                categories.filter((c) => c.type === row.type),
                              ),
                              ...others.map((a) => ({
                                group:
                                  row.type === "income"
                                    ? "Transfer from"
                                    : "Transfer to",
                                label: accountLabel(a),
                                value: `${TRANSFER}${a.id}`,
                              })),
                            ]}
                            placeholder="Uncategorized"
                            value={row.choice ?? ""}
                          />
                        </div>
                        <strong
                          className={row.type === "income" ? "positive" : ""}
                        >
                          {formatRupiah(
                            row.type === "income" ? row.amount : -row.amount,
                          )}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          })}

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

      <Modal
        onClose={() => setCreatingFor(null)}
        open={creatingFor !== null}
        title="Add Account"
      >
        {creatingFor && (
          <AccountForm
            defaultMask={creatingFor.accountMask}
            defaultName={creatingFor.name}
            onCancel={() => setCreatingFor(null)}
            onSaved={(message, created) => {
              const pocket = creatingFor;
              setCreatingFor(null);
              toast(message);
              if (created) {
                setPocketAccounts((current) => ({
                  ...current,
                  [pocket.key]: created.id,
                }));
              }
            }}
          />
        )}
      </Modal>
    </div>
  );
}
