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

export interface CategoryInterface {
  color: string;
  icon: string;
  id: string;
  name: string;
  type: TransactionType;
}

export interface TransactionInterface {
  accountId: string;
  amount: number;
  categoryId: string;
  /** Local date in YYYY-MM-DD format. */
  date: string;
  detail: string;
  id: string;
  name: string;
  source: TransactionSource;
  status: TransactionStatus;
  /** Local time in HH:mm format. */
  time: string;
  type: TransactionType;
}

export type TransactionSource = "email" | "manual" | "shortcut";

export type TransactionStatus = "review" | "verified";

export type TransactionType = "expense" | "income";
