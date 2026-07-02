import type { ComponentProps } from 'react'
import { Tags } from 'lucide-react'

export function TagsIcon(props: ComponentProps<typeof Tags>) {
  return <Tags aria-hidden="true" {...props} />
}
