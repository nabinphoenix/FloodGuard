import { ChevronLeft, ChevronRight } from "lucide-react";

export default function AdminPagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }) {
  if (totalItems <= pageSize) return null;

  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-ink-border bg-white px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-ink-secondary">Showing {firstItem}-{lastItem} of {totalItems}</p>
      <div className="flex items-center justify-center gap-1">
        <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page" className="rounded-lg border border-ink-border p-2 text-ink-secondary transition hover:bg-surface-bg disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
          <button key={page} type="button" onClick={() => onPageChange(page)} aria-current={page === currentPage ? "page" : undefined} className={`min-w-9 rounded-lg px-3 py-2 font-semibold transition ${page === currentPage ? "bg-brand text-white" : "text-ink-secondary hover:bg-surface-bg"}`}>
            {page}
          </button>
        ))}
        <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page" className="rounded-lg border border-ink-border p-2 text-ink-secondary transition hover:bg-surface-bg disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
