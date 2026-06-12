interface Props {
  title: string
  action?: React.ReactNode
}

export function Header({ title, action }: Props) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4 md:px-6">
      <h1 className="text-2xl font-semibold text-label tracking-tight">{title}</h1>
      {action && <div>{action}</div>}
    </div>
  )
}
