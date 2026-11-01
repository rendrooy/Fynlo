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
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  ChevronDown,
  CircleAlert,
  Info,
  Plus,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { AccountForm } from "@/components/AccountForm";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { ApiError, previewStatementRequest } from "@/services/api";
import { categoryOptions } from "@/utils/category-options";
import { accountBalance, accountLabel } from "@/utils/finance";
import { formatDayShort, formatRupiah } from "@/utils/format";
import { balancesAfterImport, hasOtherSide } from "@/utils/statement-check";
import {
  linkBankTransfers,
  mergeStatements,
  type StatementBreak,
  type StatementGap,
  type StatementTotalsNote,
} from "@/utils/statement-merge";

// Marks a dropdown value as the other side of a transfer, not a category.
const TRANSFER = "transfer:";
const SKIP = "skip";
const MAX_FILES = 12;
const STEPS = ["Choose files", "Match accounts", "Review"];

interface FileResult {
  bank?: string;
  count?: number;
  error?: string;
  isLocked?: boolean;
  name: string;
}

interface StatementFile {
  name: string;
  preview: StatementPreviewInterface;
}

const isPasswordError = (error: unknown) =>
  error instanceof ApiError &&
  error.status === 400 &&
  /password/i.test(error.message);

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
  const {
    accounts,
    accountsStatus,
    categories,
    importStatement,
    transactions,
  } = useFinance();
  const { toast } = useTransactionSheet();
  const [files, setFiles] = useState<File[]>([]);
  const [filePasswords, setFilePasswords] = useState<Record<string, string>>(
    {},
  );
  // What the last read found, while some files still wait for a password.
  const [readSoFar, setReadSoFar] = useState<StatementFile[]>([]);
  const [lockedFiles, setLockedFiles] = useState<FileResult[]>([]);
  const [leftOut, setLeftOut] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<null | {
    done: number;
    name: string;
    total: number;
  }>(null);
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [breaks, setBreaks] = useState<StatementBreak[]>([]);
  const [gaps, setGaps] = useState<StatementGap[]>([]);
  const [totalsNotes, setTotalsNotes] = useState<StatementTotalsNote[]>([]);
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
  const [idleKeys, setIdleKeys] = useState<Set<string>>(new Set());
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
  // Bank transfers found automatically that the user says aren't transfers.
  const [unpaired, setUnpaired] = useState<Set<string>>(new Set());

  const sections = (preview?.sections ?? []).filter((s) => s.accountId);

  const rowsOf = (section: StatementSectionInterface) =>
    section.rows.flatMap((row, index) => {
      const isUnpaired = row.pairKey !== undefined && unpaired.has(row.pairKey);
      if (row.isMirror && !isUnpaired) return [];
      const key = rowKey(section, index);
      const choice =
        chosenCategories[key] ??
        (row.transferAccountId && !isUnpaired
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
  /** The money arrives through the other pocket's row, so it follows that row's choices. */
  const isMirrorIncluded = (
    section: StatementSectionInterface,
    mirror: StatementSectionInterface["rows"][number],
  ) => {
    const source = sections.find(
      (s) => s.accountId === mirror.transferAccountId,
    );
    return (
      source !== undefined &&
      rowsOf(source).some(
        (row) =>
          row.type === "expense" &&
          row.transferAccountId === section.accountId &&
          (mirror.pairKey
            ? row.pairKey === mirror.pairKey
            : row.amount === mirror.amount &&
              row.date === mirror.date &&
              row.time === mirror.time) &&
          !excluded.has(row.key),
      )
    );
  };
  const allRows = sections.flatMap(rowsOf);
  const selected = allRows.filter((row) => !excluded.has(row.key));
  const income = selected
    .filter((row) => row.type === "income" && !row.transferAccountId)
    .reduce((sum, row) => sum + row.amount, 0);
  const expense = selected
    .filter((row) => row.type === "expense" && !row.transferAccountId)
    .reduce((sum, row) => sum + row.amount, 0);
  const balances = balancesAfterImport(sections, rowsOf, excluded, gaps);
  const offBalances = balances.filter((balance) => balance.difference !== 0);
  const mappedIds = Object.values(pocketAccounts).filter((id) => id !== SKIP);
  const hasRepeatedAccount = new Set(mappedIds).size !== mappedIds.length;

  /** Sends one file at a time, for real progress and to keep the server's memory low. */
  async function readFiles(chosen: Record<string, string>) {
    const results: FileResult[] = [];
    const statements: StatementFile[] = [];
    const hashes = new Map<string, string>();
    for (const [index, file] of files.entries()) {
      if (leftOut.has(file.name)) continue;
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
          file,
          password: filePasswords[file.name] || password,
        });
        statements.push({ name: file.name, preview: result });
        results.push({
          bank: result.sections[0]?.bank,
          count: result.sections.reduce(
            (sum, section) => sum + section.rows.length,
            0,
          ),
          name: file.name,
        });
      } catch (caught) {
        results.push({
          error: errorText(caught),
          isLocked: isPasswordError(caught),
          name: file.name,
        });
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
    const chosenSections = linkBankTransfers(
      merged.preview.sections.filter((s) => s.accountId),
    );
    setUnpaired(new Set());
    setPreview({ sections: chosenSections });
    setBreaks(merged.breaks);
    setGaps(merged.gaps);
    setTotalsNotes(merged.totalsNotes);
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
    setError("");
    setBusy(true);
    const { results, statements } = await readFiles({});
    setBusy(false);
    const locked = results.filter((result) => result.isLocked);
    setLockedFiles(locked);
    setReadSoFar(statements);
    if (locked.length > 0) return;
    if (statements.length === 0) {
      setError(results[0]?.error ?? "No statement could be read");
      return;
    }
    chooseAccounts(statements);
  }

  function chooseAccounts(statements: StatementFile[]) {
    const active = mergeStatements(statements).preview.sections.filter(
      (s) => s.rows.length > 0,
    );
    const linkedAccountId = params.get("accountId");
    // An excluded account with no money, before or after, has nothing worth keeping.
    const idle = active.filter((section) => {
      const account = accounts.find((a) => a.id === section.suggestedAccountId);
      return (
        account?.isExcluded &&
        accountBalance(account, transactions) === 0 &&
        section.openingBalance === 0 &&
        section.closingBalance === 0
      );
    });
    setIdleKeys(new Set(idle.map((section) => section.key)));
    setPockets(active);
    setPocketAccounts(
      Object.fromEntries(
        active.map((s) => [
          s.key,
          idle.includes(s)
            ? SKIP
            : (s.suggestedAccountId ??
              // Opened from a new account, which has no number to match yet.
              (active.length === 1 && linkedAccountId
                ? linkedAccountId
                : SKIP)),
        ]),
      ),
    );
  }

  function continueWithoutLocked() {
    setLeftOut(new Set(lockedFiles.map((file) => file.name)));
    setLockedFiles([]);
    setFileResults((current) => current.filter((result) => !result.isLocked));
    chooseAccounts(readSoFar);
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

  function showSection(key: string) {
    const next = new Set(collapsed);
    next.delete(key);
    setCollapsed(next);
    document
      .getElementById(`import-section-${key}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleOpening(key: string) {
    const next = new Set(openingKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpeningKeys(next);
  }

  const failedFiles = fileResults.filter((result) => result.error).length;
  const fileList = fileResults.length > 1 && (
    <details className="card import-files" open={failedFiles > 0}>
      <summary>
        {fileResults.length - failedFiles} of {fileResults.length} files read
      </summary>
      {fileResults.map((result) => (
        <div className="manage-row" key={result.name}>
          <div className="manage-copy">
            <b>{result.name}</b>
            <span>
              {result.error ??
                `${result.bank}, ${result.count} ${result.count === 1 ? "transaction" : "transactions"}`}
            </span>
          </div>
          <Badge tone={result.error ? "warning" : "success"}>
            {result.error ? "Not included" : "Read"}
          </Badge>
        </div>
      ))}
    </details>
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
          <p>Add past transactions from bank statement PDFs.</p>
        </div>
      </div>

      <ol className="import-steps">
        {STEPS.map((step, index) => {
          const current = preview ? 2 : pockets ? 1 : 0;
          return (
            <li
              aria-current={index === current ? "step" : undefined}
              className={index < current ? "done" : undefined}
              key={step}
            >
              <i>
                {index < current ? (
                  <Check aria-hidden="true" size={13} strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </i>
              <span>{step}</span>
            </li>
          );
        })}
      </ol>

      {!pockets && !preview && (
        <form className="card import-form" noValidate onSubmit={read}>
          <label className={`import-drop ${files.length > 0 ? "filled" : ""}`}>
            <Upload aria-hidden="true" size={22} />
            <b>
              {files.length > 0
                ? `${files.length} ${files.length === 1 ? "file" : "files"} chosen`
                : "Choose or drop statement PDFs"}
            </b>
            <span>
              Files from different banks can go together. Fynlo reads the bank
              from each file.
            </span>
            <input
              accept="application/pdf,.pdf"
              aria-label="Statement PDFs"
              multiple
              onChange={(event) => {
                setFiles(Array.from(event.target.files ?? []));
                setLockedFiles([]);
                setLeftOut(new Set());
                setFilePasswords({});
              }}
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
          {files.length > 0 && (
            <ul className="import-chosen">
              {files.map((file) => (
                <li key={file.name}>{file.name}</li>
              ))}
            </ul>
          )}
          <label>
            PDF password (only if locked)
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
          {lockedFiles.length > 0 && (
            <div className="import-locked">
              <b>Enter the password for these files</b>
              {lockedFiles.map((file) => (
                <label key={file.name}>
                  <span>{file.name}</span>
                  <input
                    aria-label={`Password for ${file.name}`}
                    autoComplete="off"
                    onChange={(event) =>
                      setFilePasswords((current) => ({
                        ...current,
                        [file.name]: event.target.value,
                      }))
                    }
                    type="password"
                    value={filePasswords[file.name] ?? ""}
                  />
                  <small>{file.error}</small>
                </label>
              ))}
            </div>
          )}
          {progressBar}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            {lockedFiles.length > 0 && readSoFar.length > 0 && (
              <Button
                disabled={busy}
                kind="secondary"
                onClick={continueWithoutLocked}
              >
                Continue Without Them
              </Button>
            )}
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
              <h2>Choose an account for each balance</h2>
              <p>Moves between chosen accounts are saved as one transfer.</p>
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
                    {pocket.bank}
                    {pocket.accountMask && ` •• ${pocket.accountMask}`} ·{" "}
                    {pocket.rows.length}{" "}
                    {pocket.rows.length === 1 ? "transaction" : "transactions"}
                  </span>
                </div>
                {idleKeys.has(pocket.key) &&
                  pocketAccounts[pocket.key] === SKIP && (
                    <Badge>Skipped: excluded, no balance</Badge>
                  )}
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
                      { label: "Skip this one", value: SKIP },
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
              Choose a different account for each one
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
          {breaks.length > 0 && (
            <div className="import-check off" role="alert">
              <CircleAlert aria-hidden="true" size={20} />
              <div>
                <b>A month may be missing from Fynlo</b>
                <ul>
                  {breaks.map((item) => (
                    <li key={item.sectionKey}>
                      {accountLabel(
                        accountById(
                          sections.find((s) => s.key === item.sectionKey)
                            ?.accountId ?? null,
                        ),
                      )}{" "}
                      has {formatRupiah(item.saved)} before {item.file}, but it
                      starts at {formatRupiah(item.opening)}.
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {totalsNotes.map((note) => (
            <div className="notice" key={note.file}>
              <Info aria-hidden="true" size={20} />
              <div>
                <b>The bank&apos;s totals differ from its list</b>
                <span>
                  {note.file} prints {formatRupiah(note.income)} in and{" "}
                  {formatRupiah(note.expense)} out, but its rows add up to{" "}
                  {formatRupiah(note.rowsIncome)} and{" "}
                  {formatRupiah(note.rowsExpense)}. Fynlo imports the rows, and
                  their balances are correct.
                </span>
              </div>
            </div>
          ))}
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
          <div
            className={`import-check ${offBalances.length > 0 ? "off" : "ok"}`}
            role="status"
          >
            {offBalances.length > 0 ? (
              <CircleAlert aria-hidden="true" size={20} />
            ) : (
              <Check aria-hidden="true" size={20} />
            )}
            <div>
              <b>
                {offBalances.length > 0
                  ? `${offBalances.length} ${offBalances.length === 1 ? "balance doesn't" : "balances don't"} match the statement`
                  : "Every balance matches the statement"}
              </b>
              {offBalances.length > 0 ? (
                <ul>
                  {offBalances.map((balance) => {
                    const section = sections.find((x) => x.key === balance.key);
                    return (
                      <li key={balance.key}>
                        <button
                          className="text-link"
                          onClick={() => showSection(balance.key)}
                          type="button"
                        >
                          {accountLabel(
                            accountById(section?.accountId ?? null),
                          )}
                        </button>{" "}
                        is off by {formatRupiah(Math.abs(balance.difference))}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <span>Importing these choices gives the same balances.</span>
              )}
            </div>
          </div>
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
            const { after, difference } = balances.find(
              (balance) => balance.key === section.key,
            ) as (typeof balances)[number];
            const chosenCount = rows.filter(
              (row) => !excluded.has(row.key),
            ).length;
            return (
              <section
                className="import-section"
                id={`import-section-${section.key}`}
                key={section.key}
              >
                <button
                  aria-expanded={!isCollapsed}
                  className="import-section-toggle"
                  onClick={() => toggleSection(section.key)}
                  type="button"
                >
                  <span>
                    <b>{accountLabel(account)}</b>
                    <small>
                      Statement {formatRupiah(section.closingBalance)} · After
                      import {formatRupiah(after)}
                    </small>
                  </span>
                  {difference === 0 ? (
                    <Badge tone="success">Matches</Badge>
                  ) : (
                    <Badge tone="danger">
                      Off by {formatRupiah(Math.abs(difference))}
                    </Badge>
                  )}
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
                    {section.rows.length === 0 && (
                      <div className="empty">
                        <span>No transactions in this statement.</span>
                      </div>
                    )}
                    {section.rows.map((statementRow, index) => {
                      const row = rows.find(
                        (item) => item.key === rowKey(section, index),
                      );
                      if (!row) {
                        return (
                          <MirrorRow
                            amount={statementRow.amount}
                            date={statementRow.date}
                            detail={statementRow.detail}
                            from={accountLabel(
                              accountById(statementRow.transferAccountId),
                            )}
                            isIncluded={isMirrorIncluded(section, statementRow)}
                            key={rowKey(section, index)}
                            name={statementRow.name}
                            onNotTransfer={
                              statementRow.pairKey
                                ? () =>
                                    setUnpaired(
                                      new Set(unpaired).add(
                                        statementRow.pairKey as string,
                                      ),
                                    )
                                : undefined
                            }
                            time={statementRow.time}
                          />
                        );
                      }
                      return (
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
                          {!excluded.has(row.key) &&
                            (() => {
                              const other = sections.find(
                                (s) => s.accountId === row.transferAccountId,
                              );
                              return (
                                other &&
                                !hasOtherSide(row, other) && (
                                  <Badge tone="danger">
                                    Not on{" "}
                                    {accountLabel(accountById(other.accountId))}
                                    &apos;s statement
                                  </Badge>
                                )
                              );
                            })()}
                          {row.isSuggested &&
                            row.categoryId &&
                            !chosenCategories[row.key] && (
                              <Badge tone="info">Suggested</Badge>
                            )}
                          {row.isPossibleTransfer &&
                            !row.transferAccountId &&
                            !chosenCategories[row.key] &&
                            others.length > 0 && (
                              <Badge>Possible transfer</Badge>
                            )}
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
                      );
                    })}
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
          <div className="import-actions">
            <span
              className={
                offBalances.length > 0 || breaks.length > 0 ? "off" : undefined
              }
            >
              {offBalances.length > 0
                ? "Some balances won't match"
                : breaks.length > 0
                  ? "A month may be missing"
                  : "Balances match"}
            </span>
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

/** A pocket's incoming move, shown to match the statement but saved as the other pocket's transfer. */
function MirrorRow({
  amount,
  date,
  detail,
  from,
  isIncluded,
  name,
  onNotTransfer,
  time,
}: {
  amount: number;
  date: string;
  detail: string;
  from: string;
  isIncluded: boolean;
  name: string;
  /** Offered when Fynlo paired the two sides itself, which can be a coincidence. */
  onNotTransfer?: () => void;
  time: string;
}) {
  return (
    <div
      className={`manage-row import-row import-mirror ${isIncluded ? "" : "skipped"}`}
    >
      <ArrowLeftRight aria-hidden="true" size={15} />
      <div className="manage-copy">
        <b>{name}</b>
        <span>
          {formatDayShort(date)}, {time.slice(0, 5)}
          {detail && ` · ${detail}`}
        </span>
      </div>
      <span className="import-mirror-note">
        {isIncluded
          ? `Included in the transfer from ${from}`
          : `Not imported, the transfer from ${from} is off`}
      </span>
      {onNotTransfer && (
        <Button kind="ghost" onClick={onNotTransfer}>
          Not a transfer
        </Button>
      )}
      <strong className="positive">{formatRupiah(amount)}</strong>
    </div>
  );
}
