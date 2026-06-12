import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl bg-surface border border-white/[0.07] p-5 ${
        onClick ? 'cursor-pointer hover:bg-surface2 transition-colors' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
