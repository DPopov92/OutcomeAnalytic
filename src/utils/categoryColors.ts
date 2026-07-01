import type { Category } from '../types/category'

export function buildCategoryColorMap(
  categories: Category[],
): Record<string, string> {
  const map: Record<string, string> = {}

  for (const category of categories) {
    map[category.name] = category.color
    map[category.name.toLowerCase()] = category.color
  }

  return map
}

export function resolveCategoryColor(
  categoryName: string,
  categoryColors: Record<string, string>,
): string | undefined {
  return categoryColors[categoryName] ?? categoryColors[categoryName.toLowerCase()]
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) {
    return null
  }

  const value = match[1]
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

export function getCategoryBadgeStyle(color: string | undefined): {
  background: string
  color: string
} {
  if (!color) {
    return {
      background: 'var(--accent-bg)',
      color: 'var(--accent)',
    }
  }

  const rgb = hexToRgb(color)
  if (!rgb) {
    return {
      background: 'var(--accent-bg)',
      color: 'var(--accent)',
    }
  }

  return {
    background: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
    color,
  }
}
