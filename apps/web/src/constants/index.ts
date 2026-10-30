import type {
  AccountKind,
  AssetKind,
  CategoryInterface,
  TransactionSource,
  TransactionStatus,
} from "@fynlo/types";

export const accountKinds: Record<AccountKind, string> = {
  bank: "Bank account",
  cash: "Cash",
  ewallet: "E-wallet",
};

export const assetKinds: Record<AssetKind, string> = {
  gold: "Precious metal",
  investment: "Investment",
  property: "Property",
  vehicle: "Vehicle",
};

export const sourceLabels: Record<TransactionSource, string> = {
  email: "Email notification",
  manual: "Manual entry",
  shortcut: "iOS Shortcuts",
};

export const statusLabels: Record<TransactionStatus, string> = {
  review: "Needs review",
  verified: "Verified",
};

export const NOT_AVAILABLE = "Not available in this prototype yet";

export const defaultCategories: CategoryInterface[] = [
  {
    color: "#059669",
    icon: "wallet",
    id: "salary",
    name: "Salary",
    type: "income",
  },
  {
    color: "#0ea5e9",
    icon: "laptop",
    id: "freelance",
    name: "Freelance",
    type: "income",
  },
  {
    color: "#059669",
    icon: "utensils",
    id: "food",
    name: "Food & Drinks",
    type: "expense",
  },
  {
    color: "#0ea5e9",
    icon: "car",
    id: "transport",
    name: "Transport",
    type: "expense",
  },
  {
    color: "#8b5cf6",
    icon: "bag",
    id: "shopping",
    name: "Shopping",
    type: "expense",
  },
  {
    color: "#f59e0b",
    icon: "receipt",
    id: "bills",
    name: "Bills",
    type: "expense",
  },
  {
    color: "#e11d48",
    icon: "home",
    id: "housing",
    name: "Housing",
    type: "expense",
  },
  {
    color: "#64748b",
    icon: "film",
    id: "fun",
    name: "Entertainment",
    type: "expense",
  },
];
