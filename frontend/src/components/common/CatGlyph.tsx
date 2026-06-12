import { Icon } from './Icon'
import { catMeta } from '../../types'

interface Props {
  category: string
  size?: number
}

export function CatGlyph({ category, size = 30 }: Props) {
  const { color, icon } = catMeta(category)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 9,
        flex: '0 0 auto',
        display: 'grid',
        placeItems: 'center',
        color,
        background: color + '1f',
        border: '1px solid ' + color + '33',
      }}
    >
      <Icon name={icon} size={size * 0.56} stroke={1.9} />
    </div>
  )
}
