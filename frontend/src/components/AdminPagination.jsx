import { ChevronLeft, ChevronRight } from "lucide-react";

export default function AdminPagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }) {
  if (totalItems <= pageSize) return null;

  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);
  const pages = [...new Set([
    1,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    totalPages,
  ].filter((page) => page >= 1 && page <= totalPages))].sort((left, right) => left - right);

  return (
    <div className="flex flex-col gap-3 border-t border-ink-border bg-white px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-ink-secondary">Showing {firstItem}-{lastItem} of {totalItems}</p>
      <div className="flex max-w-full items-center justify-start gap-1 overflow-x-auto pb-1 sm:justify-center">
        <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page" className="rounded-lg border border-ink-border p-2 text-ink-secondary transition hover:bg-surface-bg disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronLeft size={16} />
        </button>
        {pages.map((page, index) => (
          <div key={page} className="flex items-center gap-1">
            {index > 0 && page - pages[index - 1] > 1 ? <span className="px-1 text-ink-secondary" aria-hidden="true">…</span> : null}
            <button type="button" onClick={() => onPageChange(page)} aria-current={page === currentPage ? "page" : undefined} className={`min-w-9 rounded-lg px-3 py-2 font-semibold transition ${page === currentPage ? "bg-brand text-white" : "text-ink-secondary hover:bg-surface-bg"}`}>
              {page}
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page" className="rounded-lg border border-ink-border p-2 text-ink-secondary transition hover:bg-surface-bg disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
