"use client";

import { Button } from "@fynlo/ui/components/button";
import { Select } from "@fynlo/ui/components/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

const NEIGHBORS = 1;

export function Pagination({
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  pageSizes,
  total,
}: {
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Zero-based. */
  page: number;
  pageSize: number;
  pageSizes: number[];
  total: number;
}) {
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const start = page * pageSize;

  return (
    <div className="pagination">
      <span>
        Showing {total ? start + 1 : 0}–{Math.min(start + pageSize, total)} of{" "}
        {total}
      </span>
      <div className="pagination-size">
        <Select
          aria-label="Rows per page"
          onChange={(value) => onPageSizeChange(Number(value))}
          options={pageSizes.map((size) => ({
            label: `${size} per page`,
            value: String(size),
          }))}
          value={String(pageSize)}
        />
      </div>
      <nav aria-label="Pagination" className="pagination-pages">
        <Button
          aria-label="Previous page"
          disabled={page === 0}
          kind="secondary"
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden="true" size={16} />
        </Button>
        {visiblePages(page, pageCount).map((number, index) =>
          number === null ? (
            <span
              aria-hidden="true"
              className="pagination-gap"
              key={`gap${index}`}
            >
              …
            </span>
          ) : (
            <Button
              aria-current={number === page ? "page" : undefined}
              aria-label={`Page ${number + 1}`}
              className={number === page ? "active" : undefined}
              key={number}
              kind="secondary"
              onClick={() => onPageChange(number)}
            >
              {number + 1}
            </Button>
          ),
        )}
        <Button
          aria-label="Next page"
          disabled={page >= pageCount - 1}
          kind="secondary"
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight aria-hidden="true" size={16} />
        </Button>
      </nav>
    </div>
  );
}

/** Zero-based page numbers to show, with null where a run of pages is left out. */
export function visiblePages(page: number, pageCount: number) {
  const pages: (null | number)[] = [];
  for (let index = 0; index < pageCount; index += 1) {
    const isEdge = index === 0 || index === pageCount - 1;
    if (isEdge || Math.abs(index - page) <= NEIGHBORS) pages.push(index);
    else if (pages.at(-1) !== null) pages.push(null);
  }
  return pages;
}
