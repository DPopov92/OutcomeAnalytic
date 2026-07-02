import type { ComponentProps } from 'react'
import { ChartPie } from 'lucide-react'

export function AppLogoIcon(props: ComponentProps<typeof ChartPie>) {
  return <ChartPie aria-hidden="true" {...props} />
}
