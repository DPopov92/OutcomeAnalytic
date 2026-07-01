import { getCategoryBadgeStyle } from '../utils/categoryColors'

interface CategoryBadgeProps {
  name: string
  color?: string
}

export function CategoryBadge({ name, color }: CategoryBadgeProps) {
  const style = getCategoryBadgeStyle(color)

  return (
    <span className="category-badge" style={style}>
      {name}
    </span>
  )
}
