import type { ComponentProps } from 'react'
import { Check } from 'lucide-react'

export function SaveIcon(props: ComponentProps<typeof Check>) {
  return <Check aria-hidden="true" {...props} />
}
