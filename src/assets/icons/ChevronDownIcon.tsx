import type { ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'

export function ChevronDownIcon(props: ComponentProps<typeof ChevronDown>) {
  return <ChevronDown aria-hidden="true" {...props} />
}
