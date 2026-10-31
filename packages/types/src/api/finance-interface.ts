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

export interface StatementImportInterface {
  accountId: string;
  openingBalance: null | number;
  rows: (Omit<StatementRowInterface, "isDuplicate" | "isPossibleTransfer"> & {
    /** The other account, when this row is a transfer between own accounts. */
    transferAccountId: null | string;
  })[];
}

export interface StatementPreviewInterface {
  accountMask: null | string;
  /** True when no saved transaction is older than this statement. */
  canSetOpeningBalance: boolean;
  closingBalance: number;
  isDifferentAccount: boolean;
  openingBalance: number;
  rows: StatementRowInterface[];
}

export interface StatementRowInterface {
  amount: number;
  categoryId: null | string;
  date: string;
  detail: string;
  isDuplicate: boolean;
  /** The description carries the owner's own name. */
  isPossibleTransfer: boolean;
  name: string;
  /** Time in HH:mm:ss format. */
  time: string;
  /** The direction of the money in this statement's account. */
  type: CategoryType;
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
  source: TransactionSource;
  status: TransactionStatus;
  toAccountId: null | string;
  type: TransactionType;
}

export type TransactionSource = "email" | "import" | "manual" | "shortcut";

export type TransactionStatus = "review" | "verified";

export type TransactionType = "transfer" | CategoryType;
