import type { ComponentProps } from 'react'
import { X } from 'lucide-react'

export function CancelIcon(props: ComponentProps<typeof X>) {
  return <X aria-hidden="true" {...props} />
}
