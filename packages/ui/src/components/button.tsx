import type { ButtonHTMLAttributes } from "react";

import { cn } from "@fynlo/utils/styles";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: "danger" | "ghost" | "primary" | "secondary";
}

export function Button({ className, kind = "primary", ...props }: ButtonProps) {
  return (
    <button className={cn("btn", kind, className)} type="button" {...props} />
  );
}
