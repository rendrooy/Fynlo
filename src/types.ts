export type TransactionType = 'income' | 'expense'

export type AccountKind = 'cash' | 'bank' | 'ewallet'

export interface Account {
  id: string
  name: string
  kind: AccountKind
  openingBalance: number
}

export interface Category {
  id: string
  name: string
  type: TransactionType
  icon: string
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  categoryId: string
  accountId: string
  /** Tanggal lokal dengan format YYYY-MM-DD. */
  date: string
  note: string
}

export interface Budget {
  categoryId: string
  limit: number
}
