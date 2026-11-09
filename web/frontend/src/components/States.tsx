import { Link } from 'react-router-dom';
import { CircleAlert, LoaderCircle } from 'lucide-react';
import { isLoginProblem, messageFor } from '../lib/errors';
import { Button, EmptyState, PageHeader, Skeleton } from './ui';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-6 text-sm text-muted-foreground" role="status">
      <LoaderCircle size={16} className="animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const login = isLoginProblem(error);
  return (
    <div role="alert" className="my-6 flex flex-col gap-4 rounded-xl border border-red-900/50 bg-red-950/20 p-5 sm:flex-row sm:items-center">
      <CircleAlert size={20} className="shrink-0 text-red-300" aria-hidden />
      <p className="flex-1 text-sm text-red-100">{messageFor(error)}</p>
      <div className="flex gap-2">
        {login && (
          <Link to="/settings" className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Open settings
          </Link>
        )}
        {onRetry && <Button onClick={onRetry} variant="secondary" className="h-9 px-4">Try again</Button>}
      </div>
    </div>
  );
}

export function Empty({ children, title = 'Nothing here' }: { children?: React.ReactNode; title?: string }) {
  return <EmptyState icon={CircleAlert} title={title}>{children}</EmptyState>;
}

/** Grid of placeholder cards shown while a feed loads. */
export function CardSkeletons({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-x-5 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="mt-3 h-3.5 w-4/5" />
          <Skeleton className="mt-2 h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}

export function RowSkeletons({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-1.5">
          <Skeleton className="h-11 w-11 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Page title. Kept as a thin wrapper so pages share one header style. */
export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return <PageHeader title={typeof children === 'string' ? children : ''} meta={sub} />;
}
