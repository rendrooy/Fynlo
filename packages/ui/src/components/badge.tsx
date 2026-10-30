import type { ReactNode } from "react";

import { cn } from "@fynlo/utils/styles";

export type BadgeTone = "danger" | "info" | "neutral" | "success" | "warning";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return <span className={cn("badge", tone)}>{children}</span>;
}
