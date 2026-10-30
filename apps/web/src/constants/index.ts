import type {
  AssetKind,
  TransactionSource,
  TransactionStatus,
} from "@fynlo/types";

export const assetKinds: Record<AssetKind, string> = {
  gold: "Precious metal",
  investment: "Investment",
  property: "Property",
  vehicle: "Vehicle",
};

export const sourceLabels: Record<TransactionSource, string> = {
  email: "Email notification",
  import: "Bank statement",
  manual: "Manual entry",
  shortcut: "iOS Shortcuts",
};

export const statusLabels: Record<TransactionStatus, string> = {
  review: "Needs review",
  verified: "Verified",
};

export const statementBanks = [{ label: "BNI", value: "bni" }];

export const NOT_AVAILABLE = "Not available in this prototype yet";
