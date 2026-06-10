interface Props {
  title: string
  action?: React.ReactNode
}

export function Header({ title, action }: Props) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-4 md:px-6">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      {action && <div>{action}</div>}
    </div>
  )
}
