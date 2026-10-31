import type {
  StatementPreviewInterface,
  StatementSectionInterface,
} from "@fynlo/types";

export interface StatementGap {
  /** Statement file where the balance ends. */
  from: string;
  fromBalance: number;
  sectionKey: string;
  /** Statement file where the next balance starts. */
  to: string;
  toBalance: number;
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
  const gaps: StatementGap[] = [];
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

  return { gaps, mismatchedKeys, preview: { sections } };
}
