import { createTheme } from '@mui/material/styles'
import { ruRU as coreRuRU } from '@mui/material/locale'

export function createAppTheme(mode: 'light' | 'dark') {
  return createTheme(
    {
      palette: {
        mode,
      },
    },
    coreRuRU,
  )
}
