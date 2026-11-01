import type {
  StatementPreviewInterface,
  StatementRowInterface,
  StatementSectionInterface,
} from "@fynlo/types";

/** Saved transactions end at a different balance than this statement starts with. */
export interface StatementBreak {
  file: string;
  opening: number;
  saved: number;
  sectionKey: string;
}

export interface StatementGap {
  /** Statement file where the balance ends. */
  from: string;
  fromBalance: number;
  sectionKey: string;
  /** Statement file where the next balance starts. */
  to: string;
  toBalance: number;
}

/** The bank's printed totals differ from the rows it lists in this file. */
export interface StatementTotalsNote {
  expense: number;
  file: string;
  income: number;
  rowsExpense: number;
  rowsIncome: number;
}

interface StatementFile {
  name: string;
  preview: StatementPreviewInterface;
}

const firstDate = ({ preview }: StatementFile) =>
  preview.sections
    .flatMap((section) => section.rows.map((row) => row.date))
    .sort()[0] ?? "9999-12-31";

const cents = (amount: number) => Math.round(amount * 100);

// A transfer between banks can land the next day, and the two clocks can differ slightly.
const MAX_ARRIVAL_MS = 36 * 60 * 60 * 1000;
const CLOCK_DRIFT_MS = 10 * 60 * 1000;

const timeOf = (row: StatementRowInterface) =>
  new Date(`${row.date}T${row.time}`).getTime();

/**
 * Turns money leaving one bank and arriving at another into one transfer. Only a pair with no
 * other candidate on either side counts, since equal amounts can also be a coincidence.
 */
export function linkBankTransfers(sections: StatementSectionInterface[]) {
  const rowsOfType = (type: StatementRowInterface["type"]) =>
    sections.flatMap((section) =>
      section.rows.flatMap((row, index) =>
        row.type === type &&
        !row.isDuplicate &&
        !row.isMirror &&
        !row.transferAccountId
          ? [{ index, row, section }]
          : [],
      ),
    );
  const outgoing = rowsOfType("expense");
  const incoming = rowsOfType("income");
  type Candidate = (typeof outgoing)[number];
  const isPair = (out: Candidate, into: Candidate) => {
    const gap = timeOf(into.row) - timeOf(out.row);
    return (
      out.section.bank !== into.section.bank &&
      cents(out.row.amount) === cents(into.row.amount) &&
      gap >= -CLOCK_DRIFT_MS &&
      gap <= MAX_ARRIVAL_MS
    );
  };
  const changes = new Map<StatementRowInterface, StatementRowInterface>();
  for (const out of outgoing) {
    const matches = incoming.filter((into) => isPair(out, into));
    const into = matches[0];
    if (
      !into ||
      matches.length > 1 ||
      outgoing.filter((other) => isPair(other, into)).length > 1
    ) {
      continue;
    }
    const pairKey = `${out.section.key}:${out.index}`;
    changes.set(out.row, {
      ...out.row,
      pairKey,
      transferAccountId: into.section.accountId,
    });
    changes.set(into.row, {
      ...into.row,
      isMirror: true,
      pairKey,
      transferAccountId: out.section.accountId,
    });
  }
  return sections.map((section) => ({
    ...section,
    rows: section.rows.map((row) => changes.get(row) ?? row),
  }));
}

/** Joins statements in date order into one preview, with one section per account or pocket. */
export function mergeStatements(files: StatementFile[]) {
  const ordered = [...files].sort((a, b) =>
    firstDate(a).localeCompare(firstDate(b)),
  );
  const keys = [
    ...new Set(
      ordered.flatMap(({ preview }) => preview.sections.map((s) => s.key)),
    ),
  ];
  const breaks: StatementBreak[] = [];
  const gaps: StatementGap[] = [];
  const totalsNotes: StatementTotalsNote[] = [];
  const mismatchedKeys: string[] = [];

  const sections = keys.map((key) => {
    const parts = ordered.flatMap(({ name, preview }) => {
      const section = preview.sections.find((s) => s.key === key);
      return section ? [{ name, section }] : [];
    });
    const first = (parts[0] as { section: StatementSectionInterface }).section;
    const last = (parts.at(-1) as { section: StatementSectionInterface })
      .section;

    parts.forEach(({ name, section }, index) => {
      const previous = parts[index - 1];
      if (!previous) return;
      if (
        cents(previous.section.closingBalance) !== cents(section.openingBalance)
      ) {
        gaps.push({
          from: previous.name,
          fromBalance: previous.section.closingBalance,
          sectionKey: key,
          to: name,
          toBalance: section.openingBalance,
        });
      }
    });
    for (const { name, section } of parts) {
      if (!section.printedTotals) continue;
      const sum = (type: StatementRowInterface["type"]) =>
        section.rows
          .filter((row) => row.type === type)
          .reduce((total, row) => total + row.amount, 0);
      totalsNotes.push({
        ...section.printedTotals,
        file: name,
        rowsExpense: sum("expense"),
        rowsIncome: sum("income"),
      });
    }
    const start = parts.find(({ section }) => section.rows.length > 0);
    const saved = start?.section.savedBalanceBefore ?? null;
    if (
      start &&
      saved !== null &&
      cents(saved) !== cents(start.section.openingBalance)
    ) {
      breaks.push({
        file: start.name,
        opening: start.section.openingBalance,
        saved,
        sectionKey: key,
      });
    }
    const masks = new Set(
      parts.flatMap(({ section }) => section.accountMask ?? []),
    );
    if (masks.size > 1) mismatchedKeys.push(key);

    // Each row can cover only one in a later file, so real look-alikes stay selected.
    const seen = new Map<string, number>();
    const rows = parts.flatMap(({ section }) => {
      const marked = section.rows.map((row) => {
        const id = [row.date, row.time, row.amount, row.type, row.name].join();
        const count = seen.get(id) ?? 0;
        if (count === 0) return row;
        seen.set(id, count - 1);
        return { ...row, isDuplicate: true };
      });
      for (const row of section.rows) {
        const id = [row.date, row.time, row.amount, row.type, row.name].join();
        seen.set(id, (seen.get(id) ?? 0) + 1);
      }
      return marked;
    });

    return {
      ...first,
      accountId:
        parts.find((p) => p.section.accountId)?.section.accountId ?? null,
      closingBalance: last.closingBalance,
      isDifferentAccount: parts.some((p) => p.section.isDifferentAccount),
      rows,
      suggestedAccountId:
        parts.find((p) => p.section.suggestedAccountId)?.section
          .suggestedAccountId ?? null,
    };
  });

  return { breaks, gaps, mismatchedKeys, preview: { sections }, totalsNotes };
}
