"use client";

import type {
  AccountInputInterface,
  AccountInterface,
  AccountTypeInterface,
  AssetInterface,
  BudgetInterface,
  TransactionInterface,
} from "@fynlo/types";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { defaultCategories as categories } from "@/constants";
import { useAuth } from "@/providers/auth-provider";
import {
  createAccountRequest,
  createAccountTypeRequest,
  deleteAccountRequest,
  deleteAccountTypeRequest,
  listAccountsRequest,
  listAccountTypesRequest,
  renameAccountTypeRequest,
  updateAccountRequest,
} from "@/services/api";

export type LoadStatus = "error" | "loading" | "ready";
export type NewTransaction = Omit<TransactionInterface, "id">;

// Stays empty until the assets API is connected.
const assets: AssetInterface[] = [];

interface FinanceValue {
  accounts: AccountInterface[];
  accountsStatus: LoadStatus;
  accountTypes: AccountTypeInterface[];
  addTransaction: (transaction: NewTransaction) => void;
  assets: AssetInterface[];
  budgets: BudgetInterface[];
  categories: typeof categories;
  createAccount: (input: AccountInputInterface) => Promise<void>;
  createAccountType: (name: string) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  deleteAccountType: (id: string) => Promise<void>;
  deleteTransaction: (id: string) => void;
  loadAccounts: () => Promise<void>;
  renameAccountType: (id: string, name: string) => Promise<void>;
  saveBudget: (budget: BudgetInterface) => void;
  transactions: TransactionInterface[];
  updateAccount: (
    id: string,
    changes: Partial<AccountInputInterface> & { isExcluded?: boolean },
  ) => Promise<void>;
  updateTransaction: (id: string, changes: Partial<NewTransaction>) => void;
}

const FinanceContext = createContext<FinanceValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [accounts, setAccounts] = useState<AccountInterface[]>([]);
  const [accountsStatus, setAccountsStatus] = useState<LoadStatus>("loading");
  const [accountTypes, setAccountTypes] = useState<AccountTypeInterface[]>([]);
  const [transactions, setTransactions] = useState<TransactionInterface[]>([]);
  const [budgets, setBudgets] = useState<BudgetInterface[]>([]);

  const loadAccounts = useCallback(async () => {
    setAccountsStatus("loading");
    try {
      const [loadedAccounts, loadedTypes] = await Promise.all([
        listAccountsRequest(),
        listAccountTypesRequest(),
      ]);
      setAccounts(loadedAccounts);
      setAccountTypes(loadedTypes);
      setAccountsStatus("ready");
    } catch {
      setAccountsStatus("error");
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      void loadAccounts();
    } else if (status === "anonymous") {
      // Financial data must not outlive the session.
      setAccounts([]);
      setAccountTypes([]);
      setAccountsStatus("loading");
      setTransactions([]);
      setBudgets([]);
    }
  }, [loadAccounts, status]);

  const createAccount = useCallback(async (input: AccountInputInterface) => {
    const account = await createAccountRequest(input);
    setAccounts((current) => [...current, account]);
    setAccountTypes(await listAccountTypesRequest());
  }, []);

  const createAccountType = useCallback(async (name: string) => {
    const type = await createAccountTypeRequest(name);
    setAccountTypes((current) => [...current, type]);
  }, []);

  const renameAccountType = useCallback(async (id: string, name: string) => {
    const type = await renameAccountTypeRequest(id, name);
    setAccountTypes((current) => current.map((t) => (t.id === id ? type : t)));
    setAccounts((current) =>
      current.map((a) =>
        a.accountTypeId === id ? { ...a, typeName: type.name } : a,
      ),
    );
  }, []);

  const deleteAccountType = useCallback(async (id: string) => {
    await deleteAccountTypeRequest(id);
    setAccountTypes((current) => current.filter((t) => t.id !== id));
  }, []);

  const updateAccount = useCallback(
    async (
      id: string,
      changes: Partial<AccountInputInterface> & { isExcluded?: boolean },
    ) => {
      const account = await updateAccountRequest(id, changes);
      setAccounts((current) => current.map((a) => (a.id === id ? account : a)));
      setAccountTypes(await listAccountTypesRequest());
    },
    [],
  );

  const deleteAccount = useCallback(async (id: string) => {
    await deleteAccountRequest(id);
    setAccounts((current) => current.filter((a) => a.id !== id));
    setAccountTypes(await listAccountTypesRequest());
  }, []);

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
      accountsStatus,
      accountTypes,
      addTransaction,
      assets,
      budgets,
      categories,
      createAccount,
      createAccountType,
      deleteAccount,
      deleteAccountType,
      deleteTransaction,
      loadAccounts,
      renameAccountType,
      saveBudget,
      transactions,
      updateAccount,
      updateTransaction,
    }),
    [
      accounts,
      accountsStatus,
      accountTypes,
      addTransaction,
      budgets,
      createAccount,
      createAccountType,
      deleteAccount,
      deleteAccountType,
      deleteTransaction,
      loadAccounts,
      renameAccountType,
      saveBudget,
      transactions,
      updateAccount,
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
