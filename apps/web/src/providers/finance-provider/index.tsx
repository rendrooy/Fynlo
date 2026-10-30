"use client";

import type {
  AccountInputInterface,
  AccountInterface,
  AccountTypeInterface,
  AssetInterface,
  BudgetInterface,
  CategoryGroupInterface,
  CategoryInputInterface,
  CategoryInterface,
  TransactionInterface,
  TransactionType,
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

import { useAuth } from "@/providers/auth-provider";
import {
  createAccountRequest,
  createAccountTypeRequest,
  createCategoryGroupRequest,
  createCategoryRequest,
  deleteAccountRequest,
  deleteAccountTypeRequest,
  deleteCategoryGroupRequest,
  deleteCategoryRequest,
  listAccountsRequest,
  listAccountTypesRequest,
  listCategoriesRequest,
  listCategoryGroupsRequest,
  renameAccountTypeRequest,
  renameCategoryGroupRequest,
  updateAccountRequest,
  updateCategoryRequest,
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
  categories: CategoryInterface[];
  categoriesStatus: LoadStatus;
  categoryGroups: CategoryGroupInterface[];
  createAccount: (input: AccountInputInterface) => Promise<void>;
  createAccountType: (name: string) => Promise<void>;
  createCategory: (input: CategoryInputInterface) => Promise<void>;
  createCategoryGroup: (name: string, type: TransactionType) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  deleteAccountType: (id: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  deleteCategoryGroup: (id: string) => Promise<void>;
  deleteTransaction: (id: string) => void;
  loadAccounts: () => Promise<void>;
  loadCategories: () => Promise<void>;
  renameAccountType: (id: string, name: string) => Promise<void>;
  renameCategoryGroup: (id: string, name: string) => Promise<void>;
  saveBudget: (budget: BudgetInterface) => void;
  transactions: TransactionInterface[];
  updateAccount: (
    id: string,
    changes: Partial<AccountInputInterface> & { isExcluded?: boolean },
  ) => Promise<void>;
  updateCategory: (
    id: string,
    changes: Partial<CategoryInputInterface>,
  ) => Promise<void>;
  updateTransaction: (id: string, changes: Partial<NewTransaction>) => void;
}

const FinanceContext = createContext<FinanceValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [accounts, setAccounts] = useState<AccountInterface[]>([]);
  const [accountsStatus, setAccountsStatus] = useState<LoadStatus>("loading");
  const [accountTypes, setAccountTypes] = useState<AccountTypeInterface[]>([]);
  const [categories, setCategories] = useState<CategoryInterface[]>([]);
  const [categoriesStatus, setCategoriesStatus] =
    useState<LoadStatus>("loading");
  const [categoryGroups, setCategoryGroups] = useState<
    CategoryGroupInterface[]
  >([]);
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

  // The list is ordered by the server, and moving a category changes group counts.
  const refreshCategories = useCallback(async () => {
    const [loadedCategories, loadedGroups] = await Promise.all([
      listCategoriesRequest(),
      listCategoryGroupsRequest(),
    ]);
    setCategories(loadedCategories);
    setCategoryGroups(loadedGroups);
  }, []);

  const loadCategories = useCallback(async () => {
    setCategoriesStatus("loading");
    try {
      await refreshCategories();
      setCategoriesStatus("ready");
    } catch {
      setCategoriesStatus("error");
    }
  }, [refreshCategories]);

  useEffect(() => {
    if (status === "authenticated") {
      void loadAccounts();
      void loadCategories();
    } else if (status === "anonymous") {
      // Financial data must not outlive the session.
      setAccounts([]);
      setAccountTypes([]);
      setAccountsStatus("loading");
      setCategories([]);
      setCategoryGroups([]);
      setCategoriesStatus("loading");
      setTransactions([]);
      setBudgets([]);
    }
  }, [loadAccounts, loadCategories, status]);

  const createCategory = useCallback(
    async (input: CategoryInputInterface) => {
      await createCategoryRequest(input);
      await refreshCategories();
    },
    [refreshCategories],
  );

  const updateCategory = useCallback(
    async (id: string, changes: Partial<CategoryInputInterface>) => {
      await updateCategoryRequest(id, changes);
      await refreshCategories();
    },
    [refreshCategories],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      await deleteCategoryRequest(id);
      await refreshCategories();
    },
    [refreshCategories],
  );

  const createCategoryGroup = useCallback(
    async (name: string, type: TransactionType) => {
      const group = await createCategoryGroupRequest(name, type);
      setCategoryGroups((current) => [...current, group]);
    },
    [],
  );

  const renameCategoryGroup = useCallback(async (id: string, name: string) => {
    const group = await renameCategoryGroupRequest(id, name);
    setCategoryGroups((current) =>
      current.map((g) => (g.id === id ? group : g)),
    );
    setCategories((current) =>
      current.map((c) =>
        c.groupId === id ? { ...c, groupName: group.name } : c,
      ),
    );
  }, []);

  const deleteCategoryGroup = useCallback(async (id: string) => {
    await deleteCategoryGroupRequest(id);
    setCategoryGroups((current) => current.filter((g) => g.id !== id));
  }, []);

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
      categoriesStatus,
      categoryGroups,
      createAccount,
      createAccountType,
      createCategory,
      createCategoryGroup,
      deleteAccount,
      deleteAccountType,
      deleteCategory,
      deleteCategoryGroup,
      deleteTransaction,
      loadAccounts,
      loadCategories,
      renameAccountType,
      renameCategoryGroup,
      saveBudget,
      transactions,
      updateAccount,
      updateCategory,
      updateTransaction,
    }),
    [
      accounts,
      accountsStatus,
      accountTypes,
      addTransaction,
      budgets,
      categories,
      categoriesStatus,
      categoryGroups,
      createAccount,
      createAccountType,
      createCategory,
      createCategoryGroup,
      deleteAccount,
      deleteAccountType,
      deleteCategory,
      deleteCategoryGroup,
      deleteTransaction,
      loadAccounts,
      loadCategories,
      renameAccountType,
      renameCategoryGroup,
      saveBudget,
      transactions,
      updateAccount,
      updateCategory,
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
