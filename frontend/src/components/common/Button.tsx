import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

const variants = {
  primary: 'bg-accent text-[#06120e] hover:brightness-110 disabled:opacity-50 font-semibold',
  secondary:
    'bg-surface text-muted border border-white/[0.07] hover:text-label hover:border-white/[0.11] disabled:opacity-50',
  danger: 'bg-expense/10 text-expense border border-expense/20 hover:bg-expense/20 disabled:opacity-50',
  ghost: 'text-muted hover:bg-white/5 hover:text-label disabled:opacity-50',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-2 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-accent/40 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}
