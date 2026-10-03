import { cn } from '../lib/cn';

/**
 * shadcn-style pagination (controlled). Page numbers are 1-based for display,
 * 0-based in state — this component speaks 0-based both ways.
 */
export function PaginationControl({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const nums: (number | '…')[] = [];
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  const btn = (active?: boolean) => cn('sbtn', 'sbtn-sm', active ? 'sbtn-default' : 'sbtn-outline');
  return (
    <nav role="navigation" aria-label="pagination" style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className={btn()} disabled={page === 0} onClick={() => onChange(page - 1)} aria-label="Previous page">
          ← Prev
        </button>
        {nums.map((n, i) =>
          n === '…' ? (
            <span key={`e${i}`} style={{ padding: '0 4px', opacity: 0.6 }}>
              …
            </span>
          ) : (
            <button
              key={n}
              className={btn(n === page)}
              aria-current={n === page ? 'page' : undefined}
              onClick={() => onChange(n)}
            >
              {n + 1}
            </button>
          )
        )}
        <button
          className={btn()}
          disabled={page === totalPages - 1}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          Next →
        </button>
      </div>
    </nav>
  );
}
