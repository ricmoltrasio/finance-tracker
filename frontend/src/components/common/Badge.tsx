interface Props {
  color?: string
  children: string
}

export function Badge({ color = '#64748B', children }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {children}
    </span>
  )
}
