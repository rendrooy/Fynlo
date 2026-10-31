export interface AccountInputInterface {
  accountTypeId: string;
  color: string;
  mask: null | string;
  name: string;
  openingBalance: number;
}

export interface AccountInterface extends AccountInputInterface {
  id: string;
  isExcluded: boolean;
  source: TransactionSource;
  typeName: string;
}

export interface AccountTypeInterface {
  accountCount: number;
  id: string;
  name: string;
}

export interface AssetInterface {
  id: string;
  kind: AssetKind;
  name: string;
  value: number;
}

export type AssetKind = "gold" | "investment" | "property" | "vehicle";

export interface BudgetGroupInterface {
  id: string;
  name: string;
}

export interface BudgetInputInterface {
  categoryId: string;
  groupId: string;
  limit: number;
  periodId: string;
}

export interface BudgetInterface extends BudgetInputInterface {
  id: string;
}

export interface BudgetPeriodInputInterface {
  /** Set only on a period that happens once. */
  endDate: null | string;
  intervalCount: number;
  name: string;
  /** Local date in YYYY-MM-DD format. Recurring periods count forward from it. */
  startDate: string;
  unit: BudgetPeriodUnit;
}

export interface BudgetPeriodInterface extends BudgetPeriodInputInterface {
  id: string;
}

export type BudgetPeriodUnit = "day" | "month" | "once" | "week" | "year";

export interface CategoryGroupInterface {
  categoryCount: number;
  id: string;
  name: string;
  type: CategoryType;
}

export interface CategoryInputInterface {
  color: string;
  groupId: string;
  icon: string;
  name: string;
}

export interface CategoryInterface extends CategoryInputInterface {
  groupName: string;
  id: string;
  /** True while a transaction or budget still points to this category. */
  inUse: boolean;
  type: CategoryType;
}

export type CategoryType = "expense" | "income";

export interface IngestEventInterface {
  id: string;
  reason: null | string;
  receivedAt: string;
  sender: null | string;
  source: "email" | "notification";
  status: IngestEventStatus;
  subject: null | string;
  transactionId: null | string;
}

export type IngestEventStatus =
  "ambiguous" | "created" | "failed" | "ignored" | "merged" | "unmatched";

export interface IngestTokenInterface {
  createdTime: string;
  id: string;
  lastUsedTime: null | string;
  name: string;
}

export interface StatementImportInterface {
  sections: {
    accountId: string;
    openingBalance: null | number;
    rows: Omit<
      StatementRowInterface,
      "isDuplicate" | "isMirror" | "isPossibleTransfer" | "isSuggested" | "pairKey"
    >[];
  }[];
}

export interface StatementPreviewInterface {
  sections: StatementSectionInterface[];
}

export interface StatementRowInterface {
  amount: number;
  categoryId: null | string;
  date: string;
  detail: string;
  isDuplicate: boolean;
  /** The incoming side of a move between two chosen pockets, already covered by the outgoing side. */
  isMirror: boolean;
  /** A move to an account that isn't chosen, or the description carries the owner's own name. */
  isPossibleTransfer: boolean;
  /** The category was guessed, from past choices or a known keyword. */
  isSuggested: boolean;
  name: string;
  /** Shared by the two sides of a transfer between banks, found across the statements. */
  pairKey?: string;
  /** Time in HH:mm:ss format. */
  time: string;
  /** The other account, when this row is a transfer between own accounts. */
  transferAccountId: null | string;
  /** The direction of the money in this statement's account. */
  type: CategoryType;
}

/** One balance within a statement: the whole account, or one pocket of it. */
export interface StatementSectionInterface {
  /** Null until an account is chosen for this section. */
  accountId: null | string;
  accountMask: null | string;
  /** The bank that issued the statement, read from the file. */
  bank: string;
  /** True when no saved transaction is older than this statement. */
  canSetOpeningBalance: boolean;
  closingBalance: number;
  isDifferentAccount: boolean;
  key: string;
  name: string;
  openingBalance: number;
  rows: StatementRowInterface[];
  suggestedAccountId: null | string;
}

export interface TransactionInputInterface {
  /** The source account of a transfer. */
  accountId: string;
  amount: number;
  categoryId?: null | string;
  /** Local date in YYYY-MM-DD format. */
  date: string;
  detail: string;
  name: string;
  /** Local time in HH:mm format. */
  time: string;
  /** Set only on a transfer between own accounts. */
  toAccountId?: null | string;
}

export interface TransactionInterface extends Omit<
  TransactionInputInterface,
  "categoryId"
> {
  /** Null on transfers, and until an imported transaction is given a category. */
  categoryId: null | string;
  id: string;
  /** The user checked this and decided it isn't a duplicate. */
  isNotDuplicate: boolean;
  source: TransactionSource;
  status: TransactionStatus;
  toAccountId: null | string;
  type: TransactionType;
}

export type TransactionSource = "email" | "import" | "manual" | "shortcut";

export type TransactionStatus = "review" | "verified";

export type TransactionType = "transfer" | CategoryType;
