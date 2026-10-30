import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { accounts, budgets, categories, seedTransactions } from '../data/mock'
import type { Transaction } from '../types'

interface FinanceValue {
  accounts: typeof accounts
  budgets: typeof budgets
  categories: typeof categories
  transactions: Transaction[]
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void
}

const FinanceContext = createContext<FinanceValue | null>(null)

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState(seedTransactions)

  const addTransaction = useCallback((transaction: Omit<Transaction, 'id'>) => {
    setTransactions((current) => [...current, { ...transaction, id: `tx-${Date.now()}` }])
  }, [])

  const value = useMemo(
    () => ({ accounts, budgets, categories, transactions, addTransaction }),
    [transactions, addTransaction],
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance() {
  const value = useContext(FinanceContext)
  if (!value) throw new Error('useFinance harus dipakai di dalam FinanceProvider')
  return value
}
