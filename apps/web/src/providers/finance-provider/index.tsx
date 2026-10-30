"use client";

import type { BudgetInterface, TransactionInterface } from "@fynlo/types";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import {
  accounts,
  assets,
  categories,
  budgets as seedBudgets,
  seedTransactions,
} from "@/constants/mock-data";

export type NewTransaction = Omit<TransactionInterface, "id">;

interface FinanceValue {
  accounts: typeof accounts;
  addTransaction: (transaction: NewTransaction) => void;
  assets: typeof assets;
  budgets: BudgetInterface[];
  categories: typeof categories;
  deleteTransaction: (id: string) => void;
  saveBudget: (budget: BudgetInterface) => void;
  transactions: TransactionInterface[];
  updateTransaction: (id: string, changes: Partial<NewTransaction>) => void;
}

const FinanceContext = createContext<FinanceValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState(seedTransactions);
  const [budgets, setBudgets] = useState(seedBudgets);

  const addTransaction = useCallback((transaction: NewTransaction) => {
    setTransactions((current) => [
      ...current,
      { ...transaction, id: `tx-${Date.now()}` },
    ]);
  }, []);

  const updateTransaction = useCallback(
    (id: string, changes: Partial<NewTransaction>) => {
      setTransactions((current) =>
        current.map((t) => (t.id === id ? { ...t, ...changes } : t)),
      );
    },
    [],
  );

  const deleteTransaction = useCallback((id: string) => {
    setTransactions((current) => current.filter((t) => t.id !== id));
  }, []);

  const saveBudget = useCallback((budget: BudgetInterface) => {
    setBudgets((current) =>
      current.some((b) => b.categoryId === budget.categoryId)
        ? current.map((b) => (b.categoryId === budget.categoryId ? budget : b))
        : [...current, budget],
    );
  }, []);

  const value = useMemo(
    () => ({
      accounts,
      addTransaction,
      assets,
      budgets,
      categories,
      deleteTransaction,
      saveBudget,
      transactions,
      updateTransaction,
    }),
    [
      addTransaction,
      budgets,
      deleteTransaction,
      saveBudget,
      transactions,
      updateTransaction,
    ],
  );

  return (
    <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
  );
}

export function useFinance() {
  const value = useContext(FinanceContext);
  if (!value) throw new Error("useFinance must be used inside FinanceProvider");
  return value;
}
