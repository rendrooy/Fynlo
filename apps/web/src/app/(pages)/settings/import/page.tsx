import { Suspense } from "react";

import PageContent from "./PageContent";

export default function ImportStatementPage() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
