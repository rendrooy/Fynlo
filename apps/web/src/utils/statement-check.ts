import type {
  StatementRowInterface,
  StatementSectionInterface,
} from "@fynlo/types";

import type { StatementGap } from "./statement-merge";

// A transfer between banks can land the next day.
const MAX_TRANSFER_GAP_MS = 36 * 60 * 60 * 1000;

const cents = (amount: number) => Math.round(amount * 100);

const timeOf = (row: Pick<StatementRowInterface, "date" | "time">) =>
  new Date(`${row.date}T${row.time}`).getTime();

export interface ImportRow extends StatementRowInterface {
  key: string;
}

/**
 * What each account's balance becomes if the current choices are imported, in cents.
 * Rows left out as duplicates count, since those are already saved. Transfers also move the
 * other account, which is how a wrong choice shows up.
 */
export function balancesAfterImport(
  sections: StatementSectionInterface[],
  rowsOf: (section: StatementSectionInterface) => ImportRow[],
  excluded: Set<string>,
  gaps: StatementGap[],
) {
  const balances = new Map(
    sections.map((section) => [section.key, cents(section.openingBalance)]),
  );
  const add = (key: string, amount: number) =>
    balances.set(key, (balances.get(key) ?? 0) + amount);
  for (const gap of gaps) {
    add(gap.sectionKey, cents(gap.toBalance) - cents(gap.fromBalance));
  }
  for (const section of sections) {
    for (const row of rowsOf(section)) {
      if (excluded.has(row.key) && !row.isDuplicate) continue;
      const signed =
        row.type === "income" ? cents(row.amount) : -cents(row.amount);
      add(section.key, signed);
      const other = sections.find((s) => s.accountId === row.transferAccountId);
      if (other) add(other.key, -signed);
    }
  }
  return sections.map((section) => {
    const after = balances.get(section.key) ?? 0;
    return {
      after: after / 100,
      difference: (after - cents(section.closingBalance)) / 100,
      key: section.key,
    };
  });
}

/** False when a transfer points at an account whose statement shows no such money. */
export function hasOtherSide(
  row: StatementRowInterface,
  other: StatementSectionInterface,
) {
  return other.rows.some(
    (candidate) =>
      candidate.type !== row.type &&
      cents(candidate.amount) === cents(row.amount) &&
      Math.abs(timeOf(candidate) - timeOf(row)) <= MAX_TRANSFER_GAP_MS,
  );
}
