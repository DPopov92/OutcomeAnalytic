import type { ComponentProps } from 'react'
import { Undo2 } from 'lucide-react'

export function RestoreIcon(props: ComponentProps<typeof Undo2>) {
  return <Undo2 aria-hidden="true" {...props} />
}
