import type { ComponentProps } from 'react'
import { Plus } from 'lucide-react'

export function AddIcon(props: ComponentProps<typeof Plus>) {
  return <Plus aria-hidden="true" {...props} />
}
