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

export interface BudgetInterface {
  categoryId: string;
  limit: number;
}

export interface CategoryGroupInterface {
  categoryCount: number;
  id: string;
  name: string;
  type: TransactionType;
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
  type: TransactionType;
}

export interface StatementImportInterface {
  accountId: string;
  openingBalance: null | number;
  rows: Omit<StatementRowInterface, "isDuplicate">[];
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
  name: string;
  /** Time in HH:mm:ss format. */
  time: string;
  type: TransactionType;
}

export interface TransactionInputInterface {
  accountId: string;
  amount: number;
  categoryId: string;
  /** Local date in YYYY-MM-DD format. */
  date: string;
  detail: string;
  name: string;
  /** Local time in HH:mm format. */
  time: string;
}

export interface TransactionInterface extends Omit<
  TransactionInputInterface,
  "categoryId"
> {
  /** Null until an imported transaction is given a category. */
  categoryId: null | string;
  id: string;
  source: TransactionSource;
  status: TransactionStatus;
  type: TransactionType;
}

export type TransactionSource = "email" | "import" | "manual" | "shortcut";

export type TransactionStatus = "review" | "verified";

export type TransactionType = "expense" | "income";
