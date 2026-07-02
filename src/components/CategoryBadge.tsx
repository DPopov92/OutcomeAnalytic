import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import { getCategoryBadgeSx } from '../utils/categoryColors'

interface CategoryBadgeProps {
  name: string
  color?: string
}

export function CategoryBadge({ name, color }: CategoryBadgeProps) {
  const theme = useTheme()

  return (
    <Box component="span" sx={getCategoryBadgeSx(color, theme)}>
      {name}
    </Box>
  )
}
