export interface ParsedStatement {
  /** Last 4 digits of the account number printed on the statement. */
  accountMask: null | string;
  closingBalance: number;
  openingBalance: number;
  rows: ParsedStatementRow[];
}

export interface ParsedStatementRow {
  amount: number;
  /** YYYY-MM-DD. */
  date: string;
  detail: string;
  name: string;
  /** HH:mm:ss. */
  time: string;
  type: "expense" | "income";
}
