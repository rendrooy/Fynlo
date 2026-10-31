import { Suspense } from "react";

import PageContent from "./PageContent";

export default function TransactionsPage() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
