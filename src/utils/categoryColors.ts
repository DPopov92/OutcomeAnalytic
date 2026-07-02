import type { SxProps, Theme } from '@mui/material/styles'
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

export function getCategoryBadgeStyle(
  color: string | undefined,
  fallback?: { bg: string; fg: string },
): {
  background: string
  color: string
} {
  if (!color) {
    return {
      background: fallback?.bg ?? 'rgba(25, 118, 210, 0.15)',
      color: fallback?.fg ?? '#1976d2',
    }
  }

  const rgb = hexToRgb(color)
  if (!rgb) {
    return {
      background: fallback?.bg ?? 'rgba(25, 118, 210, 0.15)',
      color: fallback?.fg ?? '#1976d2',
    }
  }

  return {
    background: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
    color,
  }
}

export function getCategoryBadgeSx(
  color: string | undefined,
  theme: Theme,
): SxProps<Theme> {
  const { background, color: foreground } = getCategoryBadgeStyle(color, {
    bg: theme.palette.action.selected,
    fg: theme.palette.primary.main,
  })

  return {
    display: 'inline-flex',
    alignItems: 'center',
    px: 1,
    py: 0.25,
    borderRadius: 1,
    border: 1,
    borderStyle: 'solid',
    borderColor: color ?? theme.palette.divider,
    bgcolor: background,
    color: foreground,
    fontSize: theme.typography.body2.fontSize,
    lineHeight: theme.typography.body2.lineHeight,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  }
}
