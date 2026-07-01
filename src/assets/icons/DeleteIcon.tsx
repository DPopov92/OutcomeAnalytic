import type { ComponentProps } from 'react'
import { Trash2 } from 'lucide-react'

export function DeleteIcon(props: ComponentProps<typeof Trash2>) {
  return <Trash2 aria-hidden="true" {...props} />
}
