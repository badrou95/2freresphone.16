import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationBarProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  itemLabel?: string;
}

export function PaginationBar({
  currentPage,
  totalItems,
  pageSize,
  pageSizeOptions = [6, 9, 10],
  onPageChange,
  onPageSizeChange,
  itemLabel = 'produit',
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  if (totalItems <= 0) return null;

  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  // Build visible page numbers with ellipsis
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis')[] = [1];
    const left = Math.max(2, safePage - 1);
    const right = Math.min(totalPages - 1, safePage + 1);

    if (left > 2) pages.push('ellipsis');
    for (let p = left; p <= right; p++) {
      pages.push(p);
    }
    if (right < totalPages - 1) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span className="tabular-nums">
          Affichage de <strong className="text-slate-900 font-semibold">{startItem}</strong> à{' '}
          <strong className="text-slate-900 font-semibold">{endItem}</strong> sur{' '}
          <strong className="text-slate-900 font-semibold">{totalItems}</strong> {itemLabel}
          {totalItems > 1 ? 's' : ''} · Page{' '}
          <strong className="text-blue-700 font-semibold">{safePage}</strong> / {totalPages}
        </span>

        {onPageSizeChange && pageSizeOptions.length > 1 && (
          <div className="inline-flex items-center gap-1.5">
            <label className="text-slate-500">Afficher :</label>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Nombre de produits par page"
              className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} par page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-700 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Précédent</span>
          </button>

          {pageNumbers.map((item, idx) =>
            item === 'ellipsis' ? (
              <span key={`ell-${idx}`} className="px-1.5 text-xs text-slate-400 select-none">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === safePage ? 'page' : undefined}
                className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold tabular-nums transition-colors ${
                  item === safePage
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-700 transition-colors"
          >
            <span>Suivant</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </nav>
      )}
    </div>
  );
}
