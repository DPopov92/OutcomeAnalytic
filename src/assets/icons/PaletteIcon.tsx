import type { ComponentProps } from 'react'
import { Palette } from 'lucide-react'

export function PaletteIcon(props: ComponentProps<typeof Palette>) {
  return <Palette aria-hidden="true" {...props} />
}
