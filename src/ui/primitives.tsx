import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

type BtnVariant = 'default' | 'secondary' | 'ghost' | 'outline' | 'danger';
type BtnSize = 'sm' | 'md' | 'lg' | 'icon';

export function Button({ variant = 'default', size = 'md', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  return (
    <button
      className={cn(
        'sbtn',
        variant === 'default' && 'sbtn-default',
        variant === 'secondary' && 'sbtn-secondary',
        variant === 'ghost' && 'sbtn-ghost',
        variant === 'outline' && 'sbtn-outline',
        variant === 'danger' && 'sbtn-danger',
        size === 'sm' && 'sbtn-sm',
        size === 'lg' && 'sbtn-lg',
        size === 'icon' && 'sbtn-icon',
        className
      )}
      {...rest}
    />
  );
}

export function Badge({ tone = 'muted', className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: 'muted' | 'primary' | 'success' | 'warning' | 'danger' }) {
  return (
    <span
      className={cn(
        'sbadge',
        tone === 'primary' && 'sbadge-primary',
        tone === 'success' && 'sbadge-success',
        tone === 'warning' && 'sbadge-warning',
        tone === 'danger' && 'sbadge-danger',
        className
      )}
      {...rest}
    />
  );
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('scard', className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('scard-title', className)} {...rest} />;
}

export function CardDesc({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('scard-desc', className)} {...rest} />;
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('sprogress', className)}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn('sseparator', className)} />;
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('skeleton', className)} style={style} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ margin: '12px 0' }}>
      <label className="slabel">{label}</label>
      {children}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('sinput', className)} {...rest} />;
}
