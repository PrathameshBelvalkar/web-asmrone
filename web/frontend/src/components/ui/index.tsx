import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Button as ShadButton } from './button';
import { Badge } from './badge';
import { Skeleton as ShadSkeleton } from './skeleton';
import { Switch } from './switch';
import { cn } from '@/lib/utils';

/*
 * Thin wrappers over the shadcn components so call sites keep one small API.
 * Styling comes from the theme in src/index.css.
 */

type Variant = 'primary' | 'secondary' | 'ghost';
const VARIANT: Record<Variant, 'default' | 'outline' | 'ghost'> = {
  primary: 'default',
  secondary: 'outline',
  ghost: 'ghost',
};

export function Button({
  variant = 'secondary', icon: Icon, children, className, type = 'button', ...rest
}: React.ComponentProps<'button'> & { variant?: Variant; icon?: LucideIcon; children?: ReactNode }) {
  return (
    <ShadButton type={type} variant={VARIANT[variant]} className={cn('rounded-full', className)} {...rest}>
      {Icon && <Icon size={16} strokeWidth={2} aria-hidden />}
      {children}
    </ShadButton>
  );
}

export function IconButton({
  icon: Icon, label, active = false, size = 'md', className, ...rest
}: React.ComponentProps<'button'> & { icon: LucideIcon; label: string; active?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'size-8', md: 'size-10', lg: 'size-12' }[size];
  const iconSize = { sm: 16, md: 18, lg: 22 }[size];
  return (
    <ShadButton
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      {...rest}
      className={cn('rounded-full', dims, active ? 'text-primary' : 'text-muted-foreground hover:text-foreground', className)}
    >
      <Icon size={iconSize} strokeWidth={2} aria-hidden />
    </ShadButton>
  );
}

export function Chip({ children, to, state, onClick, icon: Icon, className }: {
  children: ReactNode;
  to?: string;
  state?: unknown;
  onClick?: () => void;
  icon?: LucideIcon;
  className?: string;
}) {
  const cls = cn('max-w-full cursor-pointer gap-1.5 rounded-full px-3 py-1.5 text-sm font-normal hover:bg-accent hover:text-accent-foreground', className);
  const content = (
    <>
      {Icon && <Icon size={14} aria-hidden className="shrink-0 text-muted-foreground" />}
      <span className="truncate">{children}</span>
    </>
  );
  if (to) {
    return (
      <Badge asChild variant="outline" className={cls}>
        <Link to={to} state={state}>{content}</Link>
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cls} onClick={onClick}>
      {content}
    </Badge>
  );
}

export function Toggle({ checked, onChange, disabled, label }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />;
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <ShadSkeleton className={className} style={style} aria-hidden />;
}

export function PageHeader({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-balance font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {meta && <div className="mt-1 text-sm text-muted-foreground">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-input px-6 py-14 text-center">
      <Icon size={28} className="text-muted-foreground" aria-hidden />
      <p className="mt-4 font-medium">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
