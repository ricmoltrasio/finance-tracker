import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-muted uppercase tracking-wide">{label}</label>
      )}
      <input
        ref={ref}
        {...props}
        className={`rounded-xl bg-surface2 border px-3 py-2 text-sm text-label placeholder:text-ghost focus:outline-none focus:ring-1 disabled:opacity-50 ${
          error
            ? 'border-expense/50 focus:border-expense/50 focus:ring-expense/30'
            : 'border-white/[0.07] focus:border-accent/50 focus:ring-accent/30'
        } ${className}`}
      />
      {error && <p className="text-xs text-expense">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  children: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className = '', children, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-muted uppercase tracking-wide">{label}</label>
      )}
      <select
        ref={ref}
        {...props}
        className={`rounded-xl bg-surface2 border px-3 py-2 text-sm text-label focus:outline-none focus:ring-1 disabled:opacity-50 ${
          error
            ? 'border-expense/50 focus:border-expense/50 focus:ring-expense/30'
            : 'border-white/[0.07] focus:border-accent/50 focus:ring-accent/30'
        } ${className}`}
      >
        {children}
      </select>
      {error && <p className="text-xs text-expense">{error}</p>}
    </div>
  )
)
Select.displayName = 'Select'
