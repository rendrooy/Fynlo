import type {
  AccountKind,
  AssetKind,
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

export const currentUser = {
  email: "andi.r@example.com",
  initials: "AR",
  name: "Andi Ramadhan",
};
