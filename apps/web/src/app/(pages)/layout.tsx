import { TransactionSheetProvider } from "@/providers/transaction-sheet-provider";

import LayoutClient from "./LayoutClient";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <TransactionSheetProvider>
      <LayoutClient>{children}</LayoutClient>
    </TransactionSheetProvider>
  );
}
