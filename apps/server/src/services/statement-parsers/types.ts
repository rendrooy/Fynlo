export interface ParsedStatement {
  sections: ParsedStatementSection[];
}

export interface ParsedStatementRow {
  amount: number;
  /** Name of the other pocket, when the bank marks this as a move between pockets. */
  counterpart: null | string;
  /** YYYY-MM-DD. */
  date: string;
  detail: string;
  name: string;
  /** HH:mm:ss. */
  time: string;
  type: "expense" | "income";
}

/** One balance within a statement: the whole account, or one pocket of it. */
export interface ParsedStatementSection {
  /** Last 4 digits of the account or pocket number printed on the statement. */
  accountMask: null | string;
  closingBalance: number;
  /** Stable within one statement. */
  key: string;
  name: string;
  openingBalance: number;
  /** The bank's own totals, when they differ from the rows it lists. */
  printedTotals?: { expense: number; income: number } | null;
  rows: ParsedStatementRow[];
}
