import { Skeleton } from './primitives';
import './shadcn.css';

/** Full-page shadcn skeletons, shaped per page. */
export function PageSkeleton({ variant }: { variant: 'app' | 'list' | 'page' }) {
  if (variant === 'page') {
    // In-shell loading: mirrors a page-hero + content card, never a fake shell.
    return (
      <div>
        <Skeleton style={{ height: 120, borderRadius: 18, marginBottom: 12 }} />
        <Skeleton style={{ height: 220, borderRadius: 18, marginBottom: 12 }} />
        <Skeleton style={{ height: 64, borderRadius: 14 }} />
      </div>
    );
  }
  if (variant === 'list') {
    return (
      <div>
        <Skeleton style={{ height: 132, borderRadius: 18, marginBottom: 12 }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', marginTop: 10 }}>
            <Skeleton style={{ width: 66, height: 66, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Skeleton style={{ height: 16, width: '55%', marginBottom: 8 }} />
              <Skeleton style={{ height: 12, width: '80%' }} />
            </div>
            <Skeleton style={{ height: 34, width: 120 }} />
          </div>
        ))}
      </div>
    );
  }

  // 'app': sidebar + topbar + hero + cards, like the real shell
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f6f8fc' }}>
      <div style={{ width: 264, background: '#0a1633', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton style={{ height: 40, background: 'rgba(255,255,255,.08)' }} />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} style={{ height: 38, background: 'rgba(255,255,255,.06)' }} />
        ))}
        <div style={{ flex: 1 }} />
        <Skeleton style={{ height: 52, background: 'rgba(255,255,255,.06)' }} />
      </div>
      <div style={{ flex: 1, padding: 20 }}>
        <Skeleton style={{ height: 52, marginBottom: 14 }} />
        <Skeleton style={{ height: 190, borderRadius: 18, marginBottom: 14 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: 150, borderRadius: 14 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
