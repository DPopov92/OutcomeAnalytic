import type { ComponentProps } from 'react'
import { Pencil } from 'lucide-react'

export function EditIcon(props: ComponentProps<typeof Pencil>) {
  return <Pencil aria-hidden="true" {...props} />
}
